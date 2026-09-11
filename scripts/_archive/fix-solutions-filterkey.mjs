/**
 * Validate and sync solution filterKey grouping.
 *
 * filterKey is a GROUPING key (not per-item identity). Multiple solutions
 * share one filterKey to appear under the same filter button on the
 * solutions list page (solutions.html).
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Reads the actual filterKey values from zh.json (source of truth)
 *      and checks that en.json / ru.json match the same grouping.
 *   2. Regenerates data/pages/solutions/{lang}.json → filters map so
 *      every unique filterKey has a human-readable label.
 *   3. Reports the grouping structure for review.
 *
 * WHAT THIS SCRIPT DOES NOT DO:
 *   × Does NOT change filterKey to match slug (that would break grouping).
 *   × Does NOT add/remove filterKeys from solutions — only validates.
 *
 * To change grouping: edit filterKey in zh.json, then re-run this script.
 *
 * Usage: node scripts/fix-solutions-filterkey.mjs
 *        then: npm run generate-data-js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Human-readable labels for each filterKey group ───────────────────────
// The key MUST match an actual filterKey value found in solutions data.
// Edit these labels when adding/changing groups.
const GROUP_LABELS = {
  zh: {
    'tv-display': 'TV / 商显',
    'refrigerator': '家电',
    'packaging': '物流与包装',
    'washer': '3C数码',
    'capacitor': '储能',
    'ac': '汽车',
    'robot': '机器人',
  },
  en: {
    'tv-display': 'TV / Commercial Displays',
    'refrigerator': 'Home Appliances',
    'packaging': 'Logistics & Packaging',
    'washer': '3C Electronics',
    'capacitor': 'Energy Storage',
    'ac': 'Automotive',
    'robot': 'Robotics',
  },
  ru: {
    'tv-display': 'ТВ / Коммерческие дисплеи',
    'refrigerator': 'Бытовая техника',
    'packaging': 'Логистика и упаковка',
    'washer': '3C-электроника',
    'capacitor': 'Системы хранения энергии',
    'ac': 'Автомобильная промышленность',
    'robot': 'Робототехника',
  },
};

const FILTER_ALL = {
  zh: '全部方案',
  en: 'All Solutions',
  ru: 'Все решения',
};

function isId(key) {
  return /^\d+$/.test(String(key));
}

// ── Step 1: Read zh.json as source of truth, collect filterKey grouping ──
const zhFp = path.join(ROOT, 'data', 'solutions', 'zh.json');
const zhData = JSON.parse(fs.readFileSync(zhFp, 'utf8'));

// { filterKey → [id, id, …] }
const zhGrouping = {};
const zhSolutionNames = {};
for (const [id, item] of Object.entries(zhData)) {
  if (!isId(id) || !item) continue;
  const fk = item.filterKey || item.slug || '';
  if (!fk) continue;
  if (!zhGrouping[fk]) zhGrouping[fk] = [];
  zhGrouping[fk].push(id);
  zhSolutionNames[id] = item.name || item.slug || id;
}

console.log('=== Current filterKey grouping (zh source of truth) ===\n');
for (const [fk, ids] of Object.entries(zhGrouping).sort()) {
  const names = ids.map(id => `    ${id} → ${zhSolutionNames[id]}`).join('\n');
  const label = (GROUP_LABELS.zh[fk] || '⚠️ 无标签');
  console.log(`  ${fk}  →  "${label}" (${ids.length} solutions)\n${names}\n`);
}

// ── Step 2: Validate en.json / ru.json match the same grouping ──────────
let crossLangIssues = 0;

for (const lang of ['en', 'ru']) {
  const fp = path.join(ROOT, 'data', 'solutions', `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  for (const [id, item] of Object.entries(data)) {
    if (!isId(id) || !item) continue;
    const zhFk = zhData[id]?.filterKey || zhData[id]?.slug || '';
    const langFk = item.filterKey || item.slug || '';
    if (zhFk && langFk && zhFk !== langFk) {
      console.warn(`  ⚠️  MISMATCH ${lang} id=${id}: zh.filterKey="${zhFk}" vs ${lang}.filterKey="${langFk}"`);
      crossLangIssues++;
    }
  }

  // Also check for filterKeys in lang that don't exist in zh (orphans)
  const langKeys = new Set();
  for (const item of Object.values(data)) {
    const fk = item?.filterKey || item?.slug || '';
    if (fk) langKeys.add(fk);
  }
  for (const fk of langKeys) {
    if (!zhGrouping[fk]) {
      console.warn(`  ⚠️  ORPHAN filterKey "${fk}" in ${lang}.json — no zh solutions use it`);
      crossLangIssues++;
    }
  }
}

if (crossLangIssues === 0) {
  console.log('✅ All en/ru filterKeys match zh grouping.\n');
} else {
  console.log(`\n⚠️  ${crossLangIssues} cross-language issue(s) found — fix zh.json first, then re-run.\n`);
}

// ── Step 3: Build unique filterKey set across all langs ─────────────────
const allFilterKeys = Object.keys(zhGrouping).sort();

// ── Step 4: Regenerate pages/solutions/{lang}.json → filters ────────────
console.log('=== Regenerating pages/solutions filter labels ===\n');

for (const lang of ['zh', 'en', 'ru']) {
  const fp = path.join(ROOT, 'data', 'pages', 'solutions', `${lang}.json`);
  if (!fs.existsSync(fp)) {
    console.warn(`  ⚠️  Skipping ${fp} — not found`);
    continue;
  }

  const page = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const filters = { all: FILTER_ALL[lang] };

  for (const fk of allFilterKeys) {
    const label = (GROUP_LABELS[lang] || {})[fk];
    if (label) {
      filters[fk] = label;
    } else {
      // Fallback: use key itself as label (should not happen if GROUP_LABELS is complete)
      console.warn(`  ⚠️  Missing ${lang} label for filterKey "${fk}" — using key as fallback`);
      filters[fk] = fk;
    }
  }

  const oldCount = Object.keys(page.filters || {}).length;
  const newCount = Object.keys(filters).length;
  page.filters = filters;
  fs.writeFileSync(fp, JSON.stringify(page, null, 2) + '\n', 'utf8');
  console.log(`  ${lang}: ${oldCount} → ${newCount} filter keys written`);
}

console.log('\n=== Done ===');
console.log(`\nNext step: npm run generate-data-js  (to update .js bundles for static fallback)`);
console.log('\nTo change grouping: edit filterKey in data/solutions/zh.json, then re-run this script.');
