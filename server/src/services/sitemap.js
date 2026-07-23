import fs from 'fs';
import path from 'path';
import { REPO_ROOT } from '../config.js';

const DEFAULT_BASE = 'https://www.sztxgk.com';
const STATIC_SOLUTION_SLUGS = new Set([
  'tv-display', 'refrigerator', 'packaging', 'washer', 'capacitor',
  'ac', 'microwave', 'coffee', 'tablet', 'headlight', 'robot',
]);
const STATIC_PAGES = [
  'index.html', 'about.html', 'products.html', 'solutions.html', 'news.html', 'contact.html',
];
const LANGS = ['zh', 'en', 'ru'];

function loadCatalog(kind) {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'data', kind, 'zh.json'), 'utf8')
  );
}

function langPrefix(lang) {
  return lang === 'zh' ? '' : `${lang}/`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, changefreq, priority) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    priority ? `    <priority>${priority}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n');
}

function solutionPath(item, id) {
  const slug = String(item.slug || '');
  const staticFile = slug && STATIC_SOLUTION_SLUGS.has(slug)
    ? path.join(REPO_ROOT, `${slug}-solution.html`)
    : '';
  if (staticFile && fs.existsSync(staticFile)) return `${slug}-solution.html`;
  return `solutions-detail.html?id=${encodeURIComponent(id)}`;
}

export function generateSitemap({ base = process.env.SITEMAP_BASE || DEFAULT_BASE } = {}) {
  const siteBase = String(base || DEFAULT_BASE).replace(/\/$/, '');
  const products = loadCatalog('products');
  const news = loadCatalog('news');
  const solutions = loadCatalog('solutions');
  const urls = [];

  for (const lang of LANGS) {
    const prefix = langPrefix(lang);
    for (const page of STATIC_PAGES) {
      urls.push(urlEntry(`${siteBase}/${prefix}${page}`, 'weekly', page === 'index.html' ? '1.0' : '0.8'));
    }

    for (const id of Object.keys(products)) {
      const item = products[id];
      if (!item || item.published === false || item.showInList === false) continue;
      urls.push(urlEntry(`${siteBase}/${prefix}product-detail.html?id=${encodeURIComponent(id)}`, 'weekly', '0.6'));
    }

    for (const id of Object.keys(news)) {
      const item = news[id];
      if (!item || item.published === false) continue;
      urls.push(urlEntry(`${siteBase}/${prefix}news-detail.html?id=${encodeURIComponent(id)}`, 'weekly', '0.5'));
    }

    for (const id of Object.keys(solutions)) {
      const item = solutions[id];
      if (!item || item.published === false) continue;
      urls.push(urlEntry(`${siteBase}/${prefix}${solutionPath(item, id)}`, 'monthly', '0.7'));
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join('\n'),
    '</urlset>',
    '',
  ].join('\n');
  const outPath = path.join(REPO_ROOT, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  return { path: outPath, count: urls.length };
}
