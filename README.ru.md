# vprok parser test task

[![CI](https://github.com/Raphailinc/vprok-parser-test-task/actions/workflows/ci.yml/badge.svg)](https://github.com/Raphailinc/vprok-parser-test-task/actions/workflows/ci.yml)

[English](README.md) · [Русский](README.ru.md)

Тестовое задание из двух независимых частей: сбор сведений со страницы товара через Puppeteer и выгрузка каталога через API.

## Установка

Требуется Node.js 22.17+. Установка по сохранённому lockfile:

```bash
npm ci
```

## Страница товара через Puppeteer

```bash
node puppeteer.js "https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202" "Санкт-Петербург и область"
```

Результаты в текущем каталоге: `screenshot.jpg` — снимок страницы, `product.txt` — цена, предыдущая цена при наличии, рейтинг и число отзывов. Первый запуск может потребовать скачанный Puppeteer браузер.

## Каталог через API

```bash
node api-parser.js "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory"
```

Результат записывается в `products-api.txt`.

## Проверки

```bash
npm run lint
```

CI проверяет линтер и зависимости. Поведенческих автотестов нет. Живой результат зависит от доступности сайта, его разметки, API и правил доступа; успешный линтер не подтверждает успешный сбор данных с сайта.
