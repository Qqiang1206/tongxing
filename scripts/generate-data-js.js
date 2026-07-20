/**
 * Generate data/{kind}/{lang}.js companions from JSON so detail pages
 * can load via <script src> (works on file:// and IIS without JSON MIME).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const kinds = {
  products: '__TXAM_PRODUCTS',
  solutions: '__TXAM_SOLUTIONS',
  news: '__TXAM_NEWS',
};

for (const [kind, globalName] of Object.entries(kinds)) {
  for (const lang of ['zh', 'en', 'ru']) {
    const jsonPath = path.join(ROOT, 'data', kind, `${lang}.json`);
    const jsPath = path.join(ROOT, 'data', kind, `${lang}.js`);
    const data = fs.readFileSync(jsonPath, 'utf8').trim();
    const out = `/* auto-generated from ${lang}.json — do not edit */\nwindow.${globalName}_${lang.toUpperCase()}=${data};\n`;
    fs.writeFileSync(jsPath, out);
    console.log('wrote', path.relative(ROOT, jsPath));
  }
}
