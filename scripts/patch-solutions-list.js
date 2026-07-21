/**
 * One-shot: replace hardcoded solutions matrix with #solutions-list + scripts.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patch(rel, lang, assetPrefix, dataPrefix) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');

  let startIdx = html.indexOf('<!-- 📍 P2');
  if (startIdx < 0) {
    const m = html.match(/<section class="py-20 bg-white">/);
    if (!m) throw new Error('no matrix section in ' + rel);
    startIdx = m.index;
  }

  const footerMarker = html.includes('<!-- 📍 Footer')
    ? '<!-- 📍 Footer'
    : '<div data-footer-placeholder>';
  const endIdx = html.indexOf(footerMarker, startIdx);
  if (endIdx < 0) throw new Error('no footer in ' + rel);

  const replacement =
    '<!-- P2. Solutions matrix (data-driven) -->\n' +
    '    <section class="py-20 bg-white">\n' +
    '        <div id="solutions-list"></div>\n' +
    '    </section>\n\n    ';

  html = html.slice(0, startIdx) + replacement + html.slice(endIdx);

  const i18nNeedle = 'data/i18n/';
  const i18nIdx = html.indexOf(i18nNeedle);
  if (i18nIdx < 0) throw new Error('no i18n script in ' + rel);
  const searchFrom = html.lastIndexOf('<script>', i18nIdx);
  const searchTo = html.indexOf('</script>', searchFrom) + '</script>'.length;
  if (searchFrom < 0) throw new Error('no interactive script in ' + rel);

  const newScripts =
    '<script src="' + assetPrefix + 'assets/js/data-loader.js"></script>\n' +
    '    <script src="' + dataPrefix + 'data/solutions/' + lang + '.js"></script>\n' +
    '    <script src="' + assetPrefix + 'assets/js/solutions-list.js"></script>\n' +
    '    <script>\n' +
    '        document.addEventListener("DOMContentLoaded", function() {\n' +
    '            const navbar = document.getElementById("navbar");\n' +
    '            window.addEventListener("scroll", () => {\n' +
    '                if (window.scrollY > 20) { navbar.classList.add("shadow-sm"); }\n' +
    '                else { navbar.classList.remove("shadow-sm"); }\n' +
    '            });\n' +
    '            TXAM.initSolutionsList({ lang: "' + lang + '" });\n' +
    '        });\n' +
    '    </script>';

  html = html.slice(0, searchFrom) + newScripts + html.slice(searchTo);
  fs.writeFileSync(file, html, 'utf8');
  console.log('patched', rel);
}

patch('solutions.html', 'zh', '', '');
patch(path.join('en', 'solutions.html'), 'en', '../', '../');
patch(path.join('ru', 'solutions.html'), 'ru', '../', '../');
