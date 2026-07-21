/**
 * Admin audit log — write ops + login only (no GET spam).
 */
import { getDb } from '../db.js';

const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || 90);
const MAX_DETAIL = 8000;

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
  `);
}

function clientIp(req) {
  if (!req || !req.headers) return '';
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function safeDetail(detail) {
  if (detail == null) return null;
  try {
    let s = typeof detail === 'string' ? detail : JSON.stringify(detail);
    if (s.length > MAX_DETAIL) s = s.slice(0, MAX_DETAIL) + '…';
    // Never persist secrets
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
 * @param {string} entry.action  e.g. login.ok / product.update
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
      entry.actor || 'admin',
      String(entry.action || 'unknown'),
      entry.resource != null ? String(entry.resource) : null,
      entry.resourceId != null ? String(entry.resourceId) : null,
      entry.summary != null ? String(entry.summary).slice(0, 500) : null,
      safeDetail(entry.detail),
      entry.req ? clientIp(entry.req) : (entry.ip || ''),
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
    db.prepare(
      `DELETE FROM admin_audit_log WHERE created_at < datetime('now', ?)`
    ).run(`-${RETENTION_DAYS} days`);
  } catch (_) { /* ignore */ }
}

export function listAuditLogs({ limit = 100, offset = 0, action, resource } = {}) {
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
    where.push('resource = ?');
    params.push(String(resource));
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
    .map((row) => {
      let detail = null;
      if (row.detailJson) {
        try { detail = JSON.parse(row.detailJson); } catch { detail = row.detailJson; }
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
    });
  return { total, limit: lim, offset: off, items };
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
  let detail = null;
  if (row.detailJson) {
    try { detail = JSON.parse(row.detailJson); } catch { detail = row.detailJson; }
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
