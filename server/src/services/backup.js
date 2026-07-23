import fs from 'fs';
import path from 'path';
import { REPO_ROOT } from '../config.js';
import { getDb } from '../db.js';

const BACKUP_ROOT = path.join(REPO_ROOT, '_backups');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const UPLOAD_DIR = path.join(REPO_ROOT, 'assets', 'images', 'uploads');
const BACKUP_PREFIX = 'txam-complete-';
const AUTO_BACKUP_INTERVAL_MS = Math.max(
  60 * 1000,
  Number(process.env.AUTO_BACKUP_INTERVAL_MINUTES || 15) * 60 * 1000
);
const AUTO_BACKUP_LIMIT = Math.max(3, Number(process.env.AUTO_BACKUP_LIMIT || 10));

let lastAutoBackupAt = 0;
let backupRunning = false;

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 23);
}

function safeReason(value) {
  const reason = String(value || 'manual').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return reason.replace(/^-+|-+$/g, '') || 'manual';
}

function isSafeBackupId(id) {
  const value = String(id || '');
  return value === path.basename(value) && value.startsWith(BACKUP_PREFIX) && !value.includes('..');
}

function copyTree(source, destination) {
  if (!fs.existsSync(source)) return { files: 0, bytes: 0 };
  fs.mkdirSync(destination, { recursive: true });
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      const child = copyTree(from, to);
      files += child.files;
      bytes += child.bytes;
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      files += 1;
      bytes += fs.statSync(from).size;
    }
  }
  return { files, bytes };
}

function replaceTree(source, destination) {
  const parent = path.dirname(destination);
  const temp = path.join(parent, `.${path.basename(destination)}-restore-${Date.now()}`);
  fs.rmSync(temp, { recursive: true, force: true });
  copyTree(source, temp);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.renameSync(temp, destination);
}

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function describeBackup(dir) {
  const id = path.basename(dir);
  const manifest = readManifest(dir) || {};
  const stat = fs.statSync(dir);
  return {
    id,
    createdAt: manifest.createdAt || stat.mtime.toISOString(),
    reason: manifest.reason || 'legacy',
    files: Number(manifest.files || 0),
    bytes: Number(manifest.bytes || 0),
    hasDatabase: fs.existsSync(path.join(dir, 'server', 'data', 'txam.db')),
    hasUploads: fs.existsSync(path.join(dir, 'assets', 'images', 'uploads')),
  };
}

function pruneAutoBackups() {
  const auto = listBackups().filter((item) => item.reason === 'auto');
  for (const item of auto.slice(AUTO_BACKUP_LIMIT)) {
    const target = path.join(BACKUP_ROOT, item.id);
    if (path.dirname(target) === BACKUP_ROOT && isSafeBackupId(item.id)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return [];
  return fs
    .readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(BACKUP_PREFIX))
    .map((entry) => describeBackup(path.join(BACKUP_ROOT, entry.name)))
    .filter((item) => item.hasDatabase)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createBackup({ reason = 'manual' } = {}) {
  if (backupRunning) throw new Error('backup_in_progress');
  backupRunning = true;
  const createdAt = new Date();
  const normalizedReason = safeReason(reason);
  const id = `${BACKUP_PREFIX}${stamp(createdAt)}-${normalizedReason}`;
  const outDir = path.join(BACKUP_ROOT, id);
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const dbOut = path.join(outDir, 'server', 'data', 'txam.db');
    fs.mkdirSync(path.dirname(dbOut), { recursive: true });

    // VACUUM INTO creates a consistent snapshot even while SQLite is in WAL mode.
    const sqlPath = dbOut.replace(/'/g, "''");
    getDb().exec(`VACUUM INTO '${sqlPath}'`);

    const dataStats = copyTree(DATA_DIR, path.join(outDir, 'data'));
    const uploadStats = copyTree(UPLOAD_DIR, path.join(outDir, 'assets', 'images', 'uploads'));
    const dbBytes = fs.statSync(dbOut).size;
    const manifest = {
      version: 1,
      id,
      createdAt: createdAt.toISOString(),
      reason: normalizedReason,
      files: 1 + dataStats.files + uploadStats.files,
      bytes: dbBytes + dataStats.bytes + uploadStats.bytes,
      includes: ['server/data/txam.db', 'data', 'assets/images/uploads'],
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'RESTORE.txt'),
      [
        'TXAM complete CMS backup',
        `Created: ${manifest.createdAt}`,
        `Reason: ${manifest.reason}`,
        '',
        'Includes the SQLite content database, static JSON/JS fallback data, and uploaded images.',
        'Recommended restore: Admin > System Management > Backup and Restore.',
        'The restore action creates a pre-restore backup before replacing current content.',
        '',
      ].join('\n'),
      'utf8'
    );
    if (normalizedReason === 'auto') {
      lastAutoBackupAt = Date.now();
      pruneAutoBackups();
    }
    return describeBackup(outDir);
  } catch (error) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw error;
  } finally {
    backupRunning = false;
  }
}

export function ensureAutoBackup() {
  if (Date.now() - lastAutoBackupAt < AUTO_BACKUP_INTERVAL_MS) return null;
  const newest = listBackups().find((item) => item.reason === 'auto');
  if (newest && Date.now() - new Date(newest.createdAt).getTime() < AUTO_BACKUP_INTERVAL_MS) {
    lastAutoBackupAt = new Date(newest.createdAt).getTime();
    return null;
  }
  return createBackup({ reason: 'auto' });
}

function quoteIdentifier(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function sqlString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function restoreDatabaseContents(db, sourcePath) {
  const alias = 'restore_snapshot';
  db.exec(`ATTACH DATABASE ${sqlString(sourcePath)} AS ${alias}`);
  try {
    const mainTables = new Set(
      db.prepare(`SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
        .all()
        .map((row) => row.name)
    );
    const backupTables = db
      .prepare(`SELECT name FROM ${alias}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all()
      .map((row) => row.name)
      .filter((name) => mainTables.has(name));
    if (!backupTables.length) throw new Error('backup_database_empty');

    db.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;');
    try {
      for (const table of backupTables) {
        const mainColumns = new Set(
          db.prepare(`PRAGMA main.table_info(${sqlString(table)})`).all().map((column) => column.name)
        );
        const columns = db
          .prepare(`PRAGMA ${alias}.table_info(${sqlString(table)})`)
          .all()
          .map((column) => column.name)
          .filter((name) => mainColumns.has(name));
        if (!columns.length) continue;
        const tableName = quoteIdentifier(table);
        const columnList = columns.map(quoteIdentifier).join(', ');
        db.exec(
          `DELETE FROM main.${tableName}; ` +
          `INSERT INTO main.${tableName} (${columnList}) ` +
          `SELECT ${columnList} FROM ${alias}.${tableName};`
        );
      }
      db.exec('COMMIT;');
    } catch (error) {
      try { db.exec('ROLLBACK;'); } catch { /* no active transaction */ }
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
  } finally {
    try { db.exec(`DETACH DATABASE ${alias}`); } catch { /* best effort */ }
  }
}

export function restoreBackup(id) {
  if (!isSafeBackupId(id)) throw new Error('invalid_backup_id');
  const source = path.join(BACKUP_ROOT, id);
  const dbSource = path.join(source, 'server', 'data', 'txam.db');
  const dataSource = path.join(source, 'data');
  const uploadsSource = path.join(source, 'assets', 'images', 'uploads');
  if (!fs.existsSync(dbSource)) throw new Error('backup_not_found');

  const safetyBackup = createBackup({ reason: 'pre-restore' });
  restoreDatabaseContents(getDb(), dbSource);
  if (fs.existsSync(dataSource)) replaceTree(dataSource, DATA_DIR);
  if (fs.existsSync(uploadsSource)) replaceTree(uploadsSource, UPLOAD_DIR);
  return { restored: true, backup: describeBackup(source), safetyBackup };
}