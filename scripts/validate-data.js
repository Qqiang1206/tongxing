const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let ok = true;

const KINDS = ['products', 'solutions', 'news'];
const LANGS = ['zh', 'en', 'ru'];

function loadJson(kind, lang) {
  const p = path.join(root, 'data', kind, lang + '.json');
  if (!fs.existsSync(p)) return null;
  return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
}

// 1. Item count per kind/lang
for (const kind of KINDS) {
  for (const lang of LANGS) {
    const loaded = loadJson(kind, lang);
    if (!loaded) { console.error('MISSING', `data/${kind}/${lang}.json`); ok = false; continue; }
    console.log(`${kind} ${lang}: ${Object.keys(loaded.data).length} items`);
  }
}

// 2. Cross-lang id set consistency (same IDs across zh/en/ru for each kind)
for (const kind of KINDS) {
  const idsByLang = {};
  for (const lang of LANGS) {
    const loaded = loadJson(kind, lang);
    if (!loaded) { idsByLang[lang] = new Set(); continue; }
    idsByLang[lang] = new Set(Object.keys(loaded.data).filter(id => /^\d+$/.test(id)));
  }
  const zhIds = idsByLang['zh'];
  for (const lang of ['en', 'ru']) {
    const missing = [...zhIds].filter(id => !idsByLang[lang].has(id));
    const extra = [...idsByLang[lang]].filter(id => !zhIds.has(id));
    if (missing.length > 0) { console.error(`ERROR: ${kind} ${lang} missing IDs: ${missing.join(',')}`); ok = false; }
    if (extra.length > 0) { console.error(`ERROR: ${kind} ${lang} extra IDs: ${extra.join(',')}`); ok = false; }
  }
}

// 3. Slug uniqueness within solutions
for (const lang of LANGS) {
  const loaded = loadJson('solutions', lang);
  if (!loaded) continue;
  const slugs = {};
  for (const [id, item] of Object.entries(loaded.data)) {
    if (!/^\d+$/.test(id)) continue;
    const slug = item.slug;
    if (slug) {
      if (slugs[slug] && slugs[slug] !== id) {
        console.error(`ERROR: solutions ${lang} duplicate slug "${slug}" (IDs: ${slugs[slug]}, ${id})`);
        ok = false;
      }
      slugs[slug] = id;
    }
  }
}

// 4. filterKey === slug check for solutions
for (const lang of LANGS) {
  const loaded = loadJson('solutions', lang);
  if (!loaded) continue;
  for (const [id, item] of Object.entries(loaded.data)) {
    if (!/^\d+$/.test(id)) continue;
    const fk = item.filterKey || item.filterKeyEn;
    if (fk && fk !== item.slug) {
      console.warn(`WARN: solutions ${lang} id=${id} filterKey "${fk}" !== slug "${item.slug}"`);
    }
  }
}

process.exit(ok ? 0 : 1);
