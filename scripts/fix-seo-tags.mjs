import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOMAIN = 'https://www.sztxgk.com';
const OG_IMAGE = `${DOMAIN}/assets/images/hero/factory-hero.webp`;

function getLangAndBase(fp) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  if (rel.startsWith('en/')) return { lang: 'en', baseFile: rel.slice(3) };
  if (rel.startsWith('ru/')) return { lang: 'ru', baseFile: rel.slice(3) };
  return { lang: 'zh', baseFile: rel };
}

function getUrl(lang, baseFile) {
  const isIndex = baseFile === 'index.html';
  if (isIndex) {
    if (lang === 'zh') return `${DOMAIN}/`;
    return `${DOMAIN}/${lang}/`;
  }
  if (lang === 'zh') return `${DOMAIN}/${baseFile}`;
  return `${DOMAIN}/${lang}/${baseFile}`;
}

function getMetaDesc(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  return m ? m[1] : '';
}

function fixFile(fp) {
  const { lang, baseFile } = getLangAndBase(fp);
  let html = fs.readFileSync(fp, 'utf8');

  const zhUrl = getUrl('zh', baseFile);
  const enUrl = getUrl('en', baseFile);
  const ruUrl = getUrl('ru', baseFile);
  const canonicalUrl = getUrl(lang, baseFile);

  // Remove existing hreflang/canonical (if any)
  html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/?>\s*/gi, '\n');
  html = html.replace(/\s*<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>\s*/gi, '\n');

  // Remove existing og:image (to replace)
  html = html.replace(/\s*<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>\s*/gi, '\n');

  // Build SEO tags block
  const hreflangBlock = [
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<link rel="alternate" hreflang="zh-CN" href="${zhUrl}">`,
    `<link rel="alternate" hreflang="en-US" href="${enUrl}">`,
    `<link rel="alternate" hreflang="ru-RU" href="${ruUrl}">`,
    `<link rel="alternate" hreflang="x-default" href="${zhUrl}">`,
  ];

  // Add og:image if missing and not homepage
  if (baseFile !== 'index.html' || lang !== 'zh') {
    hreflangBlock.push(`<meta property="og:image" content="${OG_IMAGE}">`);
  }

  // Add og:description if missing on detail pages
  if (!/<meta\s+property="og:description"/i.test(html)) {
    const desc = getMetaDesc(html);
    if (desc) {
      hreflangBlock.push(`<meta property="og:description" content="${desc}">`);
    }
  }

  // Also add og:type if missing
  if (!/<meta\s+property="og:type"/i.test(html)) {
    hreflangBlock.push(`<meta property="og:type" content="website">`);
  }

  const seoBlock = '    ' + hreflangBlock.join('\n    ') + '\n';

  // Insert after </title> or before </head>
  if (/<\/title>/i.test(html)) {
    html = html.replace(/<\/title>\s*\n/i, `</title>\n${seoBlock}`);
  } else {
    html = html.replace(/<\/head>/i, `${seoBlock}</head>`);
  }

  fs.writeFileSync(fp, html, 'utf8');
  return { lang, baseFile, canonicalUrl, hasOgImage: html.includes('og:image'), hasOgDesc: html.includes('og:description') };
}

// Find and fix all HTML files
console.log('=== Fixing SEO tags ===\n');
const results = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  for (const f of files) {
    const fp = path.join(dir, f);
    results.push(fixFile(fp));
  }
}

scanDir(ROOT);
scanDir(path.join(ROOT, 'en'));
scanDir(path.join(ROOT, 'ru'));

// Summary
console.log(`Processed ${results.length} files\n`);

const canonFixed = results.filter(r => r.lang === 'zh' && r.baseFile === 'index.html');
if (canonFixed.length) console.log(`  Homepage canonical → https://www.sztxgk.com/`);

const ogImageAdded = results.filter(r => r.hasOgImage).length;
console.log(`  og:image: ${ogImageAdded} pages have it`);

const ogDescAdded = results.filter(r => r.hasOgDesc).length;
console.log(`  og:description: ${ogDescAdded} pages have it`);

console.log(`  hreflang + canonical: added to all ${results.length} pages`);
console.log('\n=== Done ===');
