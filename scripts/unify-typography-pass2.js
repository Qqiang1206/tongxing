const fs = require('fs');
const path = require('path');

function walk(d, a = []) {
  for (const n of fs.readdirSync(d)) {
    if (n === '.git' || n === 'node_modules' || n === 'scripts') continue;
    const p = path.join(d, n);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, a);
    else if (n.endsWith('.html')) a.push(p);
  }
  return a;
}

let n = 0;
for (const f of walk(path.join(__dirname, '..'))) {
  let s = fs.readFileSync(f, 'utf8');
  const b = s;

  s = s.replace(/text-lg md:text-xl text-\[#86868B\]/g, 'text-body-lg text-[#86868B]');
  s = s.replace(/text-4xl md:text-\[5rem\] font-black/g, 'text-h1');
  s = s.replace(
    /text-4xl font-black text-\[#1D1D1F\] mb-3 mono-num/g,
    'text-h2 text-[#1D1D1F] mb-3 mono-num'
  );
  s = s.replace(
    /text-4xl font-black text-\[#FF6B00\] mb-3 mono-num/g,
    'text-h2 text-[#FF6B00] mb-3 mono-num'
  );
  s = s.replace(/text-2xl font-bold text-\[#1D1D1F\]/g, 'text-h3 text-[#1D1D1F]');
  s = s.replace(
    /text-xl font-bold text-\[#1D1D1F\] group-hover:text-\[#FF6B00\]/g,
    'text-h3 text-[#1D1D1F] group-hover:text-[#FF6B00]'
  );
  s = s.replace(/text-xl font-bold text-\[#1D1D1F\] mb-3/g, 'text-h3 text-[#1D1D1F] mb-3');
  s = s.replace(/text-xl font-bold text-\[#1D1D1F\]"/g, 'text-h3 text-[#1D1D1F]"');

  if (s !== b) {
    fs.writeFileSync(f, s);
    n++;
    console.log('patched', path.relative(path.join(__dirname, '..'), f));
  }
}
console.log('pass2', n);
