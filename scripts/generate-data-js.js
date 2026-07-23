/**
 * Generate data/{kind}/{lang}.js companions from JSON so detail pages
 * can load via <script src> (works on file:// and IIS without JSON MIME).
 *
 * List/catalog globals are slim (no contentHtml / heavy detail fields).
 * Per-item full payloads live in data/{kind}/items/{lang}/{id}.json for detail pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const kinds = {
  products: '__TXAM_PRODUCTS',
  solutions: '__TXAM_SOLUTIONS',
  news: '__TXAM_NEWS',
  i18n: '__TXAM_SITE',
};

const SLIM_OMIT = {
  products: ['contentHtml', 'detail'],
  solutions: ['contentHtml', 'detail', 'painPoints', 'process'],
  news: ['contentHtml', 'content'],
};

function slimItem(kind, item) {
  const omit = new Set(SLIM_OMIT[kind] || []);
  const out = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (!omit.has(key)) out[key] = value;
  }
  return out;
}

function slimCatalog(kind, data) {
  const out = {};
  for (const [id, item] of Object.entries(data || {})) {
    out[id] = slimItem(kind, item);
  }
  return out;
}

function writeItemFiles(kind, lang, data) {
  const dir = path.join(ROOT, 'data', kind, 'items', lang);
  fs.mkdirSync(dir, { recursive: true });
  for (const [id, item] of Object.entries(data || {})) {
    const itemPath = path.join(dir, `${id}.json`);
    fs.writeFileSync(itemPath, JSON.stringify(item, null, 2) + '\n');
    console.log('wrote', path.relative(ROOT, itemPath));
  }
}

for (const [kind, globalName] of Object.entries(kinds)) {
  if (kind === 'i18n') {
    for (const lang of ['zh', 'en', 'ru']) {
      const jsonPath = path.join(ROOT, 'data', 'i18n', `${lang}.json`);
      const jsPath = path.join(ROOT, 'data', 'i18n', `${lang}.js`);
      const data = fs.readFileSync(jsonPath, 'utf8').trim();
      const out = `/* auto-generated from ${lang}.json — do not edit */\nwindow.${globalName}_${lang.toUpperCase()}=${data};\n`;
      fs.writeFileSync(jsPath, out);
      console.log('wrote', path.relative(ROOT, jsPath));
    }
    continue;
  }
  for (const lang of ['zh', 'en', 'ru']) {
    const jsonPath = path.join(ROOT, 'data', kind, `${lang}.json`);
    const jsPath = path.join(ROOT, 'data', kind, `${lang}.js`);
    const full = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    writeItemFiles(kind, lang, full);
    const slim = slimCatalog(kind, full);
    const out =
      `/* auto-generated from ${lang}.json (list-slim) — do not edit */\n` +
      `window.${globalName}_${lang.toUpperCase()}=${JSON.stringify(slim)};\n`;
    fs.writeFileSync(jsPath, out);
    console.log('wrote', path.relative(ROOT, jsPath));
  }
}

const pageKeys = ['contact', 'home', 'about', 'products', 'news', 'solutions'];
for (const pageKey of pageKeys) {
  const globalName = `__TXAM_PAGE_${pageKey.toUpperCase()}`;
  for (const lang of ['zh', 'en', 'ru']) {
    const jsonPath = path.join(ROOT, 'data', 'pages', pageKey, `${lang}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    const jsPath = path.join(ROOT, 'data', 'pages', pageKey, `${lang}.js`);
    const data = fs.readFileSync(jsonPath, 'utf8').trim();
    const out = `/* auto-generated from ${lang}.json — do not edit */\nwindow.${globalName}_${lang.toUpperCase()}=${data};\n`;
    fs.writeFileSync(jsPath, out);
    console.log('wrote', path.relative(ROOT, jsPath));
  }
}
