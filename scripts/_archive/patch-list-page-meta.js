/**
 * Add inline page meta JS to list pages so loadPage() skips JSON fetch.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const pages = [
  { file: 'products.html', page: 'products', lang: 'zh', prefix: '' },
  { file: 'news.html', page: 'news', lang: 'zh', prefix: '' },
  { file: 'solutions.html', page: 'solutions', lang: 'zh', prefix: '' },
  { file: 'en/products.html', page: 'products', lang: 'en', prefix: '../' },
  { file: 'en/news.html', page: 'news', lang: 'en', prefix: '../' },
  { file: 'en/solutions.html', page: 'solutions', lang: 'en', prefix: '../' },
  { file: 'ru/products.html', page: 'products', lang: 'ru', prefix: '../' },
  { file: 'ru/news.html', page: 'news', lang: 'ru', prefix: '../' },
  { file: 'ru/solutions.html', page: 'solutions', lang: 'ru', prefix: '../' },
];

for (const cfg of pages) {
  const filePath = path.join(root, cfg.file);
  let html = fs.readFileSync(filePath, 'utf8');
  const tag = `<script src="${cfg.prefix}data/pages/${cfg.page}/${cfg.lang}.js"></script>`;
  if (html.includes(tag)) {
    console.log('skip', cfg.file);
    continue;
  }
  const catalogTag = `<script src="${cfg.prefix}data/${cfg.page}/${cfg.lang}.js"></script>`;
  if (!html.includes(catalogTag)) {
    console.warn('missing catalog tag', cfg.file);
    continue;
  }
  html = html.replace(catalogTag, catalogTag + '\n    ' + tag);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('patched', cfg.file);
}

console.log('done');
