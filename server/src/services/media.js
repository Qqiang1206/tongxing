import fs from 'fs';
import path from 'path';
import { REPO_ROOT } from '../config.js';
import { getDb } from '../db.js';
import {
  buildUploadVariants,
  shouldBuildVariants,
} from './imageVariants.js';

const UPLOAD_DIR = path.join(REPO_ROOT, 'assets', 'images', 'uploads');
const ORIGINALS_DIR = path.join(UPLOAD_DIR, '_originals');
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
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
}

export function ensureMediaColumns(db) {
  const cols = db.prepare('PRAGMA table_info(media)').all().map((c) => c.name);
  const adds = [
    ['thumb_path', 'TEXT'],
    ['original_path', 'TEXT'],
    ['width', 'INTEGER'],
    ['height', 'INTEGER'],
    ['original_bytes', 'INTEGER'],
    ['display_bytes', 'INTEGER'],
  ];
  for (const [name, type] of adds) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE media ADD COLUMN ${name} ${type}`);
    }
  }
}

function insertMediaRow(db, row) {
  ensureMediaColumns(db);
  db.prepare(
    `INSERT INTO media (
      id, path, alt, mime, created_at,
      thumb_path, original_path, width, height, original_bytes, display_bytes
    ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path,
      alt = excluded.alt,
      mime = excluded.mime,
      thumb_path = excluded.thumb_path,
      original_path = excluded.original_path,
      width = excluded.width,
      height = excluded.height,
      original_bytes = excluded.original_bytes,
      display_bytes = excluded.display_bytes`
  ).run(
    row.id,
    row.path,
    row.alt || '',
    row.mime || null,
    row.thumbPath || null,
    row.originalPath || null,
    row.width ?? null,
    row.height ?? null,
    row.originalBytes ?? null,
    row.displayBytes ?? null
  );
}

function rowToItem(row) {
  const itemPath = String(row.path || '').replace(/\\/g, '/');
  let displayBytes = row.display_bytes != null ? Number(row.display_bytes) : 0;
  const abs = path.join(REPO_ROOT, itemPath);
  if (!displayBytes && fs.existsSync(abs)) displayBytes = fs.statSync(abs).size;
  return {
    filename: row.id,
    path: itemPath,
    thumbPath: row.thumb_path || '',
    originalPath: row.original_path || '',
    alt: row.alt || '',
    bytes: displayBytes,
    originalBytes: row.original_bytes != null ? Number(row.original_bytes) : null,
    displayBytes,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    ...mediaMeta(itemPath),
  };
}

function isVariantFilename(name) {
  return /-(display|thumb)\.webp$/i.test(name);
}

/** Save base64 image → Web display/thumb variants; path returned is always the public Web path. */
export async function saveUploadedMedia({ filename, dataBase64, mime, alt }) {
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

  const buf = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) throw new Error('empty_file');
  if (buf.length > 8 * 1024 * 1024) throw new Error('file_too_large');

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const base = safeName(path.basename(filename || 'upload', ext));

  if (!shouldBuildVariants(ext)) {
    const outName = `${stamp}-${base}${ext}`;
    const abs = path.join(UPLOAD_DIR, outName);
    fs.writeFileSync(abs, buf);
    const relative = `assets/images/uploads/${outName}`;
    const id = outName;
    try {
      const db = getDb();
      insertMediaRow(db, {
        id,
        path: relative,
        alt: alt || '',
        mime: mime || null,
        thumbPath: null,
        originalPath: null,
        width: null,
        height: null,
        originalBytes: buf.length,
        displayBytes: buf.length,
      });
    } catch (_) {
      /* non-fatal */
    }
    return {
      id,
      path: relative,
      filename: id,
      bytes: buf.length,
      originalBytes: buf.length,
      displayBytes: buf.length,
      alt: alt || '',
      optimized: false,
      ...mediaMeta(relative),
    };
  }

  const built = await buildUploadVariants(buf, {
    uploadDir: UPLOAD_DIR,
    originalsDir: ORIGINALS_DIR,
    stamp,
    baseName: base,
    originalExt: ext === '.jpeg' ? '.jpg' : ext,
  });

  try {
    const db = getDb();
    insertMediaRow(db, {
      id: built.id,
      path: built.path,
      alt: alt || '',
      mime: 'image/webp',
      thumbPath: built.thumbPath,
      originalPath: built.originalPath,
      width: built.width,
      height: built.height,
      originalBytes: built.originalBytes,
      displayBytes: built.displayBytes,
    });
  } catch (_) {
    /* non-fatal */
  }

  return {
    id: built.id,
    path: built.path,
    thumbPath: built.thumbPath,
    originalPath: built.originalPath,
    filename: built.id,
    bytes: built.displayBytes,
    originalBytes: built.originalBytes,
    displayBytes: built.displayBytes,
    width: built.width,
    height: built.height,
    alt: alt || '',
    optimized: true,
    ...mediaMeta(built.path),
  };
}

export function listUploadedMedia() {
  ensureUploadDir();
  try {
    const db = getDb();
    ensureMediaColumns(db);
    const rows = db
      .prepare(
        `SELECT id, path, alt, thumb_path, original_path, width, height, original_bytes, display_bytes
         FROM media ORDER BY created_at DESC`
      )
      .all();
    if (rows.length) {
      return rows.map((r) =>
        rowToItem({
          id: r.id,
          path: r.path,
          alt: r.alt,
          thumb_path: r.thumb_path,
          original_path: r.original_path,
          width: r.width,
          height: r.height,
          original_bytes: r.original_bytes,
          display_bytes: r.display_bytes,
        })
      );
    }
  } catch (_) {
    /* fall through */
  }

  return fs
    .readdirSync(UPLOAD_DIR)
    .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()) && !isVariantFilename(f))
    .filter((f) => f !== '_originals')
    .sort()
    .reverse()
    .map((f) => {
      const rel = `assets/images/uploads/${f}`;
      const bytes = fs.statSync(path.join(UPLOAD_DIR, f)).size;
      return {
        filename: f,
        path: rel,
        alt: '',
        bytes,
        originalBytes: bytes,
        displayBytes: bytes,
        ...mediaMeta(rel),
      };
    });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Windows may return EBUSY/EPERM when AV or preview still holds the file. */
async function unlinkAbsWithRetry(absPath, { retries = 20, baseDelayMs = 150 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await fs.promises.unlink(absPath);
      return;
    } catch (err) {
      if (err.code === 'ENOENT') return;
      const retryable = err.code === 'EBUSY' || err.code === 'EPERM';
      if (retryable && attempt < retries - 1) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      if (retryable) {
        const trash = `${absPath}.del-${Date.now()}`;
        try {
          await fs.promises.rename(absPath, trash);
          await unlinkAbsWithRetry(trash, { retries: 8, baseDelayMs: 80 });
          return;
        } catch (_) {
          /* rename also failed — try Windows force-delete */
        }
        try {
          const { execSync } = await import('child_process');
          execSync(`cmd /c del /f /q "${absPath}" 2>nul`, { timeout: 5000, windowsHide: true });
          if (!fs.existsSync(absPath)) return;
        } catch (_) {
          /* give up */
        }
      }
      throw Object.assign(err, {
        message: `${err.message} —— 文件被系统占用，请关闭其它程序后重试，或重启电脑。`,
      });
    }
  }
}

async function unlinkIfExists(relPath) {
  if (!relPath) return;
  const abs = path.join(REPO_ROOT, String(relPath).replace(/\\/g, '/'));
  if (fs.existsSync(abs)) await unlinkAbsWithRetry(abs);
}

export async function deleteUploadedMedia(idOrFilename) {
  const name = path.basename(String(idOrFilename || ''));
  if (!name || name.includes('..') || name !== String(idOrFilename).replace(/^.*[/\\]/, '')) {
    throw new Error('invalid_file_type');
  }
  const db = getDb();
  ensureMediaColumns(db);
  const row = db.prepare('SELECT id, path, thumb_path, original_path FROM media WHERE id = ?').get(name);
  const rel = row && row.path ? String(row.path).replace(/\\/g, '/') : `assets/images/uploads/${name}`;
  if (!mediaMeta(rel).deletable) throw new Error('protected_media');

  if (row) {
    await unlinkIfExists(row.path);
    await unlinkIfExists(row.thumb_path);
    await unlinkIfExists(row.original_path);
  } else {
    const abs = path.join(UPLOAD_DIR, name);
    const resolved = path.resolve(abs);
    const uploadsRoot = path.resolve(UPLOAD_DIR);
    if (resolved.startsWith(uploadsRoot + path.sep) && fs.existsSync(resolved)) {
      await unlinkAbsWithRetry(resolved);
    }
    const base = name.replace(/\.[^.]+$/, '');
    await unlinkIfExists(`assets/images/uploads/${base}-display.webp`);
    await unlinkIfExists(`assets/images/uploads/${base}-thumb.webp`);
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
