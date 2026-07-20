const fs = require('fs');
const path = require('path');

for (const kind of ['products', 'solutions', 'news']) {
  for (const lang of ['zh', 'en', 'ru']) {
    const p = path.join(__dirname, '..', 'data', kind, `${lang}.json`);
    let s = fs.readFileSync(p, 'utf8');
    const before = s;
    s = s.replace(/"\/assets\//g, '"assets/');
    if (s !== before) {
      fs.writeFileSync(p, s);
      console.log('fixed', p);
    } else {
      console.log('ok', p);
    }
  }
}
