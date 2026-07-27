/**
 * Translation engine CRUD service.
 * Engines are stored in translation_engine_config table.
 * The active engine (is_active=1) is used by translateProvider.js.
 *
 * Table creation + env-seed lives in db.js (ensureTranslationEngineTable)
 * to avoid circular imports.
 */
import { getDb } from '../db.js';

export function getProviderPresets() {
  return {
    deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', label: 'DeepSeek' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI' },
    qianwen: {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      label: '通义千问',
    },
  };
}

function maskApiKey(key) {
  if (!key) return '';
  const s = String(key);
  if (s.length <= 8) return '****';
  return s.slice(0, 4) + '****' + s.slice(-4);
}

function rowToEngine(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    baseUrl: row.base_url,
    model: row.model,
    apiKeyMasked: maskApiKey(row.api_key),
    hasKey: Boolean(row.api_key),
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listEngines() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM translation_engine_config ORDER BY is_active DESC, sort_order ASC, id ASC`
  ).all();
  return rows.map(rowToEngine);
}

/** Returns the full active engine (including raw api_key) for translateProvider. */
export function getActiveEngine() {
  const db = getDb();
  const row = db.prepare(
    `SELECT * FROM translation_engine_config WHERE is_active = 1 LIMIT 1`
  ).get();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    baseUrl: row.base_url,
    model: row.model,
    apiKey: row.api_key,
  };
}

function getEngineById(id) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM translation_engine_config WHERE id = ?`).get(id);
  return row ? rowToEngine(row) : null;
}

export function createEngine(input) {
  const db = getDb();
  const name = String(input.name || '').trim();
  const provider = String(input.provider || '').trim().toLowerCase();
  const baseUrl = String(input.baseUrl || '').trim().replace(/\/$/, '');
  const model = String(input.model || '').trim();
  const apiKey = String(input.apiKey || '').trim();
  if (!name) throw new Error('missing_engine_name');
  if (!provider) throw new Error('missing_engine_provider');
  if (!baseUrl) throw new Error('missing_engine_base_url');
  if (!model) throw new Error('missing_engine_model');

  const activeCount =
    db.prepare(`SELECT COUNT(*) AS c FROM translation_engine_config WHERE is_active = 1`).get()?.c || 0;
  const result = db.prepare(
    `INSERT INTO translation_engine_config (name, provider, base_url, model, api_key, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, provider, baseUrl, model, apiKey, activeCount === 0 ? 1 : 0, input.sortOrder || 0);
  return getEngineById(result.lastInsertRowid);
}

export function updateEngine(id, input) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM translation_engine_config WHERE id = ?`).get(id);
  if (!row) throw new Error('not_found');

  const name = String(input.name || '').trim();
  const provider = String(input.provider || '').trim().toLowerCase();
  const baseUrl = String(input.baseUrl || '').trim().replace(/\/$/, '');
  const model = String(input.model || '').trim();
  const apiKeyRaw = String(input.apiKey || '');
  if (!name) throw new Error('missing_engine_name');
  if (!provider) throw new Error('missing_engine_provider');
  if (!baseUrl) throw new Error('missing_engine_base_url');
  if (!model) throw new Error('missing_engine_model');

  // If apiKey is empty or looks like a masked value, keep the original key.
  const keepKey = !apiKeyRaw.trim() || apiKeyRaw.includes('****');
  db.prepare(
    `UPDATE translation_engine_config
     SET name = ?, provider = ?, base_url = ?, model = ?, api_key = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name,
    provider,
    baseUrl,
    model,
    keepKey ? row.api_key : apiKeyRaw.trim(),
    input.sortOrder != null ? Number(input.sortOrder) : row.sort_order,
    id
  );
  return getEngineById(id);
}

export function deleteEngine(id) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM translation_engine_config WHERE id = ?`).get(id);
  if (!row) throw new Error('not_found');
  if (row.is_active === 1) throw new Error('cannot_delete_active_engine');
  db.prepare(`DELETE FROM translation_engine_config WHERE id = ?`).run(id);
  return { ok: true, deleted: id };
}

export function activateEngine(id) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM translation_engine_config WHERE id = ?`).get(id);
  if (!row) throw new Error('not_found');
  db.prepare(`UPDATE translation_engine_config SET is_active = 0, updated_at = datetime('now')`).run();
  db.prepare(
    `UPDATE translation_engine_config SET is_active = 1, updated_at = datetime('now') WHERE id = ?`
  ).run(id);
  return getEngineById(id);
}
