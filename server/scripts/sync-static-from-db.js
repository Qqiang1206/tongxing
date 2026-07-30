/**
 * Regenerate ALL static data files from the SQLite DB — without touching the DB.
 *
 * The front-end is static-first: it reads data/{kind,pages,i18n}/{lang}.js
 * globals (data/*.json as fallback), NOT the runtime API. Those files are
 * auto-synced by the server's own writers (admin CRUD, translation apply,
 * import). Two paths can still leave them stale, though:
 *   1. db.js boot migrations (filter_key / home_slot / news category_key
 *      backfills) write DB but don't export.
 *   2. External/direct DB edits that bypass writePageJsonAny / catalog upserts.
 *
 * Run this after either to guarantee "the .js the front-end reads == DB".
 * Safe to run while the server is up (read-only on DB; only writes data/ files).
 *
 *   npm run sync:static      # from server/ or repo root
 */
import { exportCatalogLang, exportSiteLang, exportPageLang } from '../src/services/catalog.js';
import { LANGS } from '../src/config.js';
import { getDb } from '../src/db.js';

// This script's whole purpose is to write the static files, so force sync on
// even if the env has SYNC_JSON_ON_WRITE=0.
process.env.SYNC_JSON_ON_WRITE = '1';

const db = getDb();
const pageKeys = db
  .prepare('SELECT DISTINCT page_key FROM pages ORDER BY page_key')
  .all()
  .map((r) => r.page_key);
const kinds = ['products', 'solutions', 'news'];

let groups = 0;
const log = [];
for (const lang of LANGS) {
  for (const kind of kinds) {
    if (exportCatalogLang(kind, lang)) { groups++; log.push(`${kind}/${lang}`); }
  }
  if (exportSiteLang(lang)) { groups++; log.push(`site/${lang}`); }
  for (const pk of pageKeys) {
    if (exportPageLang(pk, lang)) { groups++; log.push(`pages/${pk}/${lang}`); }
  }
}
console.log(`sync-static-from-db: regenerated ${groups} file groups`);
console.log(`  langs=${LANGS.join(',')} kinds=${kinds.join(',')} pages=${pageKeys.join(',')}`);
