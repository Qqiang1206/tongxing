/**
 * Translate a resource from zh into target langs and write JSON + companion JS.
 */
import {
  readCatalogJson,
  writeCatalogJsonAny,
  readPageJson,
  writePageJsonAny,
  loadSiteSettings,
  writeSiteSettingsAny,
} from './catalog.js';
import { getDb } from '../db.js';
import { translateTexts, getTranslationConfig } from './translateProvider.js';
import { getItemSnapshot, replaceSnapshotBatch } from './translationSnapshot.js';
import {
  getSharedPageTitleTranslation,
  isSharedPageTitlePath,
  rememberSharedPageTitleTranslations,
  getTermTranslation,
  rememberTermTranslations,
} from './translationMemory.js';
import {
  applyStrings as applyTranslationStrings,
  buildBeforeCommit,
  collectStrings as collectTranslationStrings,
  normalizeForCompare,
  planTranslations,
  snapshotEntries,
} from './translationFields.js';

const CATALOG_KINDS = new Set(['products', 'news', 'solutions']);
const CJK_RE = /[\u4e00-\u9fff]/;
const CATALOG_I18N = {
  products: ['product_i18n', 'product_id'],
  solutions: ['solution_i18n', 'solution_id'],
  news: ['news_i18n', 'news_id'],
};

async function classifyAndTranslate(resourceKey, lang, itemId, values, paths, existingObj, jobId) {
  const snapshot = getItemSnapshot(resourceKey, lang, itemId);
  const plan = planTranslations({
    paths,
    values,
    existingObj,
    snapshot,
    itemId,
  });
  const finalValues = plan.planned.slice();
  const requests = [];
  const requestGroups = [];
  const sharedPending = new Map();
  const memoryEntries = [];

  for (let index = 0; index < values.length; index++) {
    const path = paths[index];
    const source = values[index];
    const shared = getSharedPageTitleTranslation(path, source, lang);

    // Canonical/fixed copy wins even when the source snapshot did not change.
    // This heals old per-page translation drift on the next resource sync.
    if (shared) {
      finalValues[index] = shared;
      memoryEntries.push({ path, source, lang, translation: shared });
      continue;
    }

    if (finalValues[index] != null) {
      if (isSharedPageTitlePath(path)) {
        memoryEntries.push({ path, source, lang, translation: finalValues[index] });
      }
      continue;
    }

    // Term glossary lookup (short recurring strings: specs, labels, etc.)
    const term = getTermTranslation(source, lang);
    if (term) {
      finalValues[index] = term;
      continue;
    }

    if (isSharedPageTitlePath(path)) {
      const sourceNorm = normalizeForCompare(source);
      const existingGroup = sharedPending.get(sourceNorm);
      if (existingGroup) {
        existingGroup.slots.push(index);
        continue;
      }
      const group = { slots: [index], path, source, shared: true };
      sharedPending.set(sourceNorm, group);
      requestGroups.push(group);
      requests.push(source);
      continue;
    }

    requestGroups.push({ slots: [index], path, source, shared: false });
    requests.push(source);
  }

  const translated = requests.length
    ? await translateTexts(requests, lang, { jobId })
    : [];
  requestGroups.forEach((group, requestIndex) => {
    const value = translated[requestIndex];
    const resolved = typeof value === 'string' && value.length ? value : null;
    group.slots.forEach((slot) => {
      finalValues[slot] = resolved;
    });
    if (group.shared && resolved) {
      memoryEntries.push({
        path: group.path,
        source: group.source,
        lang,
        translation: resolved,
      });
    }
  });

  // Write back new term translations (first-come-first-served)
  const termEntries = requestGroups
    .filter((g) => !g.shared)
    .map((g, i) => ({ source: g.source, lang, translation: translated[i] }))
    .filter((e) => e.translation);
  rememberTermTranslations(termEntries);

  // Detect residual Chinese in translated output
  for (let i = 0; i < finalValues.length; i++) {
    const v = finalValues[i];
    if (typeof v === 'string' && CJK_RE.test(v)) {
      console.warn(
        '[translation] residual Chinese in %s/%s path=%s: "%s"',
        resourceKey, lang, paths[i], v.slice(0, 80)
      );
    }
  }

  return {
    finalValues,
    changes: snapshotEntries(resourceKey, lang, itemId, paths, values),
    strings: requests.length,
    memoryEntries,
  };
}

/** Build every target first so an API failure cannot partially rewrite one language. */
export async function translateResource(resource, targetLangs, opts) {
  const cfg = getTranslationConfig();
  if (!cfg.canWrite) throw new Error('translation_not_configured');

  const langs = (targetLangs || []).filter((lang) => lang === 'en' || lang === 'ru');
  if (!langs.length) throw new Error('invalid_lang');

  const jobId = opts && opts.jobId != null ? Number(opts.jobId) : null;
  const stats = { resource, provider: cfg.provider, model: cfg.model, langs: {}, stringCount: 0 };
  let prepared;

  if (CATALOG_KINDS.has(resource)) {
    prepared = await buildBeforeCommit(
      langs.map((lang) => () => buildTranslatedCatalog(resource, lang, jobId)),
      (results) => {
        results.forEach((result, index) => {
          writeCatalogJsonAny(resource, langs[index], result.data);
        });
      }
    );
  } else if (resource === 'site') {
    const source = loadSiteSettings('zh');
    const existingByLang = langs.map((lang) => loadSiteSettings(lang));
    prepared = await buildBeforeCommit(
      langs.map((lang, index) => () =>
        buildTranslatedTree(source, lang, existingByLang[index], jobId, 'site')
      ),
      (results) => {
        results.forEach((result, index) => {
          const existing = existingByLang[index];
          if (existing && existing.footer && result.data.footer) {
            if (existing.footer.icp) result.data.footer.icp = existing.footer.icp;
            if (existing.footer.icpUrl) result.data.footer.icpUrl = existing.footer.icpUrl;
          }
          writeSiteSettingsAny(langs[index], result.data);
        });
      }
    );
  } else {
    const pageMatch = /^pages:(.+)$/.exec(resource);
    if (!pageMatch) throw new Error('invalid_resource');
    const pageKey = pageMatch[1];
    const source = readPageJson(pageKey, 'zh');
    if (!source) throw new Error('not_found');
    prepared = await buildBeforeCommit(
      langs.map((lang) => () =>
        buildTranslatedTree(source, lang, readPageJson(pageKey, lang), jobId, resource)
      ),
      (results) => {
        results.forEach((result, index) => {
          writePageJsonAny(pageKey, langs[index], result.data);
        });
      }
    );
  }

  rememberSharedPageTitleTranslations(
    prepared.flatMap((result) => result.memoryEntries || [])
  );
  replaceSnapshotBatch(
    prepared.flatMap((result) => result.scopes),
    prepared.flatMap((result) => result.changes)
  );
  prepared.forEach((result, index) => {
    stats.langs[langs[index]] = result.items == null
      ? { strings: result.strings }
      : { strings: result.strings, items: result.items };
    stats.stringCount += result.strings;
  });
  return stats;
}

async function buildTranslatedCatalog(kind, lang, jobId) {
  const source = readCatalogJson(kind, 'zh');
  const existing = readCatalogJson(kind, lang);
  // Per-item scope: only translate rows that are stale/missing, so a zh save
  // of one item never re-translates (and re-exports) the whole catalog.
  const [i18nTable, idCol] = CATALOG_I18N[kind];
  const staleRows = getDb()
    .prepare(
      `SELECT ${idCol} AS id FROM ${i18nTable}
       WHERE lang = ? AND translation_status IN ('stale','missing')`
    )
    .all(lang);
  const staleIds = new Set(staleRows.map((r) => String(r.id)));
  const data = {};
  const changes = [];
  const scopes = [];
  let strings = 0;
  const ids = Object.keys(source).sort((a, b) => Number(a) - Number(b));

  for (const id of ids) {
    const existingItem = existing ? existing[id] : null;
    if (!staleIds.has(id)) {
      // Carry over the current en/ru content untouched (fall back to zh clone).
      data[id] = existingItem || JSON.parse(JSON.stringify(source[id]));
      data[id].id = id;
      continue;
    }
    const paths = [];
    const values = [];
    collectTranslationStrings(source[id], '', paths, values, id);
    scopes.push([kind, lang, id]);

    const clone = JSON.parse(JSON.stringify(source[id]));
    if (values.length) {
      const result = await classifyAndTranslate(
        kind,
        lang,
        id,
        values,
        paths,
        existingItem,
        jobId
      );
      const applied = result.finalValues.map((value, index) => value != null ? value : values[index]);
      let valueIndex = 0;
      applyTranslationStrings(clone, '', () => applied[valueIndex++]);
      strings += result.strings;
      changes.push(...result.changes);
    }
    clone.id = id;
    data[id] = clone;
  }

  return { data, strings, items: ids.length, changes, scopes };
}

async function buildTranslatedTree(source, lang, existing, jobId, resourceKey) {
  const paths = [];
  const values = [];
  collectTranslationStrings(source, '', paths, values, null);
  const clone = JSON.parse(JSON.stringify(source));
  const scopes = [[resourceKey, lang, '']];

  if (!values.length) {
    if (clone.lang != null) clone.lang = lang;
    return { data: clone, strings: 0, changes: [], scopes, memoryEntries: [] };
  }

  const result = await classifyAndTranslate(
    resourceKey,
    lang,
    '',
    values,
    paths,
    existing,
    jobId
  );
  const applied = result.finalValues.map((value, index) => value != null ? value : values[index]);
  let valueIndex = 0;
  applyTranslationStrings(clone, '', () => applied[valueIndex++]);
  if (clone.lang != null) clone.lang = lang;
  return {
    data: clone,
    strings: result.strings,
    changes: result.changes,
    scopes,
    memoryEntries: result.memoryEntries,
  };
}
