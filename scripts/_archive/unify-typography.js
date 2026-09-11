/**
 * Typography unification pass:
 * - Channel page H1 keeps text-display
 * - Detail / *-solution H1: text-display → text-h1
 * - Section titles: Tailwind 4xl/[3rem] → text-h1 / text-h2
 * - Leads: text-xl md:text-2xl / text-lg md:text-xl → text-body-lg / detail-lead
 * - Solution body: prose + inline h3 → detail-prose
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'scripts') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function patch(html, file) {
  let s = html;
  const before = s;

  // Detail / solution page H1: smaller than channel display
  s = s.replace(
    /class="detail-title hero-title text-display /g,
    'class="detail-title hero-title text-h1 '
  );
  s = s.replace(
    /class="detail-title hero-title text-display"/g,
    'class="detail-title hero-title text-h1"'
  );

  // Large section titles (about/contact/index blocks) → text-h1
  s = s.replace(
    /text-4xl md:text-\[3\.5rem\] font-black/g,
    'text-h1'
  );

  // Solution matrix / medium section titles → text-h2 (card/section, not channel H1)
  s = s.replace(
    /text-4xl md:text-\[3rem\] font-black/g,
    'text-h2'
  );
  s = s.replace(
    /text-3xl md:text-\[3rem\] font-black/g,
    'text-h2'
  );

  // Page / list leads (EN/RU products were oversized)
  s = s.replace(
    /text-xl md:text-2xl text-\[#86868B\] font-medium/g,
    'text-body-lg text-[#86868B] font-medium'
  );

  // Solution detail / static solution hero leads
  s = s.replace(
    /text-lg md:text-xl text-\[#86868B\] font-medium leading-relaxed/g,
    'detail-lead'
  );

  // Solution list body paragraphs often use text-lg leading-[1.8]
  s = s.replace(
    /text-\[#86868B\] text-lg leading-\[1\.8\]/g,
    'text-body-lg text-[#86868B] leading-relaxed'
  );

  // Detail body container: prefer detail-prose
  s = s.replace(
    /class="prose max-w-none text-\[#86868B\] leading-\[1\.8\]"/g,
    'class="detail-prose"'
  );
  s = s.replace(
    /class="prose max-w-none text-\[#86868B\] leading-\[1\.8\] /g,
    'class="detail-prose '
  );

  // Strip oversized inline h3 inside solution prose (CSS handles .detail-prose h3)
  s = s.replace(
    /<h3 class="text-xl font-bold text-\[#1D1D1F\] mb-4">/g,
    '<h3>'
  );

  // News card titles on list pages: text-2xl md:text-3xl → text-h3 scale with a bit more weight
  s = s.replace(
    /text-2xl md:text-3xl font-bold/g,
    'text-h3 font-bold'
  );

  // Product card titles stay ~text-2xl; map to text-h3 is too small (1.25rem).
  // Use a dedicated pattern: keep text-2xl but ensure not larger — leave product cards.

  // Remove redundant inline hero-title / font-family blocks in en/ru index (optional cleanup)
  s = s.replace(
    /\s*\.hero-title\s*\{\s*font-weight:\s*900;\s*letter-spacing:\s*-0\.04em;\s*line-height:\s*1\.05;\s*\}\s*/g,
    '\n        '
  );

  if (s !== before) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

const files = walk(ROOT);
let n = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  if (patch(html, f)) {
    n++;
    console.log('patched', path.relative(ROOT, f));
  }
}
console.log('done,', n, 'files');
