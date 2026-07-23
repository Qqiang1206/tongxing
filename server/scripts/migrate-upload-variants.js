/**
 * Generate display/thumb WebP variants for legacy files in assets/images/uploads/.
 * Originals are archived under uploads/_originals/ (not web-accessible).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../src/db.js';
import { buildVariantsFromFile, shouldBuildVariants } from '../src/services/imageVariants.js';
import { ensureMediaColumns, ensureUploadDir } from '../src/services/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const UPLOAD_DIR = path.join(REPO_ROOT, 'assets', 'images', 'uploads');
const ORIGINALS_DIR = path.join(UPLOAD_DIR, '_originals');

function isVariant(name) {
  return /-(display|thumb)\.webp$/i.test(name);
}

function parseLegacyName(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const m = base.match(/^(\d{14})-(.+)$/);
  if (m) return { stamp: m[1], baseName: m[2], ext };
  return { stamp: 'legacy', baseName: base.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80), ext };
}

async function migrateOne(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!shouldBuildVariants(ext)) {
    console.log('skip non-raster', filename);
    return;
  }

  const abs = path.join(UPLOAD_DIR, filename);
  const { stamp, baseName } = parseLegacyName(filename);
  const id = `${stamp}-${baseName}`;
  const displayRel = `assets/images/uploads/${id}-display.webp`;
  const displayAbs = path.join(REPO_ROOT, displayRel);
  if (fs.existsSync(displayAbs)) {
    console.log('already migrated', filename);
    return;
  }

  const built = await buildVariantsFromFile(abs, {
    uploadDir: UPLOAD_DIR,
    originalsDir: ORIGINALS_DIR,
    stamp,
    baseName,
    originalExt: ext === '.jpeg' ? '.jpg' : ext,
  });

  const db = getDb();
  ensureMediaColumns(db);
  const existing = db.prepare('SELECT id, alt FROM media WHERE id = ? OR path LIKE ?').get(
    filename,
    `%/${filename}`
  );
  const alt = existing?.alt || '';
  db.prepare(
    `INSERT INTO media (
      id, path, alt, mime, created_at,
      thumb_path, original_path, width, height, original_bytes, display_bytes
    ) VALUES (?, ?, ?, 'image/webp', datetime('now'), ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path,
      thumb_path = excluded.thumb_path,
      original_path = excluded.original_path,
      width = excluded.width,
      height = excluded.height,
      original_bytes = excluded.original_bytes,
      display_bytes = excluded.display_bytes`
  ).run(
    built.id,
    built.path,
    alt,
    built.thumbPath,
    built.originalPath,
    built.width,
    built.height,
    built.originalBytes,
    built.displayBytes
  );

  if (abs !== displayAbs && fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
  console.log(
    'migrated',
    filename,
    '→',
    path.basename(built.path),
    `(${(built.originalBytes / 1024).toFixed(0)}KB → ${(built.displayBytes / 1024).toFixed(0)}KB)`
  );
}

ensureUploadDir();
getDb();
const files = fs.readdirSync(UPLOAD_DIR).filter((f) => {
  if (f === '_originals') return false;
  if (isVariant(f)) return false;
  return fs.statSync(path.join(UPLOAD_DIR, f)).isFile();
});

if (!files.length) {
  console.log('No legacy uploads to migrate.');
  process.exit(0);
}

for (const file of files) {
  await migrateOne(file);
}
console.log('Done.');
