const fs = require('fs');
const p = 'H:/tongxing/assets/js/news-list.js';
let s = fs.readFileSync(p, 'utf8');
const marker = "var data = await global.TXAM.loadData('news', lang);";
if (s.includes("loadPage('news'")) {
  console.log('already patched');
  process.exit(0);
}
const insert = `if (global.TXAM.loadPage) {
        try {
          var page = await global.TXAM.loadPage('news', lang);
          if (page && page.seo && global.TXAM.applySeo) global.TXAM.applySeo(page.seo);
          if (page && page.hero) {
            var ht = document.getElementById('list-hero-title');
            var hl = document.getElementById('list-hero-lead');
            if (ht && page.hero.title) ht.textContent = page.hero.title;
            if (hl && page.hero.lead) hl.textContent = page.hero.lead;
          }
          if (page && page.filters) {
            Object.keys(page.filters).forEach(function (key) {
              var btn = document.querySelector('.filter-btn[data-filter="' + key + '"]');
              if (btn) btn.textContent = page.filters[key];
            });
          }
        } catch (_) {}
      }

      `;
const idx = s.indexOf(marker);
if (idx < 0) {
  console.error('marker not found');
  process.exit(1);
}
s = s.slice(0, idx) + insert + s.slice(idx);
s = s.replace(
  '.filter(function (row) { return row && row.published !== false; })\n\n        .sort(function (a, b) {\n\n          return parseDate(b.date).localeCompare(parseDate(a.date));',
  '.filter(function (row) { return row && row.published !== false; })\n\n        .sort(function (a, b) {\n          var so = (a.sortOrder || 0) - (b.sortOrder || 0);\n          if (so) return so;\n          return parseDate(b.date).localeCompare(parseDate(a.date));'
);
fs.writeFileSync(p, s);
console.log('ok');
