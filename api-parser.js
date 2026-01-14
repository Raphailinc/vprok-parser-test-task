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

    const buttons = Array.from(document.querySelectorAll('button'));
    const agree = buttons.find((b) => normalize(b.textContent) === 'согласен');
    if (agree) agree.click();
  });
}

function parseCategoryInfo(nextData, categoryUrl) {
  const store = nextData?.props?.pageProps?.initialStore;
  const requestParams = store?.catalogPage?.requestParams;

  const urlObj = new URL(categoryUrl);
  const pathnameWithQuery = urlObj.pathname + urlObj.search;

  const categoryId =
    requestParams?.categoryId ??
    (() => {
      const m = urlObj.pathname.match(/\/catalog\/(\d+)\//);
      return m ? Number(m[1]) : null;
    })();

  const sort = requestParams?.sort || 'popularity_desc';
  const limit = requestParams?.limit || 30;

  return { categoryId, sort, limit, bodyUrl: pathnameWithQuery };
}

async function fetchCategoryApi(page, { categoryId, sort, limit, bodyUrl }) {
  const apiPath = `/web/api/v1/catalog/category/${categoryId}?sort=${encodeURIComponent(
    sort
  )}&limit=${encodeURIComponent(limit)}&page=1`;

  return page.evaluate(
    async ({ apiPath: apiPathInner, bodyUrl: bodyUrlInner }) => {
      const res = await fetch(apiPathInner, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ noRedirect: true, url: bodyUrlInner })
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }

      return JSON.parse(text);
    },
    { apiPath, bodyUrl }
  );
}

function formatProductBlock(product) {
  const fullUrl = `https://www.vprok.ru${product.url}`;

  const hasDiscount =
    (product.oldPrice !== undefined && product.oldPrice !== null && Number(product.oldPrice) > 0) ||
    (product.discountPercent !== undefined &&
      product.discountPercent !== null &&
      Number(product.discountPercent) > 0) ||
    (product.discount !== undefined && product.discount !== null && Number(product.discount) > 0);

  const promoPrice = hasDiscount ? product.price : '';
  const oldPrice =
    product.oldPrice !== undefined && product.oldPrice !== null && Number(product.oldPrice) > 0
      ? product.oldPrice
      : '';

  let discount = '';
  if (product.discountPercent !== undefined && product.discountPercent !== null && Number(product.discountPercent) > 0) {
    discount = `${product.discountPercent}%`;
  } else if (product.discount !== undefined && product.discount !== null && Number(product.discount) > 0) {
    discount = String(product.discount);
  }

  const lines = [
    `Название товара: ${normalizeText(product.name)}`,
    `Ссылка на страницу товара: ${fullUrl}`,
    `Рейтинг: ${product.rating ?? ''}`,
    `Количество отзывов: ${product.reviews ?? ''}`,
    `Цена: ${product.price ?? ''}`,
    `Акционная цена: ${promoPrice}`,
    `Цена до акции: ${oldPrice}`,
    `Размер скидки: ${discount}`
  ];

  return lines.join('\n');
}

async function main() {
  const [, , categoryUrlRaw] = process.argv;

  if (!categoryUrlRaw) {
    console.error(
      'Usage: node api-parser.js <categoryUrl>\n' +
        'Example: node api-parser.js https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory'
    );
    process.exit(1);
  }

  const categoryUrl = new URL(categoryUrlRaw).toString();

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

  await page.setViewport({ width: 1200, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded' });
    await waitForNextData(page);
    await dismissPopups(page);
    await sleep(1000);

    const nextText = await page.$eval('#__NEXT_DATA__', (el) => el.textContent);
    const nextData = JSON.parse(nextText);
    const categoryInfo = parseCategoryInfo(nextData, categoryUrl);

    if (!categoryInfo.categoryId) {
      throw new Error('Не удалось определить categoryId из страницы категории.');
    }

    const apiJson = await fetchCategoryApi(page, categoryInfo);
    const products = Array.isArray(apiJson.products) ? apiJson.products : [];

    if (!products.length) {
      throw new Error('API вернул пустой список товаров.');
    }

    const content = products.map(formatProductBlock).join('\n\n') + '\n';
    fs.writeFileSync('products-api.txt', content, 'utf8');
    console.log(`Saved products-api.txt (${products.length} items)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
