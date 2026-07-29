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
import { getItemSnapshot, replaceSnapshotBatch } from './translationSnapshot.js';
import {
  getSharedPageTitleTranslation,
  isSharedPageTitlePath,
  rememberSharedPageTitleTranslations,
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
          regenerateCatalogJs(resource, langs[index]);
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
  const data = {};
  const changes = [];
  const scopes = [];
  let strings = 0;
  const ids = Object.keys(source).sort((a, b) => Number(a) - Number(b));

  for (const id of ids) {
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
        existing ? existing[id] : null,
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
