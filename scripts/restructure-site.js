/**
 * Full site restructure: assets + pages + lang dirs + detail JSON loaders.
 * Run: node scripts/restructure-site.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function moveFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.renameSync(src, dest);
  return true;
}

function rm(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

// --- Asset map: old relative path -> new path under assets/images ---
const IMAGE_MOVES = {
  'logo.png': 'assets/images/brand/logo.png',
  'logo.webp': 'assets/images/brand/logo.webp',
  'favicon.png': 'assets/images/brand/favicon.png',
  'favicon.webp': 'assets/images/brand/favicon.webp',
  'wechat-service.png': 'assets/images/brand/wechat-service.png',
  'szgc1.png': 'assets/images/hero/szgc1.png',
  'hzgc2.jpg': 'assets/images/hero/hzgc2.jpg',
  'factory-hero.jpg': 'assets/images/hero/factory-hero.jpg',
  'factory-hero.webp': 'assets/images/hero/factory-hero.webp',
  'building-office.jpg': 'assets/images/hero/building-office.jpg',
  'building-office.webp': 'assets/images/hero/building-office.webp',
  'news-tech.jpg': 'assets/images/hero/news-tech.jpg',
  'news-tech.webp': 'assets/images/hero/news-tech.webp',
  'shipping-container.jpg': 'assets/images/hero/shipping-container.jpg',
  'shipping-container.webp': 'assets/images/hero/shipping-container.webp',
  'robot-arm.webp': 'assets/images/hero/robot-arm.webp',
  'control-system.webp': 'assets/images/hero/control-system.webp',
  'display-automation-line.webp': 'assets/images/hero/display-automation-line.webp',
  'pkg-logistics-line.webp': 'assets/images/hero/pkg-logistics-line.webp',
  'robot-unit.webp': 'assets/images/hero/robot-unit.webp',
  'automation-line.webp': 'assets/images/hero/automation-line.webp',
};

function moveAssets() {
  console.log('\n== Moving assets ==');
  ensureDir(path.join(ROOT, 'assets/css'));
  ensureDir(path.join(ROOT, 'assets/js'));
  ensureDir(path.join(ROOT, 'assets/images/brand'));
  ensureDir(path.join(ROOT, 'assets/images/hero'));
  ensureDir(path.join(ROOT, 'assets/images/products'));
  ensureDir(path.join(ROOT, 'assets/images/solutions'));
  ensureDir(path.join(ROOT, 'assets/images/certifications'));
  ensureDir(path.join(ROOT, 'assets/images/clients'));

  // CSS
  moveFile(path.join(ROOT, 'styles.css'), path.join(ROOT, 'assets/css/styles.css'));
  moveFile(path.join(ROOT, 'tailwind.min.css'), path.join(ROOT, 'assets/css/tailwind.min.css'));

  // JS core
  for (const js of ['lang-detect.js', 'factory-carousel.js', 'header.js', 'footer.js', 'footer-en.js', 'footer-ru.js']) {
    moveFile(path.join(ROOT, js), path.join(ROOT, 'assets/js', js));
  }

  // Root images
  for (const [from, to] of Object.entries(IMAGE_MOVES)) {
    moveFile(path.join(ROOT, from), path.join(ROOT, to));
  }

  // products/ solutions/ certifications/ client-logos/
  const dirMoves = [
    ['products', 'assets/images/products'],
    ['solutions', 'assets/images/solutions'],
    ['certifications', 'assets/images/certifications'],
    ['client-logos', 'assets/images/clients'],
  ];
  for (const [from, to] of dirMoves) {
    const srcDir = path.join(ROOT, from);
    if (!fs.existsSync(srcDir)) continue;
    for (const f of walk(srcDir)) {
      const sub = path.relative(srcDir, f);
      moveFile(f, path.join(ROOT, to, sub));
    }
    rm(srcDir);
  }

  console.log('Assets moved.');
}

function rewriteAssetPaths(content, depth) {
  // depth: 0 = root, 1 = en/ or ru/
  const prefix = depth === 0 ? '' : '../';
  let s = content;

  // CSS
  s = s.replace(/(href=["'])styles\.css(["'])/g, `$1${prefix}assets/css/styles.css$2`);
  s = s.replace(/(href=["'])tailwind\.min\.css(["'])/g, `$1${prefix}assets/css/tailwind.min.css$2`);

  // JS
  for (const js of ['lang-detect.js', 'factory-carousel.js', 'header.js', 'footer.js', 'footer-en.js', 'footer-ru.js']) {
    const re = new RegExp(`(src=["'])${js.replace('.', '\\.')}(["'])`, 'g');
    s = s.replace(re, `$1${prefix}assets/js/${js}$2`);
  }

  // Brand / hero images (bare filenames)
  const bare = [
    'logo.webp', 'logo.png', 'favicon.webp', 'favicon.png', 'wechat-service.png',
    'szgc1.png', 'hzgc2.jpg',
    'factory-hero.jpg', 'factory-hero.webp',
    'building-office.jpg', 'building-office.webp',
    'news-tech.jpg', 'news-tech.webp',
    'shipping-container.jpg', 'shipping-container.webp',
    'robot-arm.webp', 'robot-arm.jpg',
    'control-system.webp', 'control-system.jpg',
    'display-automation-line.webp', 'display-automation-line.jpg',
    'pkg-logistics-line.webp', 'pkg-logistics-line.jpg',
    'robot-unit.webp', 'robot-unit.jpg',
    'automation-line.webp', 'automation-line.jpg',
  ];
  for (const name of bare) {
    const folder = ['logo.webp', 'logo.png', 'favicon.webp', 'favicon.png', 'wechat-service.png'].includes(name)
      ? 'brand' : 'hero';
    // Avoid double-rewriting already rewritten paths
    const re = new RegExp(`(["'(])${name.replace('.', '\\.')}(["')])`, 'g');
    s = s.replace(re, (m, a, b) => {
      // skip if already has assets/
      return `${a}${prefix}assets/images/${folder}/${name}${b}`;
    });
  }

  // products/ solutions/ certifications/ client-logos/
  s = s.replace(/(["'(])products\//g, `$1${prefix}assets/images/products/`);
  s = s.replace(/(["'(])solutions\//g, `$1${prefix}assets/images/solutions/`);
  s = s.replace(/(["'(])certifications\//g, `$1${prefix}assets/images/certifications/`);
  s = s.replace(/(["'(])client-logos\//g, `$1${prefix}assets/images/clients/`);

  // Absolute /assets paths from JSON (when embedded) — keep as site-root absolute
  // For pages in en/ru, absolute /assets still works if site is at domain root.

  // Fix accidental double prefixes
  s = s.replace(/assets\/images\/(brand|hero)\/assets\/images\/\1\//g, 'assets/images/$1/');
  s = s.replace(/\.\.\/assets\/images\/(brand|hero)\/assets\/images\/\1\//g, '../assets/images/$1/');

  return s;
}

function rewriteLangLinks(content, lang) {
  // Convert foo-en.html -> en/foo.html, foo-ru.html -> ru/foo.html, foo.html stays for zh
  let s = content;

  if (lang === 'zh') {
    // Links to EN/RU pages
    s = s.replace(/href="([^"#?]+)-en\.html([^"]*)"/g, 'href="en/$1.html$2"');
    s = s.replace(/href="([^"#?]+)-ru\.html([^"]*)"/g, 'href="ru/$1.html$2"');
    // product-detail.html already covered
  } else if (lang === 'en') {
    // Within en/: links to other -en pages become sibling; zh pages become ../; ru become ../ru/
    s = s.replace(/href="([^"#?]+)-en\.html([^"]*)"/g, 'href="$1.html$2"');
    s = s.replace(/href="([^"#?]+)-ru\.html([^"]*)"/g, 'href="../ru/$1.html$2"');
    // bare zh pages (not already en/ru rewritten)
    s = s.replace(/href="((?:index|about|products|product-detail|solutions|solutions-detail|news|news-detail|contact|tv-display-solution|refrigerator-solution|washer-solution|tablet-solution|packaging-solution|robot-solution|ac-solution|capacitor-solution|coffee-solution|headlight-solution|microwave-solution)(?:-\d+)?)\.html([^"]*)"/g,
      'href="../$1.html$2"');
    // product-N.html language switches
    s = s.replace(/href="product-(\d+)\.html"/g, 'href="../product-detail.html?id=$1"');
  } else if (lang === 'ru') {
    s = s.replace(/href="([^"#?]+)-ru\.html([^"]*)"/g, 'href="$1.html$2"');
    s = s.replace(/href="([^"#?]+)-en\.html([^"]*)"/g, 'href="../en/$1.html$2"');
    s = s.replace(/href="((?:index|about|products|product-detail|solutions|solutions-detail|news|news-detail|contact|tv-display-solution|refrigerator-solution|washer-solution|tablet-solution|packaging-solution|robot-solution|ac-solution|capacitor-solution|coffee-solution|headlight-solution|microwave-solution)(?:-\d+)?)\.html([^"]*)"/g,
      'href="../$1.html$2"');
    s = s.replace(/href="product-(\d+)\.html"/g, 'href="../product-detail.html?id=$1"');
  }

  return s;
}

function stripInlineDataAndInjectLoader(content, type, lang) {
  // Remove huge const productData / solutionData / newsData blocks and inject fetch loader
  const dataVar = type === 'product' ? 'productData' : type === 'solution' ? 'solutionData' : 'newsData';
  const re = new RegExp(`const ${dataVar}\\s*=\\s*\\{[\\s\\S]*?\\};\\s*`, 'm');

  const depth = lang === 'zh' ? '' : '../';
  const dataPath = `${depth}data/${type === 'product' ? 'products' : type === 'solution' ? 'solutions' : 'news'}/${lang}.json`;

  const loader = `
        let ${dataVar} = {};
        async function __loadSiteData() {
            const res = await fetch('${dataPath}');
            ${dataVar} = await res.json();
        }
`;

  if (!re.test(content)) {
    // try inject before DOMContentLoaded if no data block found after previous run
    return content;
  }
  return content.replace(re, loader);
}

function wrapDomContentLoadedAsync(content, type) {
  // Make existing DOMContentLoaded wait for data load
  if (content.includes('__loadSiteData')) {
    // product-detail pattern
    if (type === 'product' || type === 'news') {
      content = content.replace(
        /document\.addEventListener\(["']DOMContentLoaded["'],\s*(?:function\s*\(\)\s*\{|async\s*function\s*\(\)\s*\{|\(\)\s*=>\s*\{)/,
        `document.addEventListener("DOMContentLoaded", async function() {
            await __loadSiteData();`
      );
    }
    if (type === 'solution') {
      // solutions-detail uses loadSolution() on DOMContentLoaded
      content = content.replace(
        /document\.addEventListener\(['"]DOMContentLoaded['"],\s*function\s*\(\)\s*\{\s*loadSolution\(\);/,
        `document.addEventListener('DOMContentLoaded', async function() {
            await __loadSiteData();
            loadSolution();`
      );
      // Also adapt loadSolution to use new field names if needed
    }
  }
  return content;
}

function adaptDetailFieldNames(content, type) {
  // JSON uses summary/contentHtml; old code uses .desc/.detail/.content/.cover
  if (type === 'product') {
    content = content.replace(/product\.desc\b/g, '(product.summary || product.desc)');
    content = content.replace(/product\.detail\b/g, '(product.contentHtml || product.detail)');
  }
  if (type === 'solution') {
    // solutions-detail zh uses data.desc, data.detail, data.features
    content = content.replace(/data\.desc\b/g, '(data.summary || data.desc)');
    content = content.replace(/data\.detail\b/g, '(data.contentHtml || data.detail)');
    content = content.replace(/data\.features\b/g, '(data.features || data.summary || data.desc)');
    // en solutions-detail uses solution.desc etc with product-* ids
    content = content.replace(/solution\.desc\b/g, '(solution.summary || solution.desc)');
    content = content.replace(/solution\.detail\b/g, '(solution.contentHtml || solution.detail)');
  }
  if (type === 'news') {
    content = content.replace(/news\.content\b/g, '(news.contentHtml || news.content)');
    content = content.replace(/news\.cover\b/g, '(news.cover)');
  }
  return content;
}

function processDetailPage(srcPath, destPath, type, lang) {
  let content = fs.readFileSync(srcPath, 'utf8');
  content = rewriteAssetPaths(content, lang === 'zh' ? 0 : 1);
  content = rewriteLangLinks(content, lang);
  content = stripInlineDataAndInjectLoader(content, type, lang);
  content = wrapDomContentLoadedAsync(content, type);
  content = adaptDetailFieldNames(content, type);

  // Fix product links from product-N.html to product-detail.html?id=N
  content = content.replace(/href="product-(\d+)(-en|-ru)?\.html"/g, (m, id, suffix) => {
    if (lang === 'zh') return `href="product-detail.html?id=${id}"`;
    if (lang === 'en') return `href="product-detail.html?id=${id}"`;
    return `href="product-detail.html?id=${id}"`;
  });

  // Update html lang attribute page links for language switcher on detail pages
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, content, 'utf8');
}

function processStaticPage(srcPath, destPath, lang) {
  let content = fs.readFileSync(srcPath, 'utf8');
  content = rewriteAssetPaths(content, lang === 'zh' ? 0 : 1);
  content = rewriteLangLinks(content, lang);

  // Redirect product-N links to detail
  if (lang === 'zh') {
    content = content.replace(/href="product-(\d+)\.html"/g, 'href="product-detail.html?id=$1"');
    content = content.replace(/href="product-(\d+)-en\.html"/g, 'href="en/product-detail.html?id=$1"');
    content = content.replace(/href="product-(\d+)-ru\.html"/g, 'href="ru/product-detail.html?id=$1"');
  }

  // client-logos already rewritten to assets/images/clients
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, content, 'utf8');
}

function listCorePages() {
  // Pages to keep (not product-N)
  const cores = [
    'index', 'about', 'products', 'product-detail',
    'solutions', 'solutions-detail',
    'news', 'news-detail', 'contact',
    'tv-display-solution', 'refrigerator-solution', 'washer-solution',
    'tablet-solution', 'packaging-solution', 'robot-solution',
    'ac-solution', 'capacitor-solution', 'coffee-solution',
    'headlight-solution', 'microwave-solution',
  ];
  return cores;
}

function reorganizePages() {
  console.log('\n== Reorganizing pages ==');
  ensureDir(path.join(ROOT, 'en'));
  ensureDir(path.join(ROOT, 'ru'));

  const cores = listCorePages();

  // Process ZH (in place via temp then replace)
  for (const base of cores) {
    const zh = path.join(ROOT, `${base}.html`);
    if (!fs.existsSync(zh)) continue;
    const tmp = path.join(ROOT, `${base}.html.__tmp`);
    if (base === 'product-detail') processDetailPage(zh, tmp, 'product', 'zh');
    else if (base === 'solutions-detail') processDetailPage(zh, tmp, 'solution', 'zh');
    else if (base === 'news-detail') processDetailPage(zh, tmp, 'news', 'zh');
    else processStaticPage(zh, tmp, 'zh');
    fs.renameSync(tmp, zh);
    console.log('ZH', base);
  }

  // Process EN -> en/base.html
  for (const base of cores) {
    const enSrc = path.join(ROOT, `${base}-en.html`);
    if (!fs.existsSync(enSrc)) continue;
    const dest = path.join(ROOT, 'en', `${base}.html`);
    if (base === 'product-detail') processDetailPage(enSrc, dest, 'product', 'en');
    else if (base === 'solutions-detail') processDetailPage(enSrc, dest, 'solution', 'en');
    else if (base === 'news-detail') processDetailPage(enSrc, dest, 'news', 'en');
    else processStaticPage(enSrc, dest, 'en');
    fs.unlinkSync(enSrc);
    console.log('EN', base);
  }

  // Process RU -> ru/base.html
  for (const base of cores) {
    const ruSrc = path.join(ROOT, `${base}-ru.html`);
    if (!fs.existsSync(ruSrc)) continue;
    const dest = path.join(ROOT, 'ru', `${base}.html`);
    if (base === 'product-detail') processDetailPage(ruSrc, dest, 'product', 'ru');
    else if (base === 'solutions-detail') processDetailPage(ruSrc, dest, 'solution', 'ru');
    else if (base === 'news-detail') processDetailPage(ruSrc, dest, 'news', 'ru');
    else processStaticPage(ruSrc, dest, 'ru');
    fs.unlinkSync(ruSrc);
    console.log('RU', base);
  }
}

function deleteLegacyProductPages() {
  console.log('\n== Deleting legacy product-N pages ==');
  let n = 0;
  for (const f of fs.readdirSync(ROOT)) {
    if (/^product-\d+(-en|-ru)?\.html$/i.test(f)) {
      fs.unlinkSync(path.join(ROOT, f));
      n++;
    }
  }
  console.log('Deleted', n, 'product-N pages');
}

function writeLangDetect() {
  const code = `/**
 * Language preference: browser / localStorage → / /en/ /ru/
 */
(function () {
  var STORAGE_KEY = 'txam-lang-pref';

  function currentLang() {
    var path = location.pathname.replace(/\\\\/g, '/');
    if (/\\/en(\\/|$)/i.test(path)) return 'en';
    if (/\\/ru(\\/|$)/i.test(path)) return 'ru';
    return 'zh';
  }

  function pageBase() {
    var path = location.pathname.replace(/\\\\/g, '/');
    var parts = path.split('/').filter(Boolean);
    var last = parts[parts.length - 1] || 'index.html';
    if (!/\\.html$/i.test(last)) last = 'index.html';
    // strip lang segment from consideration
    return last;
  }

  function targetUrl(lang) {
    var page = pageBase();
    var search = location.search || '';
    var hash = location.hash || '';
    if (lang === 'zh') return '/' + page + search + hash;
    return '/' + lang + '/' + page + search + hash;
  }

  function detectBrowserLang() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase();
      if (code.indexOf('zh') === 0) return 'zh';
      if (code.indexOf('ru') === 0) return 'ru';
    }
    return 'en';
  }

  // Manual language clicks: remember preference
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/\\/en\\//.test(href) || /(?:^|\\/)en\\//.test(href)) {
      try { localStorage.setItem(STORAGE_KEY, 'en'); } catch (err) {}
    } else if (/\\/ru\\//.test(href)) {
      try { localStorage.setItem(STORAGE_KEY, 'ru'); } catch (err) {}
    } else if (/\\.html/.test(href) && !/\\/(en|ru)\\//.test(href) && a.textContent && /ZH|中文/.test(a.textContent.trim())) {
      try { localStorage.setItem(STORAGE_KEY, 'zh'); } catch (err) {}
    }
  }, true);

  // Auto-redirect only on first visit (no preference) from root index-like pages
  try {
    var pref = localStorage.getItem(STORAGE_KEY);
    var here = currentLang();
    if (!pref) {
      var detected = detectBrowserLang();
      if (detected !== here && (pageBase() === 'index.html' || pageBase() === '')) {
        localStorage.setItem(STORAGE_KEY, detected);
        location.replace(targetUrl(detected));
      }
    } else if (pref !== here && (pageBase() === 'index.html')) {
      // Respect saved preference on homepage only
      // location.replace(targetUrl(pref)); // disabled aggressive redirect; preference used on click
    }
  } catch (err) {}
})();
`;
  fs.writeFileSync(path.join(ROOT, 'assets/js/lang-detect.js'), code, 'utf8');
}

function writeRedirects() {
  console.log('\n== Writing redirects ==');

  // IIS web.config merge - read existing or create
  const webConfig = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Legacy language suffix → /en/ /ru/ -->
        <rule name="Legacy EN suffix" stopProcessing="true">
          <match url="^(.+)-en\\.html$" />
          <action type="Redirect" url="/en/{R:1}.html" redirectType="Permanent" />
        </rule>
        <rule name="Legacy RU suffix" stopProcessing="true">
          <match url="^(.+)-ru\\.html$" />
          <action type="Redirect" url="/ru/{R:1}.html" redirectType="Permanent" />
        </rule>
        <!-- Legacy static product pages → product-detail -->
        <rule name="Legacy product ZH" stopProcessing="true">
          <match url="^product-(\\d+)\\.html$" />
          <action type="Redirect" url="/product-detail.html?id={R:1}" redirectType="Permanent" />
        </rule>
        <rule name="Legacy product EN" stopProcessing="true">
          <match url="^product-(\\d+)-en\\.html$" />
          <action type="Redirect" url="/en/product-detail.html?id={R:1}" redirectType="Permanent" />
        </rule>
        <rule name="Legacy product RU" stopProcessing="true">
          <match url="^product-(\\d+)-ru\\.html$" />
          <action type="Redirect" url="/ru/product-detail.html?id={R:1}" redirectType="Permanent" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".webp" />
      <mimeMap fileExtension=".webp" mimeType="image/webp" />
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
</configuration>
`;
  fs.writeFileSync(path.join(ROOT, 'web.config'), webConfig, 'utf8');

  const nginx = `# TXAM site nginx snippet
server {
    listen 80;
    server_name www.sztxgk.com sztxgk.com;
    root /var/www/tongxing;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Legacy -en / -ru
    rewrite ^/(.+)-en\\.html$ /en/$1.html permanent;
    rewrite ^/(.+)-ru\\.html$ /ru/$1.html permanent;

    # Legacy product-N
    rewrite ^/product-(\\d+)\\.html$ /product-detail.html?id=$1 permanent;
    rewrite ^/product-(\\d+)-en\\.html$ /en/product-detail.html?id=$1 permanent;
    rewrite ^/product-(\\d+)-ru\\.html$ /ru/product-detail.html?id=$1 permanent;

    location ~* \\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|json)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
`;
  fs.writeFileSync(path.join(ROOT, 'nginx.conf'), nginx, 'utf8');

  const htaccess = `RewriteEngine On

# Legacy language suffixes
RewriteRule ^(.+)-en\\.html$ /en/$1.html [R=301,L]
RewriteRule ^(.+)-ru\\.html$ /ru/$1.html [R=301,L]

# Legacy product pages
RewriteRule ^product-([0-9]+)\\.html$ /product-detail.html?id=$1 [R=301,L,QSA]
RewriteRule ^product-([0-9]+)-en\\.html$ /en/product-detail.html?id=$1 [R=301,L,QSA]
RewriteRule ^product-([0-9]+)-ru\\.html$ /ru/product-detail.html?id=$1 [R=301,L,QSA]
`;
  fs.writeFileSync(path.join(ROOT, '.htaccess'), htaccess, 'utf8');
}

function writeSitemap() {
  const pages = [
    'index.html', 'about.html', 'products.html', 'solutions.html',
    'news.html', 'contact.html', 'product-detail.html', 'solutions-detail.html', 'news-detail.html',
    'tv-display-solution.html', 'packaging-solution.html', 'robot-solution.html',
  ];
  let urls = '';
  for (const p of pages) {
    urls += `  <url><loc>https://www.sztxgk.com/${p}</loc><changefreq>weekly</changefreq></url>\n`;
    urls += `  <url><loc>https://www.sztxgk.com/en/${p}</loc><changefreq>weekly</changefreq></url>\n`;
    urls += `  <url><loc>https://www.sztxgk.com/ru/${p}</loc><changefreq>weekly</changefreq></url>\n`;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
}

function writeServerStub() {
  console.log('\n== Writing server stubs ==');
  ensureDir(path.join(ROOT, 'server/routes'));
  ensureDir(path.join(ROOT, 'server/schema'));

  fs.writeFileSync(path.join(ROOT, 'server/README.md'), `# TXAM Backend (planned)

Static site currently serves JSON from \`/data/*.json\`.
Backend should expose the same shapes via REST so front-end only changes the fetch base URL.

## Planned API

\`\`\`
GET  /api/v1/products?lang=zh
GET  /api/v1/products/:id?lang=zh
GET  /api/v1/solutions?lang=zh
GET  /api/v1/solutions/:id?lang=zh
GET  /api/v1/news?lang=zh&page=1
GET  /api/v1/news/:id?lang=zh
POST /api/v1/contact
\`\`\`

## Data contract

See \`../data/schema/product.schema.json\` and mirror for solutions/news.
Translation pattern:

| Table | Purpose |
|-------|---------|
| products | id, slug, category_key, model, image, published, updated_at |
| product_translations | product_id, lang, name, summary, content_html, specs_json |
| solutions / solution_translations | same pattern |
| news / news_translations | same pattern |
| contact_messages | name, email, phone, company, message, created_at |

## Migration path

1. Import \`data/**/*.json\` into DB
2. Point \`assets/js/pages/*.js\` (or inline loaders) to \`/api/v1\`
3. Keep static HTML shells until SSR/CMS is ready
`, 'utf8');

  fs.writeFileSync(path.join(ROOT, 'server/schema/tables.sql'), `-- TXAM schema draft (PostgreSQL / MySQL compatible ideas)

CREATE TABLE products (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128),
  category_key VARCHAR(64),
  model VARCHAR(128),
  image VARCHAR(512),
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_translations (
  product_id VARCHAR(32) REFERENCES products(id),
  lang CHAR(2) NOT NULL,
  name VARCHAR(256) NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json TEXT,
  PRIMARY KEY (product_id, lang)
);

CREATE TABLE solutions (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128),
  category_key VARCHAR(64),
  image VARCHAR(512),
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE solution_translations (
  solution_id VARCHAR(32) REFERENCES solutions(id),
  lang CHAR(2) NOT NULL,
  name VARCHAR(256) NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json TEXT,
  pain_points_json TEXT,
  process_json TEXT,
  PRIMARY KEY (solution_id, lang)
);

CREATE TABLE news (
  id VARCHAR(32) PRIMARY KEY,
  cover VARCHAR(512),
  published BOOLEAN DEFAULT TRUE,
  published_at DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_translations (
  news_id VARCHAR(32) REFERENCES news(id),
  lang CHAR(2) NOT NULL,
  category VARCHAR(64),
  title VARCHAR(512) NOT NULL,
  content_html TEXT,
  PRIMARY KEY (news_id, lang)
);

CREATE TABLE contact_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128),
  email VARCHAR(256),
  phone VARCHAR(64),
  company VARCHAR(256),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`, 'utf8');

  fs.writeFileSync(path.join(ROOT, 'server/routes/api.example.js'), `/**
 * Example Express routes — not wired. Swap fetch URLs when backend is live.
 */
// const express = require('express');
// const router = express.Router();
//
// router.get('/products', async (req, res) => {
//   const lang = req.query.lang || 'zh';
//   // load from DB using product_translations
//   res.json(products);
// });
//
// router.get('/products/:id', async (req, res) => {
//   const lang = req.query.lang || 'zh';
//   res.json(product);
// });
//
// module.exports = router;
`, 'utf8');
}

function writePackageJson() {
  fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify({
    name: 'txam-website',
    version: '2.0.0',
    private: true,
    description: 'TXAM corporate site — static front + JSON data layer',
    scripts: {
      'extract-data': 'node scripts/extract-content-data.js',
      restructure: 'node scripts/restructure-site.js',
      validate: 'node scripts/validate-data.js'
    }
  }, null, 2), 'utf8');
}

function writeValidate() {
  const code = `const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let ok = true;
for (const kind of ['products', 'solutions', 'news']) {
  for (const lang of ['zh', 'en', 'ru']) {
    const p = path.join(root, 'data', kind, lang + '.json');
    if (!fs.existsSync(p)) { console.error('MISSING', p); ok = false; continue; }
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(kind, lang, Object.keys(data).length, 'items');
  }
}
process.exit(ok ? 0 : 1);
`;
  ensureDir(path.join(ROOT, 'scripts'));
  fs.writeFileSync(path.join(ROOT, 'scripts/validate-data.js'), code, 'utf8');
}

function writeReadme() {
  fs.writeFileSync(path.join(ROOT, 'README.md'), `# 同兴高科 TXAM Website

## Structure

\`\`\`
├── index.html, about.html, …     # Chinese pages (site root)
├── en/                           # English pages
├── ru/                           # Russian pages
├── assets/
│   ├── css/
│   ├── js/
│   └── images/{brand,hero,products,solutions,certifications,clients}
├── data/
│   ├── products/{zh,en,ru}.json
│   ├── solutions/{zh,en,ru}.json
│   ├── news/{zh,en,ru}.json
│   ├── i18n/
│   └── schema/
├── scripts/                      # Dev tooling (not required at runtime)
└── server/                       # Backend API plan + SQL draft
\`\`\`

## Content edits

- Products / solutions / news: edit \`data/**/*.json\`
- Layout / copy in static shells: edit the corresponding HTML under \`/\`, \`/en/\`, \`/ru/\`
- Styles: \`assets/css/styles.css\`

## Deploy

Upload the whole repo **except** \`.git/\` and optionally \`scripts/\` + \`server/\` (or include \`server/\` docs only).

Ensure the server serves \`data/*.json\` as \`application/json\` (already configured in \`web.config\`).

## Backend path

See \`server/README.md\`. Front-end detail pages already \`fetch\` JSON — point them at \`/api/v1\` when ready.
`, 'utf8');
}

function fixFooterPaths() {
  // footer.js references wechat-service.png and logo — update
  for (const name of ['footer.js', 'footer-en.js', 'footer-ru.js', 'header.js', 'factory-carousel.js']) {
    const p = path.join(ROOT, 'assets/js', name);
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/(["'])wechat-service\.png(["'])/g, "$1/assets/images/brand/wechat-service.png$2");
    s = s.replace(/(["'])logo\.webp(["'])/g, "$1/assets/images/brand/logo.webp$2");
    s = s.replace(/(["'])logo\.png(["'])/g, "$1/assets/images/brand/logo.png$2");
    // header links may need to stay relative - leave for now
    fs.writeFileSync(p, s, 'utf8');
  }
}

function main() {
  console.log('TXAM full restructure starting…');
  moveAssets();
  reorganizePages();
  deleteLegacyProductPages();
  writeLangDetect();
  fixFooterPaths();
  writeRedirects();
  writeSitemap();
  writeServerStub();
  writePackageJson();
  writeValidate();
  writeReadme();
  console.log('\nDone.');
}

main();
