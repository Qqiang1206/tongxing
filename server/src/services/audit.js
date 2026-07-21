/**
 * Admin audit log — write ops + login only (no GET spam).
 */
import { getDb } from '../db.js';

const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || 90);
const MAX_DETAIL = 8000;
const DEFAULT_ACTOR = String(process.env.ADMIN_ACTOR || '管理员').slice(0, 40);

export function ensureAuditTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      actor TEXT DEFAULT 'admin',
      action TEXT NOT NULL,
      resource TEXT,
      resource_id TEXT,
      summary TEXT,
      detail_json TEXT,
      ip TEXT,
      ok INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor);
  `);
}

export function sanitizeActor(raw) {
  const s = String(raw || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[<>"'\\]/g, '')
    .trim()
    .slice(0, 40);
  return s || DEFAULT_ACTOR;
}

export function clientIp(req) {
  if (!req || !req.headers) return '';
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function userAgent(req) {
  if (!req || !req.headers) return '';
  return String(req.headers['user-agent'] || '').slice(0, 240);
}

/** Prefer explicit actor, then X-Admin-Actor header, then default. */
export function resolveActor(entry = {}) {
  if (entry.actor) return sanitizeActor(entry.actor);
  const req = entry.req;
  if (req && req.headers) {
    const h = req.headers['x-admin-actor'] || req.headers['x-actor'];
    if (h) return sanitizeActor(h);
  }
  return DEFAULT_ACTOR;
}

function safeDetail(detail, req) {
  let obj = null;
  if (detail != null) {
    if (typeof detail === 'object' && !Array.isArray(detail)) {
      obj = { ...detail };
    } else if (typeof detail === 'string') {
      try {
        const parsed = JSON.parse(detail);
        obj = typeof parsed === 'object' && parsed ? { ...parsed } : { note: detail };
      } catch {
        obj = { note: detail };
      }
    } else {
      obj = { value: detail };
    }
  } else {
    obj = {};
  }
  const ua = userAgent(req);
  if (ua && !obj.userAgent) obj.userAgent = ua;
  if (!Object.keys(obj).length) return null;
  try {
    let s = JSON.stringify(obj);
    if (s.length > MAX_DETAIL) s = s.slice(0, MAX_DETAIL) + '…';
    s = s.replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"***"');
    s = s.replace(/"dataBase64"\s*:\s*"[^"]*"/gi, '"dataBase64":"[omitted]"');
    s = s.replace(/"data"\s*:\s*"data:[^"]{200,}"/gi, '"data":"[omitted]"');
    return s;
  } catch {
    return null;
  }
}

/**
 * @param {object} entry
 * @param {string} entry.action
 * @param {string} [entry.actor]
 * @param {string} [entry.resource]
 * @param {string|number} [entry.resourceId]
 * @param {string} [entry.summary]
 * @param {object|string} [entry.detail]
 * @param {boolean} [entry.ok]
 * @param {import('http').IncomingMessage} [entry.req]
 */
export function writeAudit(entry) {
  try {
    const db = getDb();
    ensureAuditTable(db);
    db.prepare(
      `INSERT INTO admin_audit_log (actor, action, resource, resource_id, summary, detail_json, ip, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      resolveActor(entry),
      String(entry.action || 'unknown'),
      entry.resource != null ? String(entry.resource) : null,
      entry.resourceId != null ? String(entry.resourceId) : null,
      entry.summary != null ? String(entry.summary).slice(0, 500) : null,
      safeDetail(entry.detail, entry.req),
      entry.req ? clientIp(entry.req) : entry.ip || '',
      entry.ok === false ? 0 : 1
    );
    pruneOld(db);
  } catch (err) {
    console.warn('[audit]', err.message || err);
  }
}

function pruneOld(db) {
  if (!RETENTION_DAYS || RETENTION_DAYS < 1) return;
  try {
    db.prepare(`DELETE FROM admin_audit_log WHERE created_at < datetime('now', ?)`).run(
      `-${RETENTION_DAYS} days`
    );
  } catch (_) {
    /* ignore */
  }
}

export function listAuditLogs({ limit = 100, offset = 0, action, resource, actor } = {}) {
  const db = getDb();
  ensureAuditTable(db);
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);
  const where = [];
  const params = [];
  if (action) {
    where.push('action LIKE ?');
    params.push(String(action) + '%');
  }
  if (resource) {
    if (String(resource) === 'pages') {
      where.push(`(resource = 'pages' OR resource LIKE 'pages:%')`);
    } else {
      where.push('resource = ?');
      params.push(String(resource));
    }
  }
  if (actor) {
    where.push('actor LIKE ?');
    params.push('%' + String(actor) + '%');
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM admin_audit_log ${clause}`).get(...params)?.c || 0;
  const items = db
    .prepare(
      `SELECT id, created_at AS createdAt, actor, action, resource, resource_id AS resourceId,
              summary, detail_json AS detailJson, ip, ok
       FROM admin_audit_log ${clause}
       ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, lim, off)
    .map(mapAuditRow);

  const actors = db
    .prepare(
      `SELECT DISTINCT actor FROM admin_audit_log
       WHERE actor IS NOT NULL AND actor != ''
       ORDER BY actor COLLATE NOCASE LIMIT 50`
    )
    .all()
    .map((r) => r.actor);

  return { total, limit: lim, offset: off, items, actors };
}

function mapAuditRow(row) {
  let detail = null;
  if (row.detailJson) {
    try {
      detail = JSON.parse(row.detailJson);
    } catch {
      detail = row.detailJson;
    }
  }
  return {
    id: row.id,
    createdAt: row.createdAt,
    actor: row.actor,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId,
    summary: row.summary,
    detail,
    ip: row.ip,
    ok: !!row.ok,
  };
}

export function getAuditLog(id) {
  const db = getDb();
  ensureAuditTable(db);
  const row = db
    .prepare(
      `SELECT id, created_at AS createdAt, actor, action, resource, resource_id AS resourceId,
              summary, detail_json AS detailJson, ip, ok
       FROM admin_audit_log WHERE id = ?`
    )
    .get(Number(id));
  if (!row) return null;
  return mapAuditRow(row);
}
