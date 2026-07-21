/**
 * Patch HTML pages: inject site-nav.js + site-common.js; add list hero ids;
 * strip duplicate inline AMap init (contact-page.js owns map).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'server' || name === '_backups' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function injectScript(html, relativeFromPage, scriptFile) {
  const tag = `<script src="${relativeFromPage}${scriptFile}"></script>`;
  if (html.includes(scriptFile)) return html;
  if (html.includes('data-loader.js')) {
    return html.replace(
      /(<script[^>]*data-loader\.js[^>]*><\/script>)/,
      `$1\n  <script src="${relativeFromPage}${scriptFile}"></script>`
    );
  }
  if (html.includes('site-footer.js')) {
    return html.replace(
      /(<script[^>]*site-footer\.js[^>]*><\/script>)/,
      `<script src="${relativeFromPage}${scriptFile}"></script>\n  $1`
    );
  }
  return html;
}

function relAssets(file) {
  const rel = path.relative(path.dirname(file), path.join(ROOT, 'assets', 'js')).replace(/\\/g, '/');
  return rel.endsWith('/') ? rel : rel + '/';
}

function patchHero(html, file) {
  const base = path.basename(file);
  if (!/^(products|news|solutions)\.html$/.test(base) && !/\/(en|ru)\/(products|news|solutions)\.html$/.test(file.replace(/\\/g, '/'))) {
    // also match en/products.html via basename in en/
    if (!['products.html', 'news.html', 'solutions.html'].includes(base)) return html;
  }
  // First h1 in hero-ish section
  if (!html.includes('id="list-hero-title"')) {
    html = html.replace(
      /(<h1[^>]*class="[^"]*hero-title[^"]*"[^>]*>)([\s\S]*?)(<\/h1>)/,
      '$1<span id="list-hero-title">$2</span>$3'
    );
    // if nested span already weird, skip double
  }
  if (!html.includes('id="list-hero-lead"')) {
    html = html.replace(
      /(<p[^>]*class="[^"]*text-lead[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/,
      (m, a, b, c) => (html.includes('id="list-hero-lead"') ? m : `${a}<span id="list-hero-lead">${b}</span>${c}`)
    );
  }
  return html;
}

function stripContactInlineMap(html, file) {
  if (!/contact\.html$/.test(file.replace(/\\/g, '/'))) return html;
  // Keep AMap script tag; remove inline init block that creates AMap.Map
  return html.replace(
    /<script>\s*document\.addEventListener\(['"]DOMContentLoaded['"][\s\S]*?new AMap\.Map[\s\S]*?<\/script>/,
    '<!-- map init: contact-page.js -->'
  );
}

let n = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  const rel = relAssets(file);
  html = injectScript(html, rel, 'site-nav.js');
  html = injectScript(html, rel, 'site-common.js');
  html = patchHero(html, file);
  html = stripContactInlineMap(html, file);
  if (html !== before) {
    fs.writeFileSync(file, html);
    n++;
    console.log('patched', path.relative(ROOT, file));
  }
}
console.log('done', n, 'files');
