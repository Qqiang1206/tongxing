import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const now = '2026-07-23 19:20:00';

function rw(fp, cb) {
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  cb(data);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// 1. Fix filterKeyEn
console.log('=== 1. Fix filterKeyEn ===');
const zhProducts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products', 'zh.json'), 'utf8'));
const fixes = {};
for (const [id, item] of Object.entries(zhProducts)) {
  if (item.filterKey && item.filterKey !== item.filterKeyEn) {
    fixes[id] = item.filterKey;
    console.log(`  ID ${id}: filterKeyEn "${item.filterKeyEn}" → "${item.filterKey}"`);
  }
}
console.log(`  Total: ${Object.keys(fixes).length} products to fix`);

for (const lang of ['zh', 'en', 'ru']) {
  rw(path.join(DATA_DIR, 'products', `${lang}.json`), (data) => {
    for (const [id, correct] of Object.entries(fixes)) {
      if (data[id]) { data[id].filterKeyEn = correct; data[id].updatedAt = now; }
    }
  });
  console.log(`  Fixed products ${lang}.json`);
}

// 2. Remove dead "line" filter
console.log('\n=== 2. Remove dead "line" filter ===');
for (const lang of ['en', 'ru']) {
  rw(path.join(DATA_DIR, 'pages', 'products', `${lang}.json`), (data) => {
    if (data.filters?.line) { delete data.filters.line; console.log(`  Removed from ${lang}`); }
  });
}

// 3. Fix about page stats
console.log('\n=== 3. Fix about page stats ===');
rw(path.join(DATA_DIR, 'pages', 'about', 'en.json'), (d) => {
  const i = d.stats?.items; if (i) {
    if (i[0]?.unit === '') i[0].unit = 'Years';
    if (i[1]?.unit === '') i[1].unit = 'Patents';
    if (i[2]?.unit === '') i[2].unit = 'Industries';
    if (i[4]?.unit === '0k m²') { /* keep value+unit concat: 10 + 0k m² → 100k m² */ }
  }
  console.log('  Fixed about en');
});
rw(path.join(DATA_DIR, 'pages', 'about', 'ru.json'), (d) => {
  const i = d.stats?.items; if (i) {
    if (i[0]?.unit === '') i[0].unit = 'лет';
    if (i[1]?.unit === '') i[1].unit = 'пат.';
    if (i[2]?.unit === '') i[2].unit = 'отр.';
    if (i[3]?.unit === 'стр.') i[3].unit = 'стран';
    if (i[4]?.unit === '万㎡') i[4].unit = 'тыс. м²';
  }
  console.log('  Fixed about ru');
});

// 4. Fix home page
console.log('\n=== 4. Fix home page ===');
rw(path.join(DATA_DIR, 'pages', 'home', 'en.json'), (d) => {
  const s = d.aboutSection?.stats;
  if (s?.[3]?.unit === '0k m²') { /* keep en area stat concat pattern */ }
});
rw(path.join(DATA_DIR, 'pages', 'home', 'ru.json'), (d) => {
  const s = d.aboutSection?.stats;
  if (s?.[3]?.unit === '万㎡') { s[3].unit = 'тыс. м²'; }
  if (d.featured?.subtitle === '') {
    d.featured.subtitle = 'Совместимость 65-110″ | Полностью автоматическая сборка';
  }
  console.log('  Fixed home ru');
});

// 5. Fix contact page
console.log('\n=== 5. Fix contact page ===');
rw(path.join(DATA_DIR, 'pages', 'contact', 'en.json'), (d) => {
  if (d.locations) {
    if (!d.locations[0].badge) d.locations[0].badge = 'In Use';
    d.locations[1].badge = 'Under Construction';
    d.locations[1].address = d.locations[1].address.replace(/fully operational since 2026/i, 'expected to be fully operational by end of 2026');
    console.log('  Fixed contact en');
  }
});
rw(path.join(DATA_DIR, 'pages', 'contact', 'ru.json'), (d) => {
  if (d.locations) {
    if (!d.locations[0].badge) d.locations[0].badge = 'Действует';
    d.locations[1].badge = 'Строится';
    d.locations[1].address = d.locations[1].address.replace(/полностью введена в эксплуатацию с 2026 г\.?/i, 'ожидается полный ввод в эксплуатацию к концу 2026 г.');
    console.log('  Fixed contact ru');
  }
});

console.log('\n=== Done ===');
