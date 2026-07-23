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

const SKIP_KEYS = new Set([
  'id',
  'pageKey',
  'lang',
  'image',
  'cover',
  'href',
  'url',
  'navUrl',
  'src',
  'srcset',
  'model',
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
  'website',
  'mime',
  'path',
  'wechatImage',
]);

const CATALOG_KINDS = new Set(['products', 'news', 'solutions']);

export async function translateResource(resource, targetLangs) {
  const cfg = getTranslationConfig();
  if (!cfg.canWrite) {
    throw new Error('translation_not_configured');
  }

  const langs = (targetLangs || []).filter((l) => l === 'en' || l === 'ru');
  if (!langs.length) throw new Error('invalid_lang');

  const stats = { resource, provider: cfg.provider, model: cfg.model, langs: {}, stringCount: 0 };

  if (CATALOG_KINDS.has(resource)) {
    for (const lang of langs) {
      const r = await translateCatalog(resource, lang);
      stats.langs[lang] = r;
      stats.stringCount += r.strings;
    }
    return stats;
  }

  if (resource === 'site') {
    for (const lang of langs) {
      const r = await translateTree(loadSiteSettings('zh'), lang, (obj) => {
        writeSiteSettingsAny(lang, obj);
      });
      stats.langs[lang] = r;
      stats.stringCount += r.strings;
    }
    return stats;
  }

  const pageMatch = /^pages:(.+)$/.exec(resource);
  if (pageMatch) {
    const pageKey = pageMatch[1];
    const zh = readPageJson(pageKey, 'zh');
    if (!zh) throw new Error('not_found');
    for (const lang of langs) {
      const r = await translateTree(zh, lang, (obj) => {
        writePageJsonAny(pageKey, lang, obj);
      });
      stats.langs[lang] = r;
      stats.stringCount += r.strings;
    }
    return stats;
  }

  throw new Error('invalid_resource');
}

async function translateCatalog(kind, lang) {
  const zh = readCatalogJson(kind, 'zh');
  const out = {};
  let strings = 0;
  const ids = Object.keys(zh).sort((a, b) => Number(a) - Number(b));

  // Batch all extractable strings across items for fewer API calls
  const paths = [];
  const values = [];
  for (const id of ids) {
    collectStrings(zh[id], '', paths, values, id);
  }
  strings = values.length;
  const translated = values.length ? await translateTexts(values, lang) : [];
  let i = 0;
  for (const id of ids) {
    const clone = JSON.parse(JSON.stringify(zh[id]));
    applyStrings(clone, '', () => translated[i++]);
    clone.id = id;
    out[id] = clone;
  }

  writeCatalogJsonAny(kind, lang, out);
  regenerateCatalogJs(kind, lang);
  return { strings, items: ids.length };
}

async function translateTree(source, lang, writer) {
  const paths = [];
  const values = [];
  collectStrings(source, '', paths, values, null);
  const translated = values.length ? await translateTexts(values, lang) : [];
  const clone = JSON.parse(JSON.stringify(source));
  let i = 0;
  applyStrings(clone, '', () => translated[i++]);
  if (clone.lang != null) clone.lang = lang;
  writer(clone);
  return { strings: values.length };
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
