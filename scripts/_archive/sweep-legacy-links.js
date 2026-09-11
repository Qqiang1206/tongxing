/**
 * Sweep remaining legacy -en/-ru filename references after restructure.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/\.(html|js)$/i.test(name)) files.push(full);
  }
  return files;
}

let n = 0;
for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  // onclick location.href legacy
  s = s.replace(/location\.href\s*=\s*['"]index-en\.html['"]/g, "location.href='index.html'");
  s = s.replace(/location\.href\s*=\s*['"]index-ru\.html['"]/g, "location.href='index.html'");
  s = s.replace(/location\.href\s*=\s*['"]([^'"]+)-en\.html['"]/g, "location.href='$1.html'");
  s = s.replace(/location\.href\s*=\s*['"]([^'"]+)-ru\.html['"]/g, "location.href='$1.html'");

  // JS string hrefs in detail related cards
  s = s.replace(/solutions-detail-en\.html/g, 'solutions-detail.html');
  s = s.replace(/solutions-detail-ru\.html/g, 'solutions-detail.html');
  s = s.replace(/product-detail-en\.html/g, 'product-detail.html');
  s = s.replace(/product-detail-ru\.html/g, 'product-detail.html');
  s = s.replace(/news-detail-en\.html/g, 'news-detail.html');
  s = s.replace(/news-detail-ru\.html/g, 'news-detail.html');

  // breadcrumb parent dataset
  s = s.replace(/solutions-en\.html/g, 'solutions.html');
  s = s.replace(/solutions-ru\.html/g, 'solutions.html');
  s = s.replace(/products-en\.html/g, 'products.html');
  s = s.replace(/products-ru\.html/g, 'products.html');

  // footer page name maps: keep basename without lang suffix for matching
  // index-en.html -> index.html in maps
  s = s.replace(/'index-en\.html'/g, "'index.html'");
  s = s.replace(/'about-en\.html'/g, "'about.html'");
  s = s.replace(/'solutions-en\.html'/g, "'solutions.html'");
  s = s.replace(/'products-en\.html'/g, "'products.html'");
  s = s.replace(/'news-en\.html'/g, "'news.html'");
  s = s.replace(/'contact-en\.html'/g, "'contact.html'");
  s = s.replace(/'index-ru\.html'/g, "'index.html'");
  s = s.replace(/'about-ru\.html'/g, "'about.html'");
  s = s.replace(/'solutions-ru\.html'/g, "'solutions.html'");
  s = s.replace(/'products-ru\.html'/g, "'products.html'");
  s = s.replace(/'news-ru\.html'/g, "'news.html'");
  s = s.replace(/'contact-ru\.html'/g, "'contact.html'");

  // href leftovers
  s = s.replace(/href="([^"#?]+)-en\.html/g, 'href="en/$1.html');
  s = s.replace(/href="([^"#?]+)-ru\.html/g, 'href="ru/$1.html');

  // Fix double en/en/
  s = s.replace(/href="en\/en\//g, 'href="en/');
  s = s.replace(/href="ru\/ru\//g, 'href="ru/');

  if (s !== before) {
    fs.writeFileSync(file, s, 'utf8');
    n++;
    console.log('Swept', path.relative(ROOT, file));
  }
}

// Delete any remaining product-N
for (const f of fs.readdirSync(ROOT)) {
  if (/^product-\d+(-en|-ru)?\.html$/i.test(f)) {
    fs.unlinkSync(path.join(ROOT, f));
    console.log('Deleted', f);
  }
}

console.log('Swept files:', n);
