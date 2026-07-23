/**
 * Add site-seo.js to all public HTML pages (after data-loader.js).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tag = 'assets/js/site-seo.js';
const tagEn = '../assets/js/site-seo.js';
const loader = 'assets/js/data-loader.js';
const loaderEn = '../assets/js/data-loader.js';

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'vendor' || name === 'admin') continue;
      walk(p, files);
    } else if (name.endsWith('.html')) files.push(p);
  }
  return files;
}

let patched = 0;
for (const file of walk(root)) {
  if (file.includes(`${path.sep}server${path.sep}`)) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('site-seo.js')) continue;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const isLang = rel.startsWith('en/') || rel.startsWith('ru/');
  const seoTag = isLang ? tagEn : tag;
  const loaderTag = isLang ? loaderEn : loader;
  if (!html.includes(loaderTag)) continue;
  html = html.replace(
    `<script src="${loaderTag}"></script>`,
    `<script src="${loaderTag}"></script>\n    <script src="${seoTag}"></script>`
  );
  fs.writeFileSync(file, html);
  patched += 1;
  console.log('patched', rel);
}
console.log('done', patched);
