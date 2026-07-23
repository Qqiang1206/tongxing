/**
 * Align solution filterKey/filterKeyEn with slug (zh source of truth)
 * and regenerate solutions page filter labels from category seed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

const SOLUTION_CATEGORIES = [
  { key: 'tv-display', name: 'TV / 商显', nameEn: 'TV & Commercial Display' },
  { key: 'refrigerator', name: '冰箱', nameEn: 'Refrigerator' },
  { key: 'packaging', name: '包装', nameEn: 'Packaging' },
  { key: 'washer', name: '洗衣机', nameEn: 'Washer' },
  { key: 'capacitor', name: '电容', nameEn: 'Capacitor' },
  { key: 'ac', name: '空调', nameEn: 'Air Conditioning' },
  { key: 'microwave', name: '微波炉', nameEn: 'Microwave' },
  { key: 'coffee', name: '咖啡机', nameEn: 'Coffee Machine' },
  { key: 'tablet', name: '平板', nameEn: 'Tablet' },
  { key: 'headlight', name: '车灯', nameEn: 'Headlight' },
  { key: 'robot', name: '机器人', nameEn: 'Robot' },
];

const FILTER_ALL = { zh: '全部方案', en: 'All Solutions', ru: 'Все решения' };

function isId(key) {
  return /^\d+$/.test(String(key));
}

for (const lang of ['zh', 'en', 'ru']) {
  const fp = path.join(ROOT, 'data', 'solutions', `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let fixed = 0;
  for (const [id, item] of Object.entries(data)) {
    if (!isId(id) || !item?.slug) continue;
    if (item.filterKey !== item.slug || item.filterKeyEn !== item.slug) {
      item.filterKey = item.slug;
      item.filterKeyEn = item.slug;
      item.updatedAt = now;
      fixed++;
      console.log(`  ${lang} id=${id}: filterKey → ${item.slug}`);
    }
  }
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Fixed ${fixed} solutions in ${lang}.json`);
}

for (const lang of ['zh', 'en', 'ru']) {
  const fp = path.join(ROOT, 'data', 'pages', 'solutions', `${lang}.json`);
  if (!fs.existsSync(fp)) continue;
  const page = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const filters = { all: FILTER_ALL[lang] };
  for (const cat of SOLUTION_CATEGORIES) {
    filters[cat.key] = lang === 'en' ? cat.nameEn : lang === 'ru' ? cat.nameEn : cat.name;
  }
  page.filters = filters;
  fs.writeFileSync(fp, JSON.stringify(page, null, 2) + '\n', 'utf8');
  console.log(`Updated pages/solutions/${lang}.json filters (${Object.keys(filters).length} keys)`);
}

console.log('Done. Run: npm run generate-data-js');
