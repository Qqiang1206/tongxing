/**
 * Phase 3 patches: site-footer, i18n js, home/about page wiring.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function walkHtml(dir, list) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkHtml(p, list);
    else if (name.endsWith('.html')) list.push(p);
  }
}

const htmlFiles = [];
walkHtml(root, htmlFiles);
htmlFiles.push(); // noop

function patchFooter(html, filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const isEn = rel.startsWith('en/');
  const isRu = rel.startsWith('ru/');
  const prefix = isEn || isRu ? '../' : '';
  const i18nJs = prefix + 'data/i18n/' + (isEn ? 'en' : isRu ? 'ru' : 'zh') + '.js';

  html = html.replace(/<script src="[^"]*footer-en\.js" defer><\/script>/g,
    `<script src="${prefix}data/i18n/en.js"></script>\n    <script src="${prefix}assets/js/site-footer.js" defer></script>`);
  html = html.replace(/<script src="[^"]*footer-ru\.js" defer><\/script>/g,
    `<script src="${prefix}data/i18n/ru.js"></script>\n    <script src="${prefix}assets/js/site-footer.js" defer></script>`);
  html = html.replace(/<script src="assets\/js\/footer\.js" defer><\/script>/g,
    `<script src="data/i18n/zh.js"></script>\n    <script src="assets/js/site-footer.js" defer></script>`);

  if (!html.includes('site-footer.js') && html.includes('footer.js')) {
    html = html.replace(/<script src="\.\.\/assets\/js\/footer\.js" defer><\/script>/g,
      `<script src="${i18nJs}"></script>\n    <script src="${prefix}assets/js/site-footer.js" defer></script>`);
  }
  return html;
}

function patchIndex(html, filePath) {
  if (!filePath.endsWith('index.html')) return html;
  if (!html.includes('id="home-hero-title"')) {
    html = html.replace(/<h1 class="hero-title/, '<h1 id="home-hero-title" class="hero-title');
  }
  if (!html.includes('id="home-hero-lead"')) {
    html = html.replace(
      /(<header class="pt-40[\s\S]*?<p class="text-body-lg[^"]*")(\s+max-w-3xl)/,
      '$1 id="home-hero-lead"$2'
    );
  }
  if (!html.includes('id="home-cta-primary"')) {
    html = html.replace(
      /<a href="products\.html" class="bg-\[#1D1D1F\]/,
      '<a id="home-cta-primary" href="products.html" class="bg-[#1D1D1F]'
    );
  }
  if (!html.includes('id="home-cta-secondary"')) {
    html = html.replace(
      /<a href="about\.html" class="bg-white border/,
      '<a id="home-cta-secondary" href="about.html" class="bg-white border'
    );
  }
  if (!html.includes('id="home-featured-link"')) {
    html = html.replace(
      /<a href="tv-display-solution\.html" class="w-full media-h-index/,
      '<a id="home-featured-link" href="tv-display-solution.html" class="w-full media-h-index'
    );
  }
  if (!html.includes('id="home-featured-image"')) {
    html = html.replace(
      /(<picture>[\s\S]*?<img)( alt="[^"]*" class="w-full h-full object-cover img-zoom")/,
      '$1 id="home-featured-image"$2'
    );
  }
  if (!html.includes('id="home-featured-eyebrow"')) {
    html = html.replace(
      /<p class="text-\[#FF6B00\] text-sm font-bold tracking-widest mb-3 uppercase">/,
      '<p id="home-featured-eyebrow" class="text-[#FF6B00] text-sm font-bold tracking-widest mb-3 uppercase">'
    );
  }
  if (!html.includes('id="home-featured-title"')) {
    html = html.replace(
      /<p class="text-white text-h2 font-black mb-2">/,
      '<p id="home-featured-title" class="text-white text-h2 font-black mb-2">'
    );
  }
  if (!html.includes('id="home-featured-subtitle"')) {
    html = html.replace(
      /<p class="text-white\/80 text-base md:text-lg">/,
      '<p id="home-featured-subtitle" class="text-white/80 text-base md:text-lg">'
    );
  }
  if (!html.includes('id="home-featured-cta"')) {
    html = html.replace(
      /<div class="mt-6 inline-flex items-center bg-\[#FF6B00\]/,
      '<div id="home-featured-cta" class="mt-6 inline-flex items-center bg-[#FF6B00]'
    );
  }

  if (html.includes('home-page.js')) return html;
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const isEn = rel.startsWith('en/');
  const isRu = rel.startsWith('ru/');
  const prefix = isEn || isRu ? '../' : '';
  const lang = isEn ? 'en' : isRu ? 'ru' : 'zh';
  const inject =
    `    <script src="${prefix}assets/js/data-loader.js"></script>\n` +
    `    <script src="${prefix}data/pages/home/${lang}.js"></script>\n` +
    `    <script src="${prefix}assets/js/home-page.js"></script>\n` +
    `    <script>document.addEventListener('DOMContentLoaded',function(){TXAM.initHomePage({lang:'${lang}'});});</script>\n`;

  return html.replace(/(\s*<script src="[^"]*site-footer\.js" defer><\/script>)/, inject + '\n$1');
}

function patchAbout(html, filePath) {
  if (!filePath.endsWith('about.html')) return html;
  html = html.replace(
    /<h1 class="hero-title([^"]*)">/,
    '<h1 id="about-hero-title" class="hero-title$1">'
  );
  html = html.replace(
    /(<p class="text-body-lg[^"]*")(\s+max-w)/,
    '$1 id="about-hero-lead"$2'
  );

  if (html.includes('about-page.js')) return html;
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const isEn = rel.startsWith('en/');
  const isRu = rel.startsWith('ru/');
  const prefix = isEn || isRu ? '../' : '';
  const lang = isEn ? 'en' : isRu ? 'ru' : 'zh';
  const inject =
    `    <script src="${prefix}assets/js/data-loader.js"></script>\n` +
    `    <script src="${prefix}data/pages/about/${lang}.js"></script>\n` +
    `    <script src="${prefix}assets/js/about-page.js"></script>\n` +
    `    <script>document.addEventListener('DOMContentLoaded',function(){TXAM.initAboutPage({lang:'${lang}'});});</script>\n`;

  return html.replace(/(\s*<script src="[^"]*site-footer\.js" defer><\/script>)/, inject + '\n$1');
}

let count = 0;
for (const filePath of htmlFiles) {
  if (filePath.includes('node_modules')) continue;
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  html = patchFooter(html, filePath);
  html = patchIndex(html, filePath);
  html = patchAbout(html, filePath);
  if (html !== before) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('patched', path.relative(root, filePath));
    count++;
  }
}
console.log('done', count, 'files');
