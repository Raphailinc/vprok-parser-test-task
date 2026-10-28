# vprok parser test task

[![CI](https://github.com/Raphailinc/vprok-parser-test-task/actions/workflows/ci.yml/badge.svg)](https://github.com/Raphailinc/vprok-parser-test-task/actions/workflows/ci.yml)

[English](README.md) · [Русский](README.ru.md)

A two-part test assignment for extracting product and catalog data.

## What it does

- Use Puppeteer to visit a product page and save a screenshot and product fields.
- Query a catalog API and save product data to a text file.
- Keep the browser and API approaches as separate entry points.

## Run locally

```bash
npm ci
node api-parser.js "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory"
```

## Checks

```bash
npm run lint
```

## Scope and implementation notes

See the Russian guide for the Puppeteer product/region command. Live results depend on the target site, its current markup, availability and access policy. No automated behavioral tests are included.

Requires Node.js 22.17+; use the committed npm lockfile with `npm ci`.
