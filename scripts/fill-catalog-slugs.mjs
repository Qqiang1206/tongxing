/**
 * Fill empty product/news slugs from English catalog (locale-neutral URL keys).
 * Run: node scripts/fill-catalog-slugs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function slugify(text) {
  return String(text || '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72);
}

function productSlugSource(item) {
  const model = String(item.model || '').trim();
  if (/^[A-Za-z0-9][A-Za-z0-9\s._-]{2,}$/.test(model) && /[A-Za-z]/.test(model)) {
    const fromModel = slugify(model);
    if (fromModel.length >= 3) return fromModel;
  }
  const fromName = slugify(item.name);
  if (fromName.length >= 3) return fromName;
  return `product-${item.id}`;
}

function newsSlugSource(item) {
  const fromTitle = slugify(item.title);
  if (fromTitle.length >= 3) return fromTitle;
  return `news-${item.id}`;
}

function assignSlugs(kind, sourceFn) {
  const enPath = path.join(root, 'data', kind, 'en.json');
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const slugsById = {};
  const used = new Set();

  for (const id of Object.keys(en).sort((a, b) => Number(a) - Number(b))) {
    const item = en[id];
    if (!item) continue;
    const existing = String(item.slug || '').trim();
    if (existing) {
      slugsById[id] = existing;
      used.add(existing);
      continue;
    }
    let base = sourceFn(item);
    let slug = base;
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    used.add(slug);
    slugsById[id] = slug;
  }

  for (const lang of ['zh', 'en', 'ru']) {
    const jsonPath = path.join(root, 'data', kind, `${lang}.json`);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let updated = 0;
    for (const [id, slug] of Object.entries(slugsById)) {
      if (data[id] && data[id].slug !== slug) {
        data[id].slug = slug;
        updated += 1;
      }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`${kind}/${lang}.json: updated ${updated} slugs`);
  }
}

assignSlugs('products', productSlugSource);
assignSlugs('news', newsSlugSource);
console.log('done');
