/**
 * One-off: cache-bust the About-page client logos after the asset re-source
 * (same filenames were cached by browsers, so new files were not picked up).
 *
 *   cd server && node scripts/patch-client-logos.mjs
 */
import { LANGS } from '../src/config.js';
import { readPageJson, writePageJsonAny } from '../src/services/catalog.js';

const V = '?v=20260912';

let writes = 0;
for (const lang of LANGS) {
  const page = readPageJson('about', lang);
  if (!page) { console.log(`skip about/${lang}`); continue; }
  let changed = 0;
  const items = page.clients && page.clients.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (typeof item.image === 'string' && item.image.includes('/clients/') && !item.image.includes('?')) {
        item.image = item.image + V;
        changed += 1;
      }
    }
  }
  if (!changed) { console.log(`no change about/${lang}`); continue; }
  writePageJsonAny('about', lang, page);
  writes += 1;
  console.log(`patched about/${lang} (${changed} logo urls)`);
}
console.log(`\ndone: ${writes} writes`);
