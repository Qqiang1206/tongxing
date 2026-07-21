/**
 * Import data/*.json into SQLite (server/data/txam.db).
 * Usage: node scripts/import-from-json.js
 *        node scripts/import-from-json.js --reset
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR, LANGS, REPO_ROOT } from '../src/config.js';
import { closeDb, getDb, resolveSqlitePath } from '../src/db.js';
import {
  writeCatalogJsonAny,
  writePageJsonAny,
  writeSiteSettingsAny,
  SOLUTION_SLUG_BY_ID,
  exportCatalogLang,
  exportPageLang,
  exportSiteLang,
} from '../src/services/catalog.js';
import { applyProductListSeed } from './product-list-seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes('--reset');

function loadJson(rel) {
  const p = path.join(DATA_DIR, rel);
  if (!fs.existsSync(p)) {
    console.warn('skip missing', rel);
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const dbPath = resolveSqlitePath();
  if (reset && fs.existsSync(dbPath)) {
    closeDb();
    fs.unlinkSync(dbPath);
    const wal = dbPath + '-wal';
    const shm = dbPath + '-shm';
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
    console.log('removed', dbPath);
  }

  const db = getDb();
  console.log('SQLite:', dbPath);

  // catalogs
  for (const kind of ['products', 'solutions', 'news']) {
    for (const lang of LANGS) {
      const data = loadJson(path.join(kind, `${lang}.json`));
      if (!data) continue;
      if (kind === 'solutions') {
        for (const id of Object.keys(data)) {
          if (!data[id].slug) data[id].slug = SOLUTION_SLUG_BY_ID[id] || id;
        }
      }
      writeCatalogJsonAny(kind, lang, data);
      console.log(`imported ${kind}/${lang}: ${Object.keys(data).length}`);
    }
  }

  // Apply product center list flags / order / filter keys (zh source)
  applyProductListSeed(db);
  console.log('seeded product list metadata');

  // site i18n
  for (const lang of LANGS) {
    const data = loadJson(path.join('i18n', `${lang}.json`));
    if (!data) continue;
    // ensure new common keys exist
    data.common = data.common || {};
    if (!data.common.applicationAreas) {
      data.common.applicationAreas =
        lang === 'en' ? 'Application Areas' : lang === 'ru' ? 'Области применения' : '应用领域';
    }
    if (!data.common.techAdvantages) {
      data.common.techAdvantages =
        lang === 'en' ? 'Technical Advantages' : lang === 'ru' ? 'Технические преимущества' : '技术优势';
    }
    writeSiteSettingsAny(lang, data);
    console.log(`imported site/${lang}`);
  }

  // pages
  for (const pageKey of ['home', 'about', 'contact', 'products', 'news', 'solutions']) {
    for (const lang of LANGS) {
      const data = loadJson(path.join('pages', pageKey, `${lang}.json`));
      if (!data) continue;
      writePageJsonAny(pageKey, lang, data);
      console.log(`imported pages/${pageKey}/${lang}`);
    }
  }

  // optional: import translation-status.json
  const statusPath = path.join(DATA_DIR, 'meta', 'translation-status.json');
  if (fs.existsSync(statusPath)) {
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    const upsert = db.prepare(`
      INSERT INTO resource_translation_status (resource, lang, status, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(resource, lang) DO UPDATE SET status=excluded.status, updated_at=datetime('now')
    `);
    for (const [resource, langs] of Object.entries(status.resources || {})) {
      for (const [lang, st] of Object.entries(langs)) {
        if (lang === 'en' || lang === 'ru') upsert.run(resource, lang, st);
      }
    }
    console.log('imported translation-status');
  }

  // ensure JSON export mirrors DB
  for (const kind of ['products', 'solutions', 'news']) {
    for (const lang of LANGS) exportCatalogLang(kind, lang);
  }
  for (const lang of LANGS) exportSiteLang(lang);
  for (const pageKey of ['home', 'about', 'contact']) {
    for (const lang of LANGS) exportPageLang(pageKey, lang);
  }

  console.log('\nImport complete. Start API: npm run dev');
  console.log('Repo root:', REPO_ROOT);
}

main();
