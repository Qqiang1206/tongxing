/** Pure helpers for collecting, comparing and reusing translated fields. */

export const SKIP_KEYS = new Set([
  'id',
  'pageKey',
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
  // timestamps change on every save; never translatable metadata
  'updatedAt',
  'createdAt',
]);

const ASSET_STRING_RE = /^(assets\/|https?:\/\/|mailto:|tel:|\/)/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CJK_RE = /[\u4e00-\u9fff]/;

/**
 * A stored "translation" that is identical to its Chinese source was never
 * actually translated — this happens when a translation API call hiccups and
 * the pipeline falls back to writing the source back (see translateResource.js).
 * The snapshot then records that source value, so the reuse logic would treat
 * the Chinese copy as a valid translation forever ("locked-in Chinese").
 * Detect that case so the value is retranslated instead of reused.
 *
 * Only fires when the SOURCE contains Chinese: a Latin source that legitimately
 * translates to itself (brand names, "3C", numbers) must still be reusable.
 */
function isUntranslatedCopy(source, candidate) {
  return (
    typeof candidate === 'string' &&
    CJK_RE.test(String(source || '')) &&
    normalizeForCompare(candidate) === normalizeForCompare(source)
  );
}

/**
 * Normalize only formatting noise. Punctuation and symbols are intentionally
 * retained so edits such as changing a colon or percentage sign are synced.
 */
export function normalizeForCompare(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .toLowerCase();
}

export function isTranslatableString(value) {
  return typeof value === 'string' &&
    Boolean(value.trim()) &&
    !ASSET_STRING_RE.test(value) &&
    !EMAIL_RE.test(value);
}

/** Read a value by a dotted/bracketed path, e.g. specs[0].label. */
export function getByPath(obj, path) {
  if (obj == null) return undefined;
  const parts = String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function lookupPath(path, itemId) {
  if (!itemId) return path;
  const colon = path.indexOf(':');
  return colon >= 0 ? path.slice(colon + 1) : path;
}

/** Array indexes are ignored only for relocation matching, never for snapshots. */
export function pathShape(path) {
  return String(path || '').replace(/\[\d+\]/g, '[*]');
}

export function collectStrings(node, path, paths, values, itemId) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (!isTranslatableString(node)) return;
    paths.push(itemId ? `${itemId}:${path}` : path);
    values.push(node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, index) => collectStrings(child, `${path}[${index}]`, paths, values, itemId));
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      collectStrings(node[key], path ? `${path}.${key}` : key, paths, values, itemId);
    }
  }
}

export function applyStrings(node, path, next) {
  if (node == null || typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index++) {
      const itemPath = `${path}[${index}]`;
      if (typeof node[index] === 'string') {
        if (isTranslatableString(node[index])) node[index] = next(itemPath, node[index]);
      } else {
        applyStrings(node[index], itemPath, next);
      }
    }
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      const itemPath = path ? `${path}.${key}` : key;
      if (typeof value === 'string') {
        if (isTranslatableString(value)) node[key] = next(itemPath, value);
      } else {
        applyStrings(value, itemPath, next);
      }
    }
  }
}

export function snapshotEntries(resourceKey, lang, itemId, paths, values) {
  return paths.map((path, index) => [
    resourceKey,
    lang,
    itemId || '',
    path,
    normalizeForCompare(values[index]),
  ]);
}

/**
 * Decide which values can reuse existing translations. Exact paths win. When
 * an array item moved, a same-shaped old path with the same normalized source
 * may be reused, preventing insert/delete/reorder operations from retranslating
 * unrelated rows.
 */
export function planTranslations({ paths, values, existingObj, snapshot, itemId }) {
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const planned = new Array(values.length).fill(null);
  const changedValues = [];
  const changedIndexes = [];
  const usedOldPaths = new Set();
  const candidates = new Map();

  for (const [oldPath, oldNorm] of Object.entries(snap)) {
    const translated = getByPath(existingObj, lookupPath(oldPath, itemId));
    if (typeof translated !== 'string') continue;
    const key = `${pathShape(oldPath)}\u0000${oldNorm}`;
    if (!candidates.has(key)) candidates.set(key, []);
    candidates.get(key).push({ path: oldPath, value: translated });
  }

  for (let index = 0; index < values.length; index++) {
    const path = paths[index];
    const sourceNorm = normalizeForCompare(values[index]);
    const exact = getByPath(existingObj, lookupPath(path, itemId));
    if (
      snap[path] === sourceNorm &&
      typeof exact === 'string' &&
      !isUntranslatedCopy(values[index], exact)
    ) {
      planned[index] = exact;
      usedOldPaths.add(path);
      continue;
    }

    const key = `${pathShape(path)}\u0000${sourceNorm}`;
    const relocated = (candidates.get(key) || []).find(
      (entry) =>
        !usedOldPaths.has(entry.path) &&
        !isUntranslatedCopy(values[index], entry.value)
    );
    if (relocated) {
      planned[index] = relocated.value;
      usedOldPaths.add(relocated.path);
      continue;
    }

    changedIndexes.push(index);
    changedValues.push(values[index]);
  }

  return { planned, changedIndexes, changedValues };
}

export function mergeTranslatedValues(plan, translated) {
  let translatedIndex = 0;
  return plan.planned.map((value) => {
    if (value != null) return value;
    const next = translated[translatedIndex++];
    return typeof next === 'string' && next.length ? next : null;
  });
}

/** Resolve every builder before allowing any write callback to run. */
export async function buildBeforeCommit(builders, commit) {
  const prepared = await Promise.all((builders || []).map((builder) => builder()));
  await commit(prepared);
  return prepared;
}
