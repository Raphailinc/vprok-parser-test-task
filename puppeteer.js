const fs = require('node:fs');
const puppeteer = require('puppeteer');

const DEFAULT_TIMEOUT_MS = 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

async function waitForNextData(page) {
  await page.waitForSelector('#__NEXT_DATA__', { timeout: DEFAULT_TIMEOUT_MS });
}

async function dismissPopups(page) {
  try {
    await page.keyboard.press('Escape');
  } catch {
    // ignore
  }

  await page.evaluate(() => {
    const normalize = (value) =>
      String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const clickByText = (texts) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => texts.includes(normalize(b.textContent)));
      if (!target) return false;
      target.click();
      return true;
    };

    clickByText(['согласен', 'закрыть', 'не сейчас']);

    const close =
      document.querySelector('[data-testid="close"]') ||
      document.querySelector('button[aria-label="Закрыть"]') ||
      document.querySelector('button[aria-label="Close"]');

    if (close) close.click();
  });
}

async function getCurrentRegion(page) {
  return page.evaluate(() => {
    const normalize = (value) =>
      String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();

    const el =
      document.querySelector('button[class*="Region_region__"]') ||
      document.querySelector('[class*="UiHeaderHorizontalBase_region__"]');

    return el ? normalize(el.textContent) : null;
  });
}

async function openRegionModal(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const didClick = await page.evaluate(() => {
      const el =
        document.querySelector('button[class*="Region_region__"]') ||
        document.querySelector('[class*="UiHeaderHorizontalBase_region__"]');
      if (!el) return false;
      try {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      } catch {
        // ignore
      }
      el.click();
      return true;
    });

    if (!didClick) {
      throw new Error('Не удалось найти кнопку выбора региона на странице.');
    }

    try {
      await page.waitForFunction(
        () =>
          Boolean(
            document.querySelector('button[class*="UiRegionListBase_button__"]') ||
              document.querySelector('[class*="UiRegionListBase_root__"]') ||
              document.querySelector('[class*="UiModalContent_open__"]')
          ),
        { timeout: 5_000 }
      );
      return;
    } catch {
      await dismissPopups(page);
      await sleep(500);
    }
  }

  throw new Error('Не удалось открыть окно выбора региона.');
}

async function selectRegion(page, targetRegion) {
  const current = await getCurrentRegion(page);
  if (current && normalizeText(current) === normalizeText(targetRegion)) return;

  await openRegionModal(page);
  await sleep(500);

  const clicked = await page.evaluate((region) => {
    const normalize = (value) =>
      String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();

    const wanted = normalize(region);
    const candidates = Array.from(document.querySelectorAll('button'));
    const exact = candidates.find((b) => normalize(b.textContent) === wanted);
    if (exact) {
      exact.click();
      return true;
    }

    const fuzzy = candidates.find((b) => normalize(b.textContent).includes(wanted));
    if (fuzzy) {
      fuzzy.click();
      return true;
    }

    return false;
  }, targetRegion);

  if (!clicked) {
    const available = await page.evaluate(() => {
      const normalize = (value) =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim();
      return Array.from(document.querySelectorAll('button'))
        .map((b) => normalize(b.textContent))
        .filter(Boolean)
        .filter((t) => t.length < 60)
        .slice(0, 50);
    });

    throw new Error(
      `Регион "${targetRegion}" не найден. Примеры доступных кнопок: ${available.join(', ')}`
    );
  }

  await page.waitForFunction(
    (region) => {
      const normalize = (value) =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim();
      const el =
        document.querySelector('button[class*="Region_region__"]') ||
        document.querySelector('[class*="UiHeaderHorizontalBase_region__"]');
      return el && normalize(el.textContent) === normalize(region);
    },
    { timeout: DEFAULT_TIMEOUT_MS },
    targetRegion
  );
}

function parseProductData(nextData) {
  const store = nextData?.props?.pageProps?.initialStore;
  const product = store?.productPage?.product;
  const reviews = store?.productPage?.reviews?.data;

  const price = product?.price;
  const priceOld = product?.oldPrice;
  const rating = reviews?.rating;
  const reviewCount = reviews?.numberOfReviews;

  return { price, priceOld, rating, reviewCount };
}

function formatProductTxt({ price, priceOld, rating, reviewCount }) {
  const lines = [];
  lines.push(`price=${price}`);
  if (priceOld !== undefined && priceOld !== null && Number(priceOld) > 0) {
    lines.push(`priceOld=${priceOld}`);
  }
  lines.push(`rating=${rating}`);
  lines.push(`reviewCount=${reviewCount}`);
  return lines.join('\n') + '\n';
}

async function main() {
  const [, , productUrlRaw, regionRaw] = process.argv;

  if (!productUrlRaw || !regionRaw) {
    console.error(
      'Usage: node puppeteer.js <productUrl> <region>\n' +
        'Example: node puppeteer.js https://www.vprok.ru/product/... "Санкт-Петербург и область"'
    );
    process.exit(1);
  }

  const productUrl = new URL(productUrlRaw).toString();
  const region = normalizeText(regionRaw);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

  await page.setViewport({ width: 1200, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  try {
    await page.goto('https://www.vprok.ru/', { waitUntil: 'domcontentloaded' });
    await waitForNextData(page);
    await dismissPopups(page);
    await page.waitForSelector('button[class*="Region_region__"]', { timeout: DEFAULT_TIMEOUT_MS });

    await selectRegion(page, region);

    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await waitForNextData(page);
    await dismissPopups(page);

    await page.screenshot({ path: 'screenshot.jpg', fullPage: true });

    const nextText = await page.$eval('#__NEXT_DATA__', (el) => el.textContent);
    const nextData = JSON.parse(nextText);
    const productData = parseProductData(nextData);

    if (
      productData.price === undefined ||
      productData.rating === undefined ||
      productData.reviewCount === undefined
    ) {
      throw new Error('Не удалось извлечь обязательные поля товара из __NEXT_DATA__.');
    }

    fs.writeFileSync('product.txt', formatProductTxt(productData), 'utf8');
    console.log('Saved screenshot.jpg and product.txt');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
