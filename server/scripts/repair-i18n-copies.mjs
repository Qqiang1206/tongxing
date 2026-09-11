/**
 * Repair "locked-in Chinese": fields whose stored en/ru value is byte-identical
 * to its Chinese source (an old translation hiccup wrote the source back, and
 * the snapshot then froze it — see translationFields.isUntranslatedCopy).
 *
 * Scans every translatable resource, reports the offending paths, and re-runs
 * the normal translation pipeline only for the affected resource/lang pairs.
 * Idempotent: a second run finds nothing and touches nothing.
 *
 *   node scripts/repair-i18n-copies.mjs            # scan + repair
 *   node scripts/repair-i18n-copies.mjs --check    # scan only, exit 1 if found
 */
import {
  readCatalogJson,
  readPageJson,
  loadSiteSettings,
} from '../src/services/catalog.js';
import { collectStrings, getByPath, normalizeForCompare } from '../src/services/translationFields.js';
import { translateResource } from '../src/services/translateResource.js';
import { getDb } from '../src/db.js';

const LANGS = ['en', 'ru'];
const CJK_RE = /[\u4e00-\u9fff]/;
const CHECK_ONLY = process.argv.includes('--check');
const log = [];
const note = (s) => { log.push(s); console.log(s); };

function findCopies(sourceTree, existingTree, itemId) {
  const paths = [];
  const values = [];
  collectStrings(sourceTree, '', paths, values, itemId || null);
  const hits = [];
  for (let i = 0; i < paths.length; i++) {
    const src = values[i];
    if (!CJK_RE.test(String(src || ''))) continue;
    const stored = getByPath(existingTree, paths[i].includes(':') ? paths[i].split(':').slice(1).join(':') : paths[i]);
    if (typeof stored === 'string' && normalizeForCompare(stored) === normalizeForCompare(src)) {
      hits.push(paths[i]);
    }
  }
  return hits;
}

const db = getDb();

// 1) Purge poisoned glossary entries: an en/ru "translation" must never contain
//    Chinese. Such rows make every resource sharing that source string inherit
//    the broken value (read path now also ignores them, but delete for hygiene).
const poison = db
  .prepare('SELECT rowid, scope, lang, source_norm, translation FROM translation_memory')
  .all()
  .filter((r) => CJK_RE.test(String(r.translation || '')));
if (poison.length) {
  note(`Purging ${poison.length} poisoned glossary entr${poison.length === 1 ? 'y' : 'ies'}:`);
  for (const p of poison) note(`  [${p.scope}/${p.lang}] ${p.source_norm}`);
  if (!CHECK_ONLY) {
    const del = db.prepare('DELETE FROM translation_memory WHERE rowid = ?');
    for (const p of poison) del.run(p.rowid);
    note('  (deleted)');
  }
}

const pageKeys = db.prepare('SELECT DISTINCT page_key FROM pages ORDER BY page_key').all().map((r) => r.page_key);
const catalogKinds = ['products', 'solutions', 'news'];

/** resourceKey -> Map(lang -> [paths]) */
const dirty = new Map();
function mark(resourceKey, lang, paths) {
  if (!paths.length) return;
  if (!dirty.has(resourceKey)) dirty.set(resourceKey, new Map());
  dirty.get(resourceKey).set(lang, paths);
}

for (const kind of catalogKinds) {
  const zh = readCatalogJson(kind, 'zh') || {};
  for (const lang of LANGS) {
    const existing = readCatalogJson(kind, lang) || {};
    for (const id of Object.keys(zh)) {
      const hits = findCopies(zh[id], existing[id] || {}, id);
      if (hits.length) mark(kind, lang, hits.map((p) => `${id}:${p}`));
    }
  }
}

for (const lang of LANGS) {
  const hits = findCopies(loadSiteSettings('zh') || {}, loadSiteSettings(lang) || {}, null);
  if (hits.length) mark('site', lang, hits);
}
for (const pk of pageKeys) {
  for (const lang of LANGS) {
    const hits = findCopies(readPageJson(pk, 'zh') || {}, readPageJson(pk, lang) || {}, null);
    if (hits.length) mark(`pages:${pk}`, lang, hits);
  }
}

if (!dirty.size) {
  note('OK: no locked-in Chinese copies found anywhere.');
  process.exit(0);
}

note('Found locked-in Chinese copies:');
for (const [resourceKey, byLang] of dirty) {
  for (const [lang, paths] of byLang) {
    note(`  ${resourceKey} [${lang}]  x${paths.length}`);
    for (const p of paths) note(`      - ${p}`);
  }
}

if (CHECK_ONLY) {
  note('--check: nothing was written.');
  process.exit(1);
}

note('');
note('Repairing via the normal translation pipeline...');
let failed = 0;
for (const [resourceKey, byLang] of dirty) {
  const langs = [...byLang.keys()];
  try {
    const stats = await translateResource(resourceKey, langs, {});
    note(`  repaired ${resourceKey} ${JSON.stringify(langs)} -> strings=${stats.stringCount}`);
  } catch (e) {
    failed++;
    note(`  FAILED ${resourceKey} ${JSON.stringify(langs)}: ${e && e.message}`);
  }
}

note('');
note(failed ? `DONE with ${failed} failure(s).` : 'DONE: all repaired.');
process.exit(failed ? 1 : 0);
