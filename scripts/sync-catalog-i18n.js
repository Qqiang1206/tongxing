/**
 * Sync catalog IDs from zh → en/ru.
 * Missing records are copied from zh (placeholder until translation runs).
 * Extra en/ru IDs not in zh are reported but not deleted.
 *
 * Usage: node scripts/sync-catalog-i18n.js [products|news|solutions|all]
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const kinds = ['products', 'news', 'solutions'];
const arg = (process.argv[2] || 'all').toLowerCase();
const selected = arg === 'all' ? kinds : kinds.filter((k) => k === arg);

if (!selected.length) {
  console.error('Usage: node scripts/sync-catalog-i18n.js [products|news|solutions|all]');
  process.exit(1);
}

function load(kind, lang) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', kind, `${lang}.json`), 'utf8'));
}

function writeSorted(kind, lang, data) {
  const sorted = {};
  Object.keys(data)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((id) => {
      sorted[id] = data[id];
    });
  fs.writeFileSync(
    path.join(root, 'data', kind, `${lang}.json`),
    JSON.stringify(sorted, null, 2) + '\n',
    'utf8'
  );
  return Object.keys(sorted).length;
}

for (const kind of selected) {
  const zh = load(kind, 'zh');
  const zhIds = Object.keys(zh);
  for (const lang of ['en', 'ru']) {
    const data = load(kind, lang);
    let added = 0;
    for (const id of zhIds) {
      if (!data[id]) {
        data[id] = JSON.parse(JSON.stringify(zh[id]));
        added++;
      }
    }
    const extras = Object.keys(data).filter((id) => !zh[id]);
    const total = writeSorted(kind, lang, data);
    console.log(`${kind}/${lang}.json: +${added} from zh (${total} total)`);
    if (extras.length) {
      console.warn(`  warn: extra ids not in zh: ${extras.join(', ')}`);
    }
  }
}

console.log('Done. Run: npm run generate-data-js');
