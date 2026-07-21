/**
 * Register existing site images into the admin media library (DB index).
 * Keeps original paths under assets/images/* — does not copy into uploads/.
 *
 * Usage: node scripts/import-site-images-to-media.js
 */
import fs from 'fs';
import path from 'path';
import { getDb } from '../src/db.js';
import { REPO_ROOT } from '../src/config.js';

const IMG_ROOT = path.join(REPO_ROOT, 'assets', 'images');
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const SKIP_DIRS = new Set(['uploads']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(p, out);
    } else if (ALLOWED.has(path.extname(ent.name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

function mimeFor(ext) {
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    }[ext] || null
  );
}

function mediaIdFromRel(relPosix) {
  return relPosix.replace(/\//g, '__');
}

const files = walk(IMG_ROOT);
const db = getDb();

const insert = db.prepare(
  `INSERT INTO media (id, path, alt, mime, created_at) VALUES (?, ?, ?, ?, datetime('now'))
   ON CONFLICT(id) DO UPDATE SET path=excluded.path, mime=COALESCE(excluded.mime, media.mime), alt=COALESCE(NULLIF(excluded.alt,''), media.alt)`
);

let added = 0;
let updated = 0;

for (const abs of files) {
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
  const ext = path.extname(abs).toLowerCase();
  const id = mediaIdFromRel(path.relative(IMG_ROOT, abs).split(path.sep).join('/'));
  const alt = path.basename(abs, ext).replace(/[-_]+/g, ' ');
  const before = db.prepare('SELECT id, path FROM media WHERE id = ? OR path = ?').get(id, rel);
  insert.run(id, rel, alt, mimeFor(ext));
  if (before) updated++;
  else added++;
}

const total = db.prepare('SELECT COUNT(*) AS c FROM media').get().c;
console.log(
  JSON.stringify(
    {
      scanned: files.length,
      added,
      updated,
      totalInMedia: total,
    },
    null,
    2
  )
);
