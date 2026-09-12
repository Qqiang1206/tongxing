/**
 * One-off: point the About-page client wall at the re-sourced logo set.
 * - changhong.gif -> changhong.webp (new transparent source)
 * Writes DB through the same writer the admin uses, then re-exports data/.
 *
 *   cd server && node scripts/patch-client-logos.mjs
 */
import { LANGS } from '../src/config.js';
import { readPageJson, writePageJsonAny } from '../src/services/catalog.js';

const REPLACE = [['assets/images/clients/changhong.gif', 'assets/images/clients/changhong.webp']];

let writes = 0;
for (const lang of LANGS) {
  const page = readPageJson('about', lang);
  if (!page) { console.log(`skip about/${lang}`); continue; }
  let changed = 0;
  const items = page.clients && page.clients.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      for (const [from, to] of REPLACE) {
        if (item.image === from) { item.image = to; changed += 1; }
      }
    }
  }
  if (!changed) { console.log(`no change about/${lang}`); continue; }
  writePageJsonAny('about', lang, page);
  writes += 1;
  console.log(`patched about/${lang} (${changed} logo path)`);
}
console.log(`\ndone: ${writes} writes`);
