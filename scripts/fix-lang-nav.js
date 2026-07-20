/**
 * Fix en/ and ru/ internal navigation: stay in-lang; only ZH switch goes to ../
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const PAGES = [
  'index', 'about', 'products', 'product-detail',
  'solutions', 'solutions-detail',
  'news', 'news-detail', 'contact',
  'tv-display-solution', 'refrigerator-solution', 'washer-solution',
  'tablet-solution', 'packaging-solution', 'robot-solution',
  'ac-solution', 'capacitor-solution', 'coffee-solution',
  'headlight-solution', 'microwave-solution',
];

function fixLangDir(lang) {
  const dir = path.join(ROOT, lang);
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const fp = path.join(dir, file);
    let s = fs.readFileSync(fp, 'utf8');
    const base = file.replace(/\.html$/, '');

    // Fix wrongly rewritten "../page.html" back to "page.html" for same-lang nav
    for (const p of PAGES) {
      // href="../products.html" → href="products.html"
      // but keep language switcher ZH as ../
      const re = new RegExp(`href="\\.\\./${p}\\.html([^"]*)"`, 'g');
      s = s.replace(re, `href="${p}.html$1"`);
    }

    // Language switcher: ZH should be ../base.html, EN should be base.html (en) or ../en/base.html (from ru)
    // Current broken state often has EN pointing to ../index.html too.

    // Rebuild language switcher links more reliably for nav blocks
    // Pattern: three lang links near each other
    if (lang === 'en') {
      // ZH -> ../file, EN -> file, RU -> ../ru/file
      s = s.replace(
        /href="\.\.\/([^"#?]+)\.html([^"]*)"(\s+class="[^"]*")?\s*>ZH</g,
        `href="../$1.html$2"$3>ZH<`
      );
      // Ensure EN self links
      s = s.replace(/href="\.\.\/index\.html"(\s+class="[^"]*text-\[#FF6B00\][^"]*")\s*>EN</g, `href="index.html"$1>EN<`);
      // Fix EN active that wrongly points to ../
      s = s.replace(new RegExp(`href="\\.\\./${base}\\.html"([^>]*>\\s*EN<)`, 'g'), `href="${base}.html"$1`);
      s = s.replace(/href="\.\.\/index\.html"([^>]*>\s*EN<)/g, `href="index.html"$1`);
    }

    if (lang === 'ru') {
      s = s.replace(new RegExp(`href="\\.\\./${base}\\.html"([^>]*>\\s*RU<)`, 'g'), `href="${base}.html"$1`);
      s = s.replace(/href="\.\.\/index\.html"([^>]*>\s*RU<)/g, `href="index.html"$1`);
    }

    // Fix CTA / in-content links that should stay in-lang (already partially fixed by PAGES loop)

    // Fix footer script path
    s = s.replace(/src="footer-en\.js"/g, 'src="../assets/js/footer-en.js"');
    s = s.replace(/src="footer-ru\.js"/g, 'src="../assets/js/footer-ru.js"');
    s = s.replace(/src="footer\.js"/g, lang === 'en' ? 'src="../assets/js/footer-en.js"' : 'src="../assets/js/footer-ru.js"');

    // Fix double ../assets
    s = s.replace(/\.\.\/\.\.\/assets\//g, '../assets/');

    fs.writeFileSync(fp, s, 'utf8');
    console.log('Fixed', lang, file);
  }
}

function fixLanguageSwitchers(lang) {
  const dir = path.join(ROOT, lang);
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const fp = path.join(dir, file);
    let s = fs.readFileSync(fp, 'utf8');
    const base = file; // e.g. about.html

    // Replace lang switch clusters: look for ZH|EN|RU anchors
    // EN page switcher should be: ../about.html, about.html, ../ru/about.html
    if (lang === 'en') {
      s = s.replace(
        /(<a href=")[^"]*(" class="[^"]*"[^>]*>ZH<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*(" class="[^"]*"[^>]*>EN<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*(" class="[^"]*"[^>]*>RU<\/a>)/g,
        `$1../${base}$2${base}$3../ru/${base}$4`
      );
      // Mobile switcher without class complexity
      s = s.replace(
        /(<a href=")[^"]*("[^>]*>ZH<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*("[^>]*>EN<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*("[^>]*>RU<\/a>)/g,
        (m, a, b, c, d) => {
          // only if nearby EN is bold/active context - apply broadly for mobile
          return `${a}../${base}${b}${base}${c}../ru/${base}${d}`;
        }
      );
    }
    if (lang === 'ru') {
      s = s.replace(
        /(<a href=")[^"]*(" class="[^"]*"[^>]*>ZH<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*(" class="[^"]*"[^>]*>EN<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*(" class="[^"]*"[^>]*>RU<\/a>)/g,
        `$1../${base}$2../en/${base}$3${base}$4`
      );
      s = s.replace(
        /(<a href=")[^"]*("[^>]*>ZH<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*("[^>]*>EN<\/a>\s*<span[^>]*>\|<\/span>\s*<a href=")[^"]*("[^>]*>RU<\/a>)/g,
        `$1../${base}$2../en/${base}$3${base}$4`
      );
    }

    fs.writeFileSync(fp, s, 'utf8');
  }
}

function fixZhLangSwitcher() {
  // ZH pages: EN -> en/page.html, RU -> ru/page.html
  for (const file of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
    const fp = path.join(ROOT, file);
    let s = fs.readFileSync(fp, 'utf8');
    const before = s;
    // Already should be en/ and ru/ from restructure - verify
    s = s.replace(/href="([^"#?]+)-en\.html/g, 'href="en/$1.html');
    s = s.replace(/href="([^"#?]+)-ru\.html/g, 'href="ru/$1.html');
    if (s !== before) {
      fs.writeFileSync(fp, s, 'utf8');
      console.log('ZH switcher', file);
    }
  }
}

function fixProductsListingLinks() {
  // products.html may still link to product-N - ensure detail links
  for (const rel of ['products.html', 'en/products.html', 'ru/products.html']) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    let s = fs.readFileSync(fp, 'utf8');
    s = s.replace(/href="product-(\d+)(?:-en|-ru)?\.html"/g, 'href="product-detail.html?id=$1"');
    s = s.replace(/href="\.\.\/product-detail\.html\?id=(\d+)"/g, 'href="product-detail.html?id=$1"');
    fs.writeFileSync(fp, s, 'utf8');
  }
}

fixLangDir('en');
fixLangDir('ru');
fixLanguageSwitchers('en');
fixLanguageSwitchers('ru');
fixZhLangSwitcher();
fixProductsListingLinks();
console.log('Nav fix done');
