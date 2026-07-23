/**
 * Batch HTML fixes: site-chrome.js, remove inline scroll, solutions filters, a11y headings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function listHtmlFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'admin') continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) listHtmlFiles(fp, acc);
    else if (name.endsWith('.html') && !fp.includes(`${path.sep}server${path.sep}`)) acc.push(fp);
  }
  return acc;
}

function rel(fp) {
  return path.relative(ROOT, fp).replace(/\\/g, '/');
}

function patchChrome(html, prefix) {
  const chromeSrc = `${prefix}assets/js/site-chrome.js`;
  if (!html.includes('site-chrome.js')) {
    html = html.replace(
      /(<script src="[^"]*site-common\.js"><\/script>)/,
      `$1\n  <script src="${chromeSrc}"></script>`
    );
  }

  // Remove inline navbar scroll blocks (site-chrome handles this)
  html = html.replace(
    /\s*const navbar = document\.getElementById\(['"]navbar['"]\);\s*window\.addEventListener\(['"]scroll['"],[\s\S]*?\}\);\s*/g,
    '\n            '
  );

  return html;
}

function patchLogo(html, prefix) {
  const home = prefix ? 'index.html' : 'index.html';
  // div wrapper → a
  html = html.replace(
    /<div class="flex items-center cursor-pointer relative z-50">\s*(<picture[\s\S]*?<\/picture>)\s*<\/div>/g,
    `<a href="${home}" class="flex items-center cursor-pointer relative z-50" aria-label="TXAM Home">$1</a>`
  );
  html = html.replace(/\s*onclick="location\.href='[^']*'"/g, '');
  return html;
}

function patchMobileMenuAria(html) {
  if (html.includes('id="mobile-menu-btn"') && !html.includes('mobile-menu-btn" aria-label')) {
    html = html.replace(
      /<button id="mobile-menu-btn" class="([^"]*)">/,
      '<button id="mobile-menu-btn" class="$1" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">'
    );
  }
  return html;
}

function patchPillarHeadings(html) {
  // Hero pillar cards: h3 → h2 (page already has h1)
  return html.replace(
    /(<div class="[^"]*bg-gray-50 border border-gray-200 radius-lg p-8">\s*<div class="w-12 h-12[^>]*>[\s\S]*?<\/div>\s*)<h3 class="font-bold/g,
    '$1<h2 class="font-bold'
  ).replace(
    /(<h2 class="font-bold text-\[#1D1D1F\] mb-2">[^<]*<\/h3>)/g,
    (m) => m.replace('</h3>', '</h2>')
  );
}

function patchSolutionsFilters(html, fileRel) {
  if (!fileRel.endsWith('solutions.html')) return html;
  if (html.includes('id="solutions-filter-bar"')) return html;
  const block = `
    <!-- Solution category filters -->
    <section id="filter-section" class="pb-4 md:pb-10 px-4 md:px-24 sticky top-[72px] md:top-[122px] z-40 bg-[#FBFBFD]/95 backdrop-blur-sm pt-4 left-0 right-0 border-b border-[#E5E5EA]/60">
        <div class="max-w-[1400px] mx-auto flex flex-wrap justify-start md:justify-center gap-2 pb-2" id="solutions-filter-bar"></div>
    </section>
`;
  return html.replace(
    /(\s*<!-- P2\. Solutions matrix[\s\S]*?<section class="py-20 bg-white">)/,
    block + '$1'
  );
}

function patchInitSolutions(html) {
  return html.replace(
    /TXAM\.initSolutionsList\(\{ lang: ["'](\w+)["'] \}\);/g,
    'TXAM.initSolutionsList({ lang: "$1" });'
  ).replace(
    /document\.addEventListener\(["']DOMContentLoaded["'],\s*function\s*\(\)\s*\{\s*TXAM\.initSolutionsList/g,
    'document.addEventListener("DOMContentLoaded", function() {\n            TXAM.initSolutionsList'
  );
}

const files = listHtmlFiles(ROOT);
let count = 0;

for (const fp of files) {
  const fileRel = rel(fp);
  if (fileRel.startsWith('server/')) continue;

  let html = fs.readFileSync(fp, 'utf8');
  const orig = html;
  const prefix = fileRel.startsWith('en/') || fileRel.startsWith('ru/') ? '../' : '';

  html = patchChrome(html, prefix);
  html = patchLogo(html, prefix);
  html = patchMobileMenuAria(html);
  html = patchPillarHeadings(html);
  html = patchSolutionsFilters(html, fileRel);
  html = patchInitSolutions(html);

  // index.html: add site-chrome after header.js path
  if (fileRel === 'index.html' && !html.includes('site-chrome.js')) {
    html = html.replace(
      /(<script src="assets\/js\/header\.js" defer><\/script>)/,
      '$1\n    <script src="assets/js/site-chrome.js"></script>'
    );
  }

  if (html !== orig) {
    fs.writeFileSync(fp, html, 'utf8');
    console.log('patched', fileRel);
    count++;
  }
}

console.log(`Done. ${count} HTML files updated.`);
