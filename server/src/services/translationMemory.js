import { getDb } from '../db.js';
import { normalizeForCompare } from './translationFields.js';

const PAGE_TITLE_SCOPE = 'page-title';
const SHARED_PAGE_TITLE_PATHS = new Set(['seo.title', 'hero.title']);

/** Canonical homepage brand copy. Other pages keep independent titles. */
const FIXED_PAGE_TITLE_TRANSLATIONS = new Map([
  [
    normalizeForCompare('同兴高科 TXAM - 中国领先的自动化品牌供应商'),
    {
      en: "TXAM - China's Leading Automation Equipment Supplier",
      ru: 'TXAM - Ведущий поставщик автоматизации в Китае',
    },
  ],
  [
    normalizeForCompare('精工制臻 同兴必达'),
    {
      en: 'Precision Manufacturing, TXAM Delivers',
      ru: 'Точное производство, TXAM выполняет',
    },
  ],
]);

export function isSharedPageTitlePath(path) {
  return SHARED_PAGE_TITLE_PATHS.has(String(path || ''));
}

export function getFixedPageTitleTranslation(path, source, lang) {
  if (!isSharedPageTitlePath(path) || (lang !== 'en' && lang !== 'ru')) return null;
  const translations = FIXED_PAGE_TITLE_TRANSLATIONS.get(normalizeForCompare(source));
  return translations && translations[lang] ? translations[lang] : null;
}

export function getSharedPageTitleTranslation(path, source, lang) {
  const fixed = getFixedPageTitleTranslation(path, source, lang);
  if (fixed) return fixed;
  if (!isSharedPageTitlePath(path) || (lang !== 'en' && lang !== 'ru')) return null;

  const sourceNorm = normalizeForCompare(source);
  if (!sourceNorm) return null;
  const row = getDb()
    .prepare(
      `SELECT translation
       FROM translation_memory
       WHERE scope = ? AND source_norm = ? AND lang = ?`
    )
    .get(PAGE_TITLE_SCOPE, sourceNorm, lang);
  return row && row.translation ? row.translation : null;
}

/**
 * Store successful translations only after the translated resource has been
 * written. The first translation becomes canonical for future resources.
 */
export function rememberSharedPageTitleTranslations(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) return 0;

  const db = getDb();
  let changes = 0;
  for (const entry of rows) {
    if (!entry || !isSharedPageTitlePath(entry.path)) continue;
    const lang = entry.lang;
    if (lang !== 'en' && lang !== 'ru') continue;
    const sourceNorm = normalizeForCompare(entry.source);
    const translation = String(entry.translation || '').trim();
    if (!sourceNorm || !translation) continue;

    const fixed = getFixedPageTitleTranslation(entry.path, entry.source, lang);
    const result = fixed
      ? db.prepare(
          `INSERT INTO translation_memory
             (scope, source_norm, lang, translation, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(scope, source_norm, lang) DO UPDATE SET
             translation = excluded.translation,
             updated_at = datetime('now')`
        ).run(PAGE_TITLE_SCOPE, sourceNorm, lang, fixed)
      : db.prepare(
          `INSERT INTO translation_memory
             (scope, source_norm, lang, translation, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(scope, source_norm, lang) DO NOTHING`
        ).run(PAGE_TITLE_SCOPE, sourceNorm, lang, translation);
    changes += result.changes || 0;
  }
  return changes;
}
