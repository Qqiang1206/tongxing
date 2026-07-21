/**
 * Generate sitemap.xml from published catalog + static pages (zh/en/ru).
 *
 * Usage: node scripts/generate-sitemap.js
 * Env: SITEMAP_BASE=https://www.sztxgk.com
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const base = (process.env.SITEMAP_BASE || 'https://www.sztxgk.com').replace(/\/$/, '');

const SOLUTION_SLUG_BY_ID = {
  '31': 'tv-display',
  '32': 'refrigerator',
  '33': 'packaging',
  '34': 'washer',
  '35': 'capacitor',
  '36': 'ac',
  '37': 'microwave',
  '38': 'coffee',
  '39': 'tablet',
  '40': 'headlight',
  '41': 'robot',
};

const STATIC_PAGES = [
  'index.html',
  'about.html',
  'products.html',
  'solutions.html',
  'news.html',
  'contact.html',
];

function loadCatalog(kind) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', kind, 'zh.json'), 'utf8'));
}

function langPrefix(lang) {
  return lang === 'zh' ? '' : `${lang}/`;
}

function urlEntry(loc, changefreq, priority) {
  return (
    '  <url>\n' +
    `    <loc>${loc}</loc>\n` +
    `    <changefreq>${changefreq}</changefreq>\n` +
    (priority ? `    <priority>${priority}</priority>\n` : '') +
    '  </url>'
  );
}

const urls = [];
const langs = ['zh', 'en', 'ru'];

for (const lang of langs) {
  const prefix = langPrefix(lang);
  for (const page of STATIC_PAGES) {
    const loc = `${base}/${prefix}${page === 'index.html' && lang === 'zh' ? 'index.html' : page}`;
    urls.push(urlEntry(loc, 'weekly', page === 'index.html' ? '1.0' : '0.8'));
  }
  for (const slug of Object.values(SOLUTION_SLUG_BY_ID)) {
    urls.push(urlEntry(`${base}/${prefix}${slug}-solution.html`, 'monthly', '0.7'));
  }
}

const products = loadCatalog('products');
for (const id of Object.keys(products)) {
  const row = products[id];
  if (row.published === false) continue;
  for (const lang of langs) {
    const prefix = langPrefix(lang);
    urls.push(urlEntry(`${base}/${prefix}product-detail.html?id=${id}`, 'weekly', '0.6'));
  }
}

const news = loadCatalog('news');
for (const id of Object.keys(news)) {
  const row = news[id];
  if (row.published === false) continue;
  for (const lang of langs) {
    const prefix = langPrefix(lang);
    urls.push(urlEntry(`${base}/${prefix}news-detail.html?id=${id}`, 'weekly', '0.5'));
  }
}

const solutions = loadCatalog('solutions');
for (const id of Object.keys(solutions)) {
  const row = solutions[id];
  if (row.published === false) continue;
  for (const lang of langs) {
    const prefix = langPrefix(lang);
    urls.push(urlEntry(`${base}/${prefix}solutions-detail.html?id=${id}`, 'monthly', '0.6'));
  }
}

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.join('\n') +
  '\n</urlset>\n';

const outPath = path.join(root, 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`Wrote ${outPath} (${urls.length} urls)`);
