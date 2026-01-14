# vprok.ru parser (test task)

## Setup

```bash
npm install
```

## Part 1 — Puppeteer

```bash
node puppeteer.js "https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202" "Санкт-Петербург и область"
```

Outputs in current directory:
- `screenshot.jpg` — full page screenshot
- `product.txt` — product fields:
  - `price`
  - `priceOld` (optional)
  - `rating`
  - `reviewCount`

## Part 2 — API parser

```bash
node api-parser.js "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory"
```

Output in current directory:
- `products-api.txt`

## Lint/format (optional)

```bash
npm run lint
npm run format
```
