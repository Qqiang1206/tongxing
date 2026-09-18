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

// 4. solutions filterKey
//    分类键与条目 slug 是两回事，不相等是**有意设计**（见 solution_categories 表：
//    key=washer 实为「3C数码」、key=ac 实为「汽车」、key=refrigerator 为「家电」），
//    所以不能拿 slug 去比。真正要守的不变量是：
//    (a) 同一 id 的分类键必须跨语言一致，否则该语言的筛选页签会错位；
//    (b) 分类键必须出现在 pages/solutions/<lang>.json 的 filters 里，
//        否则前端拿不到可读标签（会退化成露出 washer 这类内部键）。
const pageFilters = {};
for (const lang of LANGS) {
  const p = path.join(root, 'data', 'pages', 'solutions', lang + '.json');
  pageFilters[lang] = fs.existsSync(p)
    ? Object.keys(JSON.parse(fs.readFileSync(p, 'utf8')).filters || {})
    : [];
}

const filterKeys = {};
for (const lang of LANGS) {
  const loaded = loadJson('solutions', lang);
  if (!loaded) continue;
  filterKeys[lang] = {};
  for (const [id, item] of Object.entries(loaded.data)) {
    if (!/^\d+$/.test(id)) continue;
    const fk = item.filterKey || item.filterKeyEn || '';
    filterKeys[lang][id] = fk;
    if (fk && pageFilters[lang].length > 0 && !pageFilters[lang].includes(fk)) {
      console.warn(`WARN: solutions ${lang} id=${id} filterKey "${fk}" 未在 pages/solutions/${lang}.json 的 filters 中声明`);
    }
  }
}

for (const lang of ['en', 'ru']) {
  for (const [id, fk] of Object.entries(filterKeys.zh || {})) {
    const other = (filterKeys[lang] || {})[id];
    if (other !== undefined && other !== fk) {
      console.error(`ERROR: solutions filterKey ${lang} id=${id} 为 "${other}"，与 zh 的 "${fk}" 不一致（分类键必须跨语言一致）`);
      ok = false;
    }
  }
}

process.exit(ok ? 0 : 1);
