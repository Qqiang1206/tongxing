/**
 * Translate a resource from zh into target langs and write JSON + companion JS.
 */
import {
  readCatalogJson,
  writeCatalogJsonAny,
  regenerateCatalogJs,
  readPageJson,
  writePageJsonAny,
  loadSiteSettings,
  writeSiteSettingsAny,
} from './catalog.js';
import { translateTexts, getTranslationConfig } from './translateProvider.js';
import { getNorm, saveSnapshotBatch } from './translationSnapshot.js';

const SKIP_KEYS = new Set([
  'id',
  'pageKey',
  // 'category' intentionally NOT skipped — it holds display text (e.g. "光学元件组装")
  // that must be translated; the structural key lives in filterKey / categoryKey.
  'categoryKey',
  'filterKey',
  'filterKeyEn',
  'lang',
  'image',
  'cover',
  'href',
  'url',
  'navUrl',
  'src',
  'srcset',
  // 'model' intentionally NOT skipped — model names may contain Chinese suffixes
  // (e.g. "TXM-A 系列") that should be translated.
  'published',
  'date',
  'publishedAt',
  'slug',
  'icon',
  'type',
  'hover',
  'target',
  'colSpan',
  'layout',
  'marqueeDuration',
  'emphasis',
  'fetchpriority',
  'value',
  'step',
  'dotColor',
  'homeSlot',
  'homeFeatured',
  'sortOrder',
  'showInList',
  'website',
  'mime',
  'path',
  'wechatImage',
]);

const CATALOG_KINDS = new Set(['products', 'news', 'solutions']);

/**
 * Normalize a source string for change detection.
 * Punctuation, symbols and whitespace are stripped and the text is lower-cased,
 * so purely cosmetic edits (removing a period, toggling spaces) are treated as
 * "no change" and do NOT trigger a translation engine call.
 * Only used for comparison — the actual text sent to the engine is untouched.
 */
function normalizeForCompare(str) {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]/gu, '');
}

/** Read a value from an object by a dotted/bracketed path, e.g. "specs[0].label". */
function getByPath(obj, path) {
  if (obj == null) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

const ASSET_STRING_RE = /^(assets\/|https?:\/\/|mailto:|tel:|\/)/i;

/**
 * Mirror non-translatable "asset" fields (images, links, slugs, …) from the zh
 * data into a target-lang object, WITHOUT invoking the translation engine.
 *
 * - Fields in SKIP_KEYS, or strings that look like asset/URL paths, are always
 *   taken from zh (they never get translated — see collectStrings).
 * - Translatable text fields keep their existing target-lang value, falling
 *   back to zh only when no translation exists yet.
 *
 * This is the "mode 2" sync: asset-only edits (e.g. swapping the factory hero
 * image) are mirrored to en/ru immediately on save, independent of whether the
 * translation engine is configured or the scheduler has run.
 */
export function mirrorAssets(zhData, targetData) {
  if (zhData == null) return targetData;
  if (typeof zhData !== 'object') return zhData;
  // Arrays: merge element-by-element using index, so existing translations in
  // target elements are preserved instead of being overwritten with zh text.
  // New elements (where target has no counterpart) fall back to zh (source).
  if (Array.isArray(zhData)) {
    const targetArr = Array.isArray(targetData) ? targetData : [];
    return zhData.map(function (item, i) {
      return i < targetArr.length ? mirrorAssets(item, targetArr[i]) : item;
    });
  }
  const tObj =
    targetData && typeof targetData === 'object' && !Array.isArray(targetData) ? targetData : {};
  const result = {};
  for (const key of Object.keys(zhData)) {
    const zhVal = zhData[key];
    const tVal = tObj[key];
    if (SKIP_KEYS.has(key) || (typeof zhVal === 'string' && ASSET_STRING_RE.test(zhVal))) {
      // Non-translatable asset field → always take the zh value.
      result[key] = zhVal;
    } else if (typeof zhVal === 'object' && zhVal !== null) {
      result[key] = mirrorAssets(zhVal, tVal);
    } else {
      // Translatable scalar → keep existing translation, fall back to zh.
      result[key] = tVal !== undefined ? tVal : zhVal;
    }
  }
  // Keep any extra keys that exist only in the target (defensive — avoids
  // dropping manually-set values that happen to be absent from zh). Skip
  // asset-derived extras (e.g. a stale `imageSrcset` URL still pointing at the
  // old image) so they don't linger once zh drops them.
  for (const key of Object.keys(tObj)) {
    if (!(key in result)) {
      const v = tObj[key];
      if (SKIP_KEYS.has(key) || (typeof v === 'string' && ASSET_STRING_RE.test(v))) continue;
      result[key] = v;
    }
  }
  return result;
}

/**
 * Split a resource's collected strings into "reuse" vs "changed".
 * - Reuse: normalized source equals the stored snapshot AND a valid existing
 *   translation is available → keep the existing en/ru text (0 engine calls).
 * - Changed: everything else → send only those to the translation engine.
 * Returns the value array aligned to `values` order (changed slots = translated
 * or null), plus the snapshot entries to persist and the count of changed strings.
 */
async function classifyAndTranslate(resourceKey, lang, itemId, values, paths, existingObj, jobId) {
  const changedValues = [];
  const order = [];
  const changes = [];
  for (let k = 0; k < values.length; k++) {
    const p = paths[k];
    const srcNorm = normalizeForCompare(values[k]);
    const prevNorm = getNorm(resourceKey, lang, itemId, p);
    const lookupPath = itemId ? p.slice(p.indexOf(':') + 1) : p;
    const ex = existingObj != null ? getByPath(existingObj, lookupPath) : undefined;
    if (prevNorm === srcNorm && typeof ex === 'string' && ex.length) {
      order.push(ex);
    } else {
      order.push(null);
      changedValues.push(values[k]);
    }
    changes.push([resourceKey, lang, itemId, p, srcNorm]);
  }
  const translated = changedValues.length ? await translateTexts(changedValues, lang, { jobId }) : [];
  let ci = 0;
  const finalValues = order.map((reused) => {
    if (reused != null) return reused;
    const t = translated[ci++];
    return typeof t === 'string' && t.length ? t : null;
  });
  return { finalValues, changes, strings: changedValues.length };
}

export async function translateResource(resource, targetLangs, opts) {
  const cfg = getTranslationConfig();
  if (!cfg.canWrite) {
    throw new Error('translation_not_configured');
  }

  const langs = (targetLangs || []).filter((l) => l === 'en' || l === 'ru');
  if (!langs.length) throw new Error('invalid_lang');

  const jobId = opts && opts.jobId != null ? Number(opts.jobId) : null;
  const stats = { resource, provider: cfg.provider, model: cfg.model, langs: {}, stringCount: 0 };

  if (CATALOG_KINDS.has(resource)) {
    const results = await Promise.all(
      langs.map((lang) => translateCatalog(resource, lang, jobId))
    );
    langs.forEach((lang, i) => {
      stats.langs[lang] = results[i];
      stats.stringCount += results[i].strings;
    });
    return stats;
  }

  if (resource === 'site') {
    const results = await Promise.all(
      langs.map((lang) => {
        const existing = loadSiteSettings(lang);
        return translateTree(
          loadSiteSettings('zh'),
          lang,
          existing,
          (obj) => {
            // Preserve footer fields that have language-specific values.
            // ICP number format differs per language; AI tends to skip
            // translating it, so keep the existing manually-set value.
            if (existing && existing.footer && obj.footer) {
              if (existing.footer.icp) obj.footer.icp = existing.footer.icp;
              if (existing.footer.icpUrl) obj.footer.icpUrl = existing.footer.icpUrl;
            }
            writeSiteSettingsAny(lang, obj);
          },
          jobId,
          'site'
        );
      })
    );
    langs.forEach((lang, i) => {
      stats.langs[lang] = results[i];
      stats.stringCount += results[i].strings;
    });
    return stats;
  }

  const pageMatch = /^pages:(.+)$/.exec(resource);
  if (pageMatch) {
    const pageKey = pageMatch[1];
    const zh = readPageJson(pageKey, 'zh');
    if (!zh) throw new Error('not_found');
    const results = await Promise.all(
      langs.map((lang) =>
        translateTree(
          zh,
          lang,
          readPageJson(pageKey, lang),
          (obj) => {
            writePageJsonAny(pageKey, lang, obj);
          },
          jobId,
          `pages:${pageKey}`
        )
      )
    );
    langs.forEach((lang, i) => {
      stats.langs[lang] = results[i];
      stats.stringCount += results[i].strings;
    });
    return stats;
  }

  throw new Error('invalid_resource');
}

async function translateCatalog(kind, lang, jobId) {
  const zh = readCatalogJson(kind, 'zh');
  const existing = readCatalogJson(kind, lang);
  const out = {};
  let strings = 0;
  const ids = Object.keys(zh).sort((a, b) => Number(a) - Number(b));

  const snapshotChanges = [];

  for (const id of ids) {
    const paths = [];
    const values = [];
    collectStrings(zh[id], '', paths, values, id);

    if (!values.length) {
      // No translatable text — still mirror zh (image/slug/etc.) to target lang.
      const clone = JSON.parse(JSON.stringify(zh[id]));
      clone.id = id;
      out[id] = clone;
      continue;
    }

    const { finalValues, changes, strings: changed } = await classifyAndTranslate(
      kind,
      lang,
      id,
      values,
      paths,
      existing ? existing[id] : null,
      jobId
    );

    // Non-text fields (image/slug/href/...) are inherited from zh via the clone.
    const appliedValues = finalValues.map((v, k) => (v != null ? v : values[k]));
    const clone = JSON.parse(JSON.stringify(zh[id]));
    let i = 0;
    applyStrings(clone, '', () => appliedValues[i++]);
    clone.id = id;
    out[id] = clone;

    strings += changed;
    for (const c of changes) snapshotChanges.push(c);
  }

  writeCatalogJsonAny(kind, lang, out);
  regenerateCatalogJs(kind, lang);
  saveSnapshotBatch(snapshotChanges);
  return { strings, items: ids.length };
}

async function translateTree(source, lang, existing, writer, jobId, resourceKey) {
  const paths = [];
  const values = [];
  collectStrings(source, '', paths, values, null);
  if (!values.length) {
    const clone = JSON.parse(JSON.stringify(source));
    if (clone.lang != null) clone.lang = lang;
    writer(clone);
    return { strings: 0 };
  }
  const { finalValues, changes, strings } = await classifyAndTranslate(
    resourceKey,
    lang,
    '',
    values,
    paths,
    existing,
    jobId
  );
  const appliedValues = finalValues.map((v, k) => (v != null ? v : values[k]));
  const clone = JSON.parse(JSON.stringify(source));
  let i = 0;
  applyStrings(clone, '', () => appliedValues[i++]);
  if (clone.lang != null) clone.lang = lang;
  writer(clone);
  saveSnapshotBatch(changes);
  return { strings };
}

function collectStrings(node, path, paths, values, itemId) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (!node.trim()) return;
    // skip pure paths / urls / emails
    if (/^(assets\/|https?:\/\/|mailto:|tel:|\/)/i.test(node)) return;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(node)) return;
    paths.push(itemId ? `${itemId}:${path}` : path);
    values.push(node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, idx) => collectStrings(child, `${path}[${idx}]`, paths, values, itemId));
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      collectStrings(node[key], path ? `${path}.${key}` : key, paths, values, itemId);
    }
  }
}

function applyStrings(node, path, next) {
  if (node == null) return;
  if (typeof node === 'string') {
    // Leaf strings that were collected get replaced by walking same order.
    // Non-collected strings (skipped) must stay — detect same rules.
    if (!node.trim()) return;
    if (/^(assets\/|https?:\/\/|mailto:|tel:|\/)/i.test(node)) return;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(node)) return;
    // Parent applies replacement by mutating — need parent reference.
    // This function only works for objects/arrays; string leaves handled by parent.
    return;
  }
  if (Array.isArray(node)) {
    for (let idx = 0; idx < node.length; idx++) {
      if (typeof node[idx] === 'string') {
        const s = node[idx];
        if (!s.trim()) continue;
        if (/^(assets\/|https?:\/\/|mailto:|tel:|\/)/i.test(s)) continue;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) continue;
        node[idx] = next();
      } else {
        applyStrings(node[idx], `${path}[${idx}]`, next);
      }
    }
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const val = node[key];
      if (typeof val === 'string') {
        if (!val.trim()) continue;
        if (/^(assets\/|https?:\/\/|mailto:|tel:|\/)/i.test(val)) continue;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) continue;
        node[key] = next();
      } else {
        applyStrings(val, path ? `${path}.${key}` : key, next);
      }
    }
  }
}
