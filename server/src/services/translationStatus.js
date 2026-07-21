import { getDb } from '../db.js';

const DERIVED_LANGS = ['en', 'ru'];

const DEFAULT_RESOURCES = [
  'products',
  'news',
  'solutions',
  'site',
  'pages:contact',
  'pages:home',
  'pages:about',
  'pages:products',
  'pages:news',
  'pages:solutions',
];

export function readTranslationStatus() {
  const db = getDb();
  const rows = db
    .prepare('SELECT resource, lang, status, updated_at FROM resource_translation_status')
    .all();
  const resources = {};
  let updatedAt = null;
  for (const r of rows) {
    if (!resources[r.resource]) resources[r.resource] = { en: 'current', ru: 'current' };
    resources[r.resource][r.lang] = r.status;
    if (r.updated_at && (!updatedAt || r.updated_at > updatedAt)) updatedAt = r.updated_at;
  }
  for (const key of DEFAULT_RESOURCES) {
    if (!resources[key]) resources[key] = { en: 'current', ru: 'current' };
  }
  return { updatedAt, resources };
}

export function markStale(resourceKey) {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO resource_translation_status (resource, lang, status, updated_at)
    VALUES (?, ?, 'stale', datetime('now'))
    ON CONFLICT(resource, lang) DO UPDATE SET status='stale', updated_at=datetime('now')
  `);
  for (const lang of DERIVED_LANGS) {
    upsert.run(resourceKey, lang);
  }
  return readTranslationStatus();
}

export function markCurrent(resourceKey, lang) {
  if (!DERIVED_LANGS.includes(lang)) {
    throw new Error('invalid_lang');
  }
  const db = getDb();
  db.prepare(`
    INSERT INTO resource_translation_status (resource, lang, status, updated_at)
    VALUES (?, ?, 'current', datetime('now'))
    ON CONFLICT(resource, lang) DO UPDATE SET status='current', updated_at=datetime('now')
  `).run(resourceKey, lang);
  return readTranslationStatus();
}
