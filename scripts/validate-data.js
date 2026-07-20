const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let ok = true;
for (const kind of ['products', 'solutions', 'news']) {
  for (const lang of ['zh', 'en', 'ru']) {
    const p = path.join(root, 'data', kind, lang + '.json');
    if (!fs.existsSync(p)) { console.error('MISSING', p); ok = false; continue; }
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(kind, lang, Object.keys(data).length, 'items');
  }
}
process.exit(ok ? 0 : 1);
