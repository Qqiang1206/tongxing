/**
 * One-off: sync the About-page client wall with the re-sourced logo set.
 *  - drop HUAKETEK (no usable source, stacked square shape looked out of place)
 *  - cache-bust the remaining logos (same filenames were cached by browsers)
 * Writes DB through the same writer the admin uses, then re-exports data/.
 * Idempotent: safe to re-run on deploy.
 *
 *   cd server && node scripts/patch-client-logos.mjs
 */
import { LANGS } from '../src/config.js';
import { readPageJson, writePageJsonAny } from '../src/services/catalog.js';

const V = '?v=20260912';
const REMOVE_IMAGES = ['clients/huake.webp'];

let writes = 0;
for (const lang of LANGS) {
  const page = readPageJson('about', lang);
  if (!page) { console.log(`skip about/${lang}`); continue; }
  const items = page.clients && page.clients.items;
  if (!Array.isArray(items)) { console.log(`no clients about/${lang}`); continue; }

  const kept = items.filter(
    (item) => !REMOVE_IMAGES.some((frag) => String(item.image || '').includes(frag))
  );
  const removed = items.length - kept.length;
  let busted = 0;
  for (const item of kept) {
    if (typeof item.image === 'string' && item.image.includes('/clients/') && !item.image.includes('?')) {
      item.image = item.image + V;
      busted += 1;
    }
  }
  if (!removed && !busted) { console.log(`no change about/${lang}`); continue; }
  page.clients.items = kept;
  writePageJsonAny('about', lang, page);
  writes += 1;
  console.log(`patched about/${lang} (removed ${removed}, cache-busted ${busted}, kept ${kept.length})`);
}
console.log(`\ndone: ${writes} writes`);
