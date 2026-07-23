import fs from 'fs';
import path from 'path';
import { REPO_ROOT } from '../config.js';
import { getDb } from '../db.js';

const UPLOAD_DIR = path.join(REPO_ROOT, 'assets', 'images', 'uploads');
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

function mediaMeta(mediaPath) {
  const normalized = String(mediaPath || '').replace(/\\/g, '/').replace(/^\//, '');
  const uploaded = normalized.startsWith('assets/images/uploads/');
  return { source: uploaded ? 'upload' : 'site', deletable: uploaded };
}

function safeName(name) {
  return (
    String(name || 'file')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 80) || 'file'
  );
}

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Save base64 image payload → assets/images/uploads/... + media table */
export function saveUploadedMedia({ filename, dataBase64, mime, alt }) {
  ensureUploadDir();
  if (!dataBase64) throw new Error('missing_data');

  let ext = path.extname(filename || '').toLowerCase();
  if (!ext && mime) {
    const map = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };
    ext = map[mime] || '';
  }
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('invalid_file_type');
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const base = safeName(path.basename(filename || 'upload', ext));
  const outName = `${stamp}-${base}${ext}`;
  const abs = path.join(UPLOAD_DIR, outName);
  const buf = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) throw new Error('empty_file');
  if (buf.length > 8 * 1024 * 1024) throw new Error('file_too_large');

  fs.writeFileSync(abs, buf);
  const relative = `assets/images/uploads/${outName}`;

  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO media (id, path, alt, mime, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(outName, relative, alt || '', mime || null);
  } catch (_) {
    /* non-fatal */
  }

  return {
    path: relative,
    filename: outName,
    bytes: buf.length,
    alt: alt || '',
    ...mediaMeta(relative),
  };
}

export function listUploadedMedia() {
  ensureUploadDir();
  try {
    const db = getDb();
    const rows = db
      .prepare('SELECT path, id AS filename, alt FROM media ORDER BY created_at DESC')
      .all();
    if (rows.length) {
      return rows.map((r) => {
        const itemPath = String(r.path || '').replace(/\\/g, '/');
        return {
          filename: r.filename,
          path: itemPath,
          alt: r.alt || '',
          bytes: fs.existsSync(path.join(REPO_ROOT, itemPath))
            ? fs.statSync(path.join(REPO_ROOT, itemPath)).size
            : 0,
          ...mediaMeta(itemPath),
        };
      });
    }
  } catch (_) {
    /* fall through */
  }

  return fs
    .readdirSync(UPLOAD_DIR)
    .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .reverse()
    .map((f) => ({
      filename: f,
      path: `assets/images/uploads/${f}`,
      alt: '',
      bytes: fs.statSync(path.join(UPLOAD_DIR, f)).size,
      ...mediaMeta(`assets/images/uploads/${f}`),
    }));
}

export function deleteUploadedMedia(idOrFilename) {
  const name = path.basename(String(idOrFilename || ''));
  if (!name || name.includes('..') || name !== String(idOrFilename).replace(/^.*[/\\]/, '')) {
    throw new Error('invalid_file_type');
  }
  const db = getDb();
  const row = db.prepare('SELECT id, path FROM media WHERE id = ?').get(name);
  const rel = row && row.path ? String(row.path).replace(/\\/g, '/') : `assets/images/uploads/${name}`;
  if (!mediaMeta(rel).deletable) throw new Error('protected_media');
  const abs = path.join(REPO_ROOT, rel);
  const resolved = path.resolve(abs);
  const uploadsRoot = path.resolve(UPLOAD_DIR);
  /* Only unlink files under uploads/ — site assets are registered by path, not owned by media lib */
  if (resolved.startsWith(uploadsRoot + path.sep) || resolved === uploadsRoot) {
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  }
  db.prepare('DELETE FROM media WHERE id = ?').run(name);
  return { filename: name, deleted: true, path: rel, ...mediaMeta(rel) };
}

export function updateMediaAlt(idOrFilename, alt) {
  const name = path.basename(String(idOrFilename || ''));
  if (!name || name.includes('..')) throw new Error('invalid_file_type');
  const db = getDb();
  const row = db.prepare('SELECT id, path, alt FROM media WHERE id = ?').get(name);
  if (!row) throw new Error('not_found');
  db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(String(alt || ''), name);
  return {
    filename: name,
    path: row.path,
    alt: String(alt || ''),
    ...mediaMeta(row.path),
  };
}
