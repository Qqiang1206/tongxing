/**
 * Sync home-slot columns + home page JSON into SQLite and regenerate JS.
 * Usage: node scripts/sync-home-slots.js  (from server/)
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR, LANGS } from '../src/config.js';
import { getDb } from '../src/db.js';
import {
  writeCatalogJsonAny,
  writePageJsonAny,
  exportCatalogLang,
  exportPageLang,
  regenerateCatalogJs,
} from '../src/services/catalog.js';
import { seedHomeSlotsIfEmpty } from '../src/services/homeSlots.js';

function loadJson(rel) {
  const p = path.join(DATA_DIR, rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const db = getDb();
seedHomeSlotsIfEmpty(db);

for (const kind of ['solutions', 'news']) {
  for (const lang of LANGS) {
    const data = loadJson(path.join(kind, `${lang}.json`));
    writeCatalogJsonAny(kind, lang, data);
    console.log('synced', kind, lang);
  }
  regenerateCatalogJs(kind, 'zh');
  for (const lang of ['en', 'ru']) exportCatalogLang(kind, lang);
}

for (const lang of LANGS) {
  const page = loadJson(path.join('pages/home', `${lang}.json`));
  writePageJsonAny('home', lang, page);
  exportPageLang('home', lang);
  console.log('synced home', lang);
}

const status = db
  .prepare(`SELECT id, home_slot FROM solutions WHERE home_slot != '' AND home_slot IS NOT NULL`)
  .all();
const news = db.prepare(`SELECT id FROM news WHERE home_featured = 1`).all();
console.log('solution slots', status);
console.log('news featured', news.map((n) => n.id));
console.log('done');
