/**
 * Fix about page quality/patent marquees: proper structure + script.
 */
const fs = require('fs');
const path = require('path');

const files = [
  { file: 'about.html', script: 'assets/js/patent-marquee.js' },
  { file: 'en/about.html', script: '../assets/js/patent-marquee.js' },
  { file: 'ru/about.html', script: '../assets/js/patent-marquee.js' },
];

function patch(html, scriptSrc) {
  let s = html;

  // Quality section wrapper (40s)
  s = s.replace(
    /<div class="relative overflow-hidden">\s*<div class="patent-carousel flex gap-6 animate-marquee" style="animation: marquee 40s linear infinite;">/g,
    '<div class="patent-marquee" style="--marquee-duration: 40s">\n                    <div class="patent-marquee__track" data-patent-marquee>'
  );

  // Patent section wrapper (60s)
  s = s.replace(
    /<div class="relative overflow-hidden">\s*<div class="patent-carousel flex gap-6 animate-marquee" style="animation: marquee 60s linear infinite;">/g,
    '<div class="patent-marquee" style="--marquee-duration: 60s">\n                    <div class="patent-marquee__track" data-patent-marquee>'
  );

  // Card media wrapper class
  s = s.replace(
    /<div class="patent-card flex-shrink-0 w-64 apple-card p-4 flex flex-col items-center">\s*<div class="w-full bg-white rounded-xl overflow-hidden">/g,
    '<div class="patent-card apple-card p-4 flex flex-col items-center">\n                            <div class="patent-card__media">'
  );

  // Inject script if missing
  if (!s.includes('patent-marquee.js')) {
    if (s.includes('factory-carousel.js')) {
      s = s.replace(
        /(<script src="[^"]*factory-carousel\.js"[^>]*><\/script>)/,
        `$1\n    <script src="${scriptSrc}" defer></script>`
      );
    } else {
      s = s.replace(
        '</body>',
        `    <script src="${scriptSrc}" defer></script>\n</body>`
      );
    }
  }

  return s;
}

for (const { file, script } of files) {
  const p = path.join(__dirname, '..', file);
  const before = fs.readFileSync(p, 'utf8');
  const after = patch(before, script);
  if (after === before) {
    console.log('no change?', file);
  } else {
    fs.writeFileSync(p, after);
    console.log('patched', file);
  }
}
