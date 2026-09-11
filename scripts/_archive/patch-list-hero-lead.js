const fs = require('fs');
const path = require('path');
const files = [
  'products.html', 'news.html', 'solutions.html',
  'en/products.html', 'en/news.html', 'en/solutions.html',
  'ru/products.html', 'ru/news.html', 'ru/solutions.html',
];
for (const f of files) {
  const p = path.join(__dirname, '..', f);
  let h = fs.readFileSync(p, 'utf8');
  if (h.includes('id="list-hero-lead"')) {
    console.log('skip', f);
    continue;
  }
  const re = /(id="list-hero-title"[\s\S]*?<\/h1>\s*)(<p)([^>]*>)/;
  if (!re.test(h)) {
    console.log('no match', f);
    continue;
  }
  h = h.replace(re, '$1$2 id="list-hero-lead"$3');
  fs.writeFileSync(p, h);
  console.log('ok', f);
}
