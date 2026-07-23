/**
 * Batch front-end performance patches:
 * - charset before scripts; defer lang-detect
 * - LCP heroes: remove lazy, add fetchpriority
 * - nav logo: remove lazy
 * - product-detail: drop wrong static preload
 * - zh pages: preload Noto font
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkHtml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'server' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(p, acc);
    else if (entry.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function patchHeadOrder(html) {
  if (!html.includes('lang-detect.js')) return html;
  return html.replace(
    /<script src="([^"]*lang-detect\.js)"><\/script>\s*\n\s*<meta charset="UTF-8">/,
    '<meta charset="UTF-8">\n    <script defer src="$1"></script>'
  );
}

function patchFontPreload(html, relPrefix) {
  if (html.includes('noto-sans-sc-site.woff2')) return html;
  if (!html.includes('lang="zh')) return html;
  const href = relPrefix + 'assets/fonts/noto-sans-sc-site.woff2';
  return html.replace(
    /(<meta charset="UTF-8">)/,
    `$1\n    <link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`
  );
}

function patchLcpHero(html) {
  return html.replace(
    /(<div class="[^"]*media-h-detail[^"]*"[\s\S]*?<img)\s+loading="lazy"\s+decoding="async"/g,
    '$1 decoding="async" fetchpriority="high"'
  );
}

function patchNavLogo(html) {
  return html.replace(
    /(<nav[^>]*>[\s\S]*?<picture>[\s\S]*?<img)\s+loading="lazy"\s+decoding="async"/,
    '$1 decoding="async"'
  );
}

function patchProductDetailPreload(html, file) {
  if (!file.endsWith('product-detail.html')) return html;
  return html.replace(
    /\s*<link rel="preload" as="image" href="[^"]*robot-arm\.webp"[^>]*>\s*\n/,
    '\n'
  );
}

function relPrefix(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth ? '../'.repeat(depth) : '';
}

const files = walkHtml(root).filter((f) => !f.includes(`${path.sep}server${path.sep}`));
let changed = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = patchHeadOrder(html);
  html = patchFontPreload(html, relPrefix(file));
  html = patchLcpHero(html);
  html = patchNavLogo(html);
  html = patchProductDetailPreload(html, file);
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
    console.log('patched', path.relative(root, file));
  }
}

console.log(`Done. ${changed} HTML files updated.`);
