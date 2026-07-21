/**
 * Patch contact.html (zh/en/ru) for dynamic page data.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const pages = [
  { file: 'contact.html', lang: 'zh', prefix: '', data: 'data/pages/contact/zh.js', footer: 'assets/js/footer.js' },
  { file: 'en/contact.html', lang: 'en', prefix: '../', data: '../data/pages/contact/en.js', footer: '../assets/js/footer-en.js' },
  { file: 'ru/contact.html', lang: 'ru', prefix: '../', data: '../data/pages/contact/ru.js', footer: '../assets/js/footer-ru.js' },
];

function patchHero(html) {
  return html
    .replace(/<h1 class="hero-title([^"]*)">/g, '<h1 id="contact-hero-title" class="hero-title$1">')
    .replace(
      /(<header class="pt-40[\s\S]*?<p class="text-body-lg[^"]*")/,
      '$1 id="contact-hero-lead"'
    );
}

function patchChannels(html) {
  return html.replace(
    /(<section class="pb-32 px-6 md:px-24">\s*)<div class="max-w-\[1400px\][^"]*" id="contact-channels"[\s\S]*?<\/section>/,
    '$1<div id="contact-channels" class="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fade-up">\n        </div>\n    </section>'
  ).replace(
    /(<section class="pb-32 px-6 md:px-24">\s*)<div class="max-w-\[1400px\] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fade-up">[\s\S]*?<\/div>\s*<\/section>/,
    '$1<div id="contact-channels" class="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fade-up">\n        </div>\n    </section>'
  );
}

function patchMap(html) {
  if (html.includes('id="contact-locations"')) return html;
  return html.replace(
    /<h2 class="text-h1([^"]*)">[\s\S]*?<div class="absolute top-6 left-6[\s\S]*?map-overlay[^"]*">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/,
    (block) => {
      const titleMatch = block.match(/<h2 class="text-h1([^"]*)">([^<]*)<\/h2>/);
      const titleClass = titleMatch ? titleMatch[1] : ' font-black text-[#1D1D1F] mb-12 tracking-tighter';
      const titleText = titleMatch ? titleMatch[2] : '';
      return (
        '<h2 id="contact-map-title" class="text-h1' + titleClass + '">' + titleText + '</h2>\n            \n            <div class="w-full media-h-map w-full bg-gray-200 media-hero shadow-xl relative">\n                \n                <div id="amap-container" class="w-full h-full"></div>\n\n                <div class="absolute top-6 left-6 md:top-12 md:left-12 w-[calc(100%-48px)] md:w-[420px] map-overlay p-8 md:p-10 shadow-[0_20px_40px_rgba(0,0,0,0.1)]">\n                    <div id="contact-locations"></div>\n                </div>\n            </div>\n        </div>\n    </section>'
      );
    }
  );
}

function patchScripts(html, cfg) {
  if (html.includes('contact-page.js')) return html;
  const replacement =
    `    <script src="${cfg.prefix}assets/js/data-loader.js"></script>\n` +
    `    <script src="${cfg.data}"></script>\n` +
    `    <script src="${cfg.prefix}assets/js/contact-page.js"></script>\n` +
    `    <script>\n` +
    `        document.addEventListener("DOMContentLoaded", function() {\n` +
    `            const navbar = document.getElementById('navbar');\n` +
    `            window.addEventListener('scroll', () => {\n` +
    `                if (window.scrollY > 20) { navbar.classList.add('shadow-sm'); }\n` +
    `                else { navbar.classList.remove('shadow-sm'); }\n` +
    `            });\n` +
    `            TXAM.initContactPage({ lang: '${cfg.lang}' });\n` +
    `        });\n` +
    `    </script>\n    \n`;

  return html.replace(
    /    <script>\s*document\.addEventListener\("DOMContentLoaded"[\s\S]*?<\/script>\s*\n\s*(?=<script src="https:\/\/webapi\.amap|<script src="\.\.\/assets|<script src="assets)/,
    replacement
  );
}

for (const cfg of pages) {
  const filePath = path.join(root, cfg.file);
  let html = fs.readFileSync(filePath, 'utf8');
  if (cfg.file !== 'contact.html') {
    html = patchHero(html);
    html = patchChannels(html);
    html = patchMap(html);
  }
  html = patchScripts(html, cfg);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('patched', cfg.file);
}

console.log('done');
