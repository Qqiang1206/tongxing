/**
 * Guard detail pages against unpublished catalog items (published flag from zh data).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DETAIL_PAGES = [
  'product-detail.html',
  'en/product-detail.html',
  'ru/product-detail.html',
  'news-detail.html',
  'en/news-detail.html',
  'ru/news-detail.html',
  'en/solutions-detail.html',
];

function patchProductOrNews(html, kind) {
  const varName = kind === 'products' ? 'product' : 'news';
  const dataName = kind === 'products' ? 'productData' : 'newsData';
  const fallbackRe = new RegExp(
    `if \\(!${varName}\\) ${varName} = ${dataName}\\[id\\] \\|\\| ${dataName}\\['\\d+'\\];`
  );
  if (fallbackRe.test(html)) {
    html = html.replace(
      fallbackRe,
      `if (!${varName}) ${varName} = ${dataName}[id];\n            ${varName} = TXAM.guardPublishedCatalogItem(${varName}, '${kind}');`
    );
  }
  const relatedVar = kind === 'products' ? 'pid' : 'nid';
  const relatedFilter = `.filter(function (${relatedVar}) { return ${relatedVar} !== id; })`;
  const publishedFilter = `.filter(function (${relatedVar}) { return TXAM.isCatalogPublished(${dataName}[${relatedVar}]); })`;
  if (html.includes(relatedFilter) && !html.includes(publishedFilter)) {
    html = html.replace(relatedFilter, relatedFilter + '\n                    ' + publishedFilter);
  }
  if (kind === 'products') {
    const catFilter = `.filter(function (pid) { return productData[pid].category === product.category; })`;
    const catPublished = `.filter(function (pid) { return TXAM.isCatalogPublished(productData[pid]) && productData[pid].category === product.category; })`;
    if (html.includes(catFilter) && !html.includes('isCatalogPublished(productData[pid]) && productData[pid].category')) {
      html = html.replace(catFilter, catPublished);
    }
  }
  return html;
}

function patchEnSolution(html) {
  const re = /if \(!solution\) solution = solutionData\[id\] \|\| solutionData\['31'\];/;
  if (re.test(html)) {
    html = html.replace(
      re,
      "if (!solution) solution = solutionData[id];\n            solution = TXAM.guardPublishedCatalogItem(solution, 'solutions');"
    );
  }
  const relatedRe = /\.filter\(function \(sid\) \{ return sid !== id; \}\)/;
  if (relatedRe.test(html) && !html.includes('isCatalogPublished(solutionData[sid])')) {
    html = html.replace(
      relatedRe,
      ".filter(function (sid) { return sid !== id && TXAM.isCatalogPublished(solutionData[sid]); })"
    );
  }
  return html;
}

function patchZhRuSolution(html, rel) {
  const listHref = rel.startsWith('en/') || rel.startsWith('ru/') ? '../solutions.html' : 'solutions.html';
  const guard = `            if (!TXAM.guardPublishedCatalogItem(data, 'solutions')) return;\n\n`;
  if (html.includes(guard.trim())) return html;
  return html.replace(
    /if \(!data\) \{\n\s+console\.error\('Solution not found:'/,
    guard + "            if (!data) {\n                console.error('Solution not found:'"
  );
}

for (const rel of DETAIL_PAGES) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  if (rel.includes('product-detail')) html = patchProductOrNews(html, 'products');
  else if (rel.includes('news-detail')) html = patchProductOrNews(html, 'news');
  else if (rel.includes('solutions-detail')) html = patchEnSolution(html);
  fs.writeFileSync(file, html);
  console.log('patched', rel);
}

for (const rel of ['solutions-detail.html', 'ru/solutions-detail.html']) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  html = patchZhRuSolution(html, rel);
  // Also add guard after loadCatalogItem path
  if (html.includes('loadCatalogItem') && !html.includes('guardPublishedCatalogItem(data')) {
    html = html.replace(
      /if \(!data\) data = solutionData\[solutionId\];/,
      "if (!data) data = solutionData[solutionId];\n            if (!TXAM.guardPublishedCatalogItem(data, 'solutions')) return;"
    );
  }
  const relatedRe = /Object\.keys\(solutionData\)\.filter\(function \(id\) \{ return id !== solutionId; \}\)/;
  if (relatedRe.test(html) && !html.includes('isCatalogPublished(solutionData[id])')) {
    html = html.replace(
      relatedRe,
      "Object.keys(solutionData).filter(function (id) { return id !== solutionId && TXAM.isCatalogPublished(solutionData[id]); })"
    );
  }
  fs.writeFileSync(file, html);
  console.log('patched', rel);
}

console.log('done');
