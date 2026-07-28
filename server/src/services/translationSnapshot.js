/**
 * Translation source snapshot.
 *
 * Stores the normalized source text of every translatable string per
 * (resource, lang, itemId, path). Used by translateResource to detect which
 * strings actually changed since the last sync, so unchanged strings can be
 * reused from the existing en/ru output instead of being re-sent to the
 * translation engine.
 *
 * Persisted as a JSON file (no DB migration needed; the scheduler runs jobs
 * serially, so there is no concurrent-write conflict).
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';

const SNAPSHOT_FILE = path.join(DATA_DIR, 'meta', 'translation-snapshot.json');

let cache = null;

function load() {
  if (cache && typeof cache === 'object') return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  const dir = path.dirname(SNAPSHOT_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

function blankItem(data, resource, lang, itemId) {
  data[resource] = data[resource] || {};
  data[resource][lang] = data[resource][lang] || {};
  data[resource][lang][itemId || ''] = data[resource][lang][itemId || ''] || {};
  return data[resource][lang][itemId || ''];
}

/** Returns the previously stored normalized source for a path, or undefined. */
export function getNorm(resource, lang, itemId, path) {
  const data = load();
  return data?.[resource]?.[lang]?.[itemId || '']?.[path];
}

/**
 * Persist a batch of [resource, lang, itemId, path, norm] entries.
 * norm === null deletes the entry (e.g. a path no longer present).
 */
export function saveSnapshotBatch(entries) {
  const data = load();
  for (const [resource, lang, itemId, p, norm] of entries) {
    const item = blankItem(data, resource, lang, itemId);
    if (norm == null) delete item[p];
    else item[p] = norm;
  }
  persist();
}

/** Drop all snapshot entries for one item (called when a catalog item is deleted). */
export function removeItemSnapshot(resource, itemId) {
  const data = load();
  const iid = itemId || '';
  for (const lang of ['en', 'ru']) {
    if (data[resource]?.[lang]?.[iid]) delete data[resource][lang][iid];
  }
  persist();
}

/** Wipe the whole snapshot (useful after a translation engine/config change). */
export function clearSnapshot() {
  cache = {};
  persist();
}
