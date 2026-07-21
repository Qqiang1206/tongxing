/**
 * Insert data/{kind}/{lang}.js after data-loader.js on list/landing pages (file:// safe).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const listPages = [
  { file: 'news.html', data: 'data/news/zh.js' },
  { file: 'en/news.html', data: '../data/news/en.js' },
  { file: 'ru/news.html', data: '../data/news/ru.js' },
  { file: 'products.html', data: 'data/products/zh.js' },
  { file: 'en/products.html', data: '../data/products/en.js' },
  { file: 'ru/products.html', data: '../data/products/ru.js' },
];

function insertDataJs(html, dataSrc, loaderPattern) {
  if (html.includes(dataSrc)) return html;
  const re = new RegExp(
    '(<script src="' + loaderPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"><\\/script>\\s*)',
    'i'
  );
  if (!re.test(html)) return html;
  return html.replace(re, '$1<script src="' + dataSrc + '"></script>\n    ');
}

for (const { file, data } of listPages) {
  const filePath = path.join(root, file);
  const loader = file.startsWith('en/') || file.startsWith('ru/')
    ? '../assets/js/data-loader.js'
    : 'assets/js/data-loader.js';
  let html = fs.readFileSync(filePath, 'utf8');
  const next = insertDataJs(html, data, loader);
  if (next !== html) {
    fs.writeFileSync(filePath, next, 'utf8');
    console.log('added', data, '→', file);
  }
}

const slugs = [
  'tv-display', 'refrigerator', 'packaging', 'washer', 'capacitor', 'ac',
  'microwave', 'coffee', 'tablet', 'headlight', 'robot',
];

for (const slug of slugs) {
  for (const [rel, lang, prefix] of [
    [`${slug}-solution.html`, 'zh', ''],
    [`en/${slug}-solution.html`, 'en', '../'],
    [`ru/${slug}-solution.html`, 'ru', '../'],
  ]) {
    const filePath = path.join(root, rel);
    if (!fs.existsSync(filePath)) continue;
    const dataSrc = `${prefix}data/solutions/${lang}.js`;
    const loader = `${prefix}assets/js/data-loader.js`;
    let html = fs.readFileSync(filePath, 'utf8');
    const next = insertDataJs(html, dataSrc, loader);
    if (next !== html) {
      fs.writeFileSync(filePath, next, 'utf8');
      console.log('added', dataSrc, '→', rel);
    }
  }
}

console.log('done');
