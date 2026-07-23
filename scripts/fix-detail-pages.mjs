/**
 * Patch detail pages: slug support for solutions-detail, escapeHtml on metadata fields.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DETAIL_FILES = [
  'product-detail.html',
  'en/product-detail.html',
  'ru/product-detail.html',
  'news-detail.html',
  'en/news-detail.html',
  'ru/news-detail.html',
  'solutions-detail.html',
  'en/solutions-detail.html',
  'ru/solutions-detail.html',
];

function patchSolutionsDetail(html, lang) {
  if (!html.includes('getUrlParameter(\'id\')') && !html.includes('getUrlParameter("id")')) {
    // en version uses params.get('id')
    html = html.replace(
      /var id = params\.get\('id'\) \|\| '31';/,
      `var id = (await TXAM.resolveCatalogId('solutions', '${lang}', params)) || params.get('id') || '31';`
    );
  }
  if (html.includes('getUrlParameter')) {
    html = html.replace(
      /async function loadSolution\(solutionData\) \{\s*var solutionId = getUrlParameter\('id'\) \|\| '31';/,
      `async function loadSolution(solutionData) {
            var params = new URLSearchParams(window.location.search);
            var solutionId = (await TXAM.resolveCatalogId('solutions', '${lang}', params)) || params.get('id') || '31';`
    );
    html = html.replace(/\s*function getUrlParameter\(name\) \{[\s\S]*?\}\s*/g, '\n');
  }

  html = html.replace(
    /\+ p\.title \+/g,
    '+ TXAM.escapeHtml(p.title) +'
  ).replace(
    /\+ p\.desc \+/g,
    '+ TXAM.escapeHtml(p.desc) +'
  ).replace(
    /\+ p\.step \+/g,
    '+ TXAM.escapeHtml(p.step) +'
  );

  html = html.replace(
    /\.sort\(function \(\) \{ return Math\.random\(\) - 0\.5; \}\)/g,
    '/* pickRandom */'
  );
  html = html.replace(
    /Object\.keys\(solutionData\)\.filter\(function \(id\) \{ return id !== solutionId && TXAM\.isCatalogPublished\(solutionData\[id\]\); \}\)\s*\/\* pickRandom \*\/\s*\.slice\(0, 3\)/g,
    'TXAM.pickRandomKeys(Object.keys(solutionData).filter(function (id) { return id !== solutionId && TXAM.isCatalogPublished(solutionData[id]); }), 3, solutionId)'
  );

  html = html.replace(
    /item\.name \+/g,
    'TXAM.escapeHtml(item.name) +'
  ).replace(
    /\(item\.summary \|\| item\.desc \|\| ''\)/g,
    'TXAM.escapeHtml(item.summary || item.desc || \'\')'
  );

  return html;
}

function patchProductDetail(html) {
  html = html.replace(
    /return '<span class="spec-tag">' \+ spec \+ '<\/span>';/g,
    "return '<span class=\"spec-tag\">' + TXAM.escapeHtml(spec) + '</span>';"
  );
  html = html.replace(
    /alt="' \+ p\.name \+'"/g,
    'alt="\' + TXAM.escapeHtml(p.name) + \'"'
  ).replace(
    /' \+ p\.model \+ '/g,
    "' + TXAM.escapeHtml(p.model) + '"
  ).replace(
    /' \+ p\.name \+ '/g,
    "' + TXAM.escapeHtml(p.name) + '"
  );
  return html;
}

function patchNewsDetail(html) {
  html = html.replace(
    /' \+ item\.category \+ '/g,
    "' + TXAM.escapeHtml(item.category) + '"
  ).replace(
    /alt="' \+ item\.title \+ '"/g,
    'alt="\' + TXAM.escapeHtml(item.title) + \'"'
  ).replace(
    /' \+ item\.title \+ '/g,
    "' + TXAM.escapeHtml(item.title) + '"
  ).replace(
    /' \+ item\.date \+ '/g,
    "' + TXAM.escapeHtml(item.date) + '"
  );
  return html;
}

for (const rel of DETAIL_FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  const orig = html;
  const lang = rel.startsWith('en/') ? 'en' : rel.startsWith('ru/') ? 'ru' : 'zh';

  if (rel.includes('solutions-detail')) html = patchSolutionsDetail(html, lang);
  if (rel.includes('product-detail')) html = patchProductDetail(html);
  if (rel.includes('news-detail')) html = patchNewsDetail(html);

  if (!html.includes('site-chrome.js')) {
    const prefix = lang === 'zh' ? '' : '../';
    html = html.replace(
      /(<script src="[^"]*site-common\.js"><\/script>)/,
      `$1\n  <script src="${prefix}assets/js/site-chrome.js"></script>`
    );
  }

  if (html !== orig) {
    fs.writeFileSync(fp, html, 'utf8');
    console.log('patched', rel);
  }
}

console.log('done');
