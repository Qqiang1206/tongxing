/**
 * Patch products.html and *-solution.html for dynamic data loading.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const productPages = [
  { file: 'products.html', lang: 'zh', loader: 'assets/js/data-loader.js', data: 'data/products/zh.js', list: 'assets/js/products-list.js', footer: 'assets/js/footer.js' },
  { file: 'en/products.html', lang: 'en', loader: '../assets/js/data-loader.js', data: '../data/products/en.js', list: '../assets/js/products-list.js', footer: '../assets/js/footer-en.js' },
  { file: 'ru/products.html', lang: 'ru', loader: '../assets/js/data-loader.js', data: '../data/products/ru.js', list: '../assets/js/products-list.js', footer: '../assets/js/footer-ru.js' },
];

function clearProductGrid(html) {
  return html.replace(
    /(<div class="max-w-\[1400px\] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="product-grid">)[\s\S]*?(<\/div>\s*\n\s*<\/section>)/,
    '$1\n        </div>\n    </section>'
  );
}

function replaceProductsScript(html, cfg) {
  const replacement =
    `    <script src="${cfg.loader}"></script>\n` +
    `    <script src="${cfg.data}"></script>\n` +
    `    <script src="${cfg.list}"></script>\n` +
    `    <script>\n` +
    `        document.addEventListener("DOMContentLoaded", function() {\n` +
    `            const navbar = document.getElementById('navbar');\n` +
    `            window.addEventListener('scroll', () => {\n` +
    `                if (window.scrollY > 20) { navbar.classList.add('shadow-sm'); }\n` +
    `                else { navbar.classList.remove('shadow-sm'); }\n` +
    `            });\n` +
    `            TXAM.initProductsList({ lang: '${cfg.lang}' });\n` +
    `        });\n` +
    `    </script>\n` +
    `    <script src="${cfg.footer}" defer></script>`;

  return html.replace(
    /    <script>\s*document\.addEventListener\("DOMContentLoaded"[\s\S]*?<\/script>\s*\n    <script src="[^"]*footer[^"]*" defer><\/script>/,
    replacement
  );
}

for (const cfg of productPages) {
  const filePath = path.join(root, cfg.file);
  let html = fs.readFileSync(filePath, 'utf8');
  html = clearProductGrid(html);
  html = replaceProductsScript(html, cfg);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('patched', cfg.file);
}

function patchSolutionLanding(filePath, lang, loaderPrefix, footer) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('solution-landing.js')) {
    console.log('skip (already patched)', filePath);
    return;
  }

  const replacement =
    `    <script src="${loaderPrefix}assets/js/data-loader.js"></script>\n` +
    `    <script src="${loaderPrefix}data/solutions/${lang}.js"></script>\n` +
    `    <script src="${loaderPrefix}assets/js/solution-landing.js"></script>\n` +
    `    <script>\n` +
    `        document.addEventListener('DOMContentLoaded', function() {\n` +
    `            const navbar = document.getElementById('navbar');\n` +
    `            window.addEventListener('scroll', () => {\n` +
    `                if (window.scrollY > 20) { navbar.classList.add('shadow-sm'); }\n` +
    `                else { navbar.classList.remove('shadow-sm'); }\n` +
    `            });\n` +
    `            TXAM.initSolutionLanding({ lang: '${lang}' });\n` +
    `        });\n` +
    `    </script>\n` +
    `    <script src="${loaderPrefix}assets/js/${footer}" defer></script>`;

  html = html.replace(
    /    <script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>\s*\n    <script src="[^"]*footer[^"]*" defer><\/script>/,
    replacement
  );

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('patched', path.relative(root, filePath));
}

const slugs = [
  'tv-display', 'refrigerator', 'packaging', 'washer', 'capacitor', 'ac',
  'microwave', 'coffee', 'tablet', 'headlight', 'robot',
];

for (const slug of slugs) {
  patchSolutionLanding(path.join(root, `${slug}-solution.html`), 'zh', '', 'footer.js');
  patchSolutionLanding(path.join(root, 'en', `${slug}-solution.html`), 'en', '../', 'footer-en.js');
  patchSolutionLanding(path.join(root, 'ru', `${slug}-solution.html`), 'ru', '../', 'footer-ru.js');
}

console.log('done');
