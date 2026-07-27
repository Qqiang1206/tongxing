import { getDb } from '../db.js';
import { markCurrent, readTranslationStatus } from './translationStatus.js';
import { translateResource } from './translateResource.js';
import { getTranslationConfig } from './translateProvider.js';

const TARGET_LANGS = ['en', 'ru'];

/** Maximum attempts before a failed job stops being auto-reset by the scheduler. */
export const MAX_AUTO_RETRY_ATTEMPTS = 5;

function rowToJob(row) {
  return {
    id: row.id,
    resource: row.resource,
    sourceLang: row.source_lang || 'zh',
    targetLangs: JSON.parse(row.target_langs_json || '[]'),
    status: row.status,
    note: row.note || null,
    error: row.error || null,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    attempts: Number(row.attempts) || 0,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function listTranslationJobs() {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM translation_job_store ORDER BY id DESC')
    .all();
  return {
    jobs: rows.map(rowToJob),
    config: getTranslationConfig(),
  };
}

export function getTranslationJob(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM translation_job_store WHERE id = ?').get(Number(id));
  if (!row) throw new Error('not_found');
  return rowToJob(row);
}

export function createTranslationJob({ resource, targetLangs, note } = {}) {
  if (!resource || typeof resource !== 'string') {
    throw new Error('missing_resource');
  }
  const langs =
    Array.isArray(targetLangs) && targetLangs.length
      ? targetLangs.filter((l) => TARGET_LANGS.includes(l))
      : TARGET_LANGS.slice();
  if (!langs.length) throw new Error('invalid_lang');

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO translation_job_store (resource, source_lang, target_langs_json, status, note, created_at)
       VALUES (?, 'zh', ?, 'pending', ?, datetime('now'))`
    )
    .run(resource, JSON.stringify(langs), note || null);
  return getTranslationJob(info.lastInsertRowid);
}

export function enqueueStaleJobs() {
  const status = readTranslationStatus();
  const db = getDb();
  /* Mid-flight jobs left as running after refresh/crash would block new enqueue */
  db.prepare(
    `UPDATE translation_job_store
     SET status='failed', error='interrupted', completed_at=datetime('now')
     WHERE status='running'`
  ).run();
  const pending = db
    .prepare(`SELECT resource FROM translation_job_store WHERE status IN ('pending','running')`)
    .all()
    .map((r) => r.resource);
  const pendingKeys = new Set(pending);
  const created = [];
  for (const [resource, langs] of Object.entries(status.resources || {})) {
    const need = TARGET_LANGS.filter((l) => langs[l] === 'stale');
    if (!need.length || pendingKeys.has(resource)) continue;
    created.push(createTranslationJob({ resource, targetLangs: need, note: 'auto-stale' }));
  }
  return { created: created.length, jobs: created };
}

/**
 * Pick the oldest pending job. Used by the scheduler to drain the queue serially.
 * Returns the job object, or null if none pending.
 */
export function getNextPendingJob() {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM translation_job_store
       WHERE status = 'pending'
       ORDER BY id ASC
       LIMIT 1`
    )
    .get();
  return row ? rowToJob(row) : null;
}

/**
 * Reset failed jobs older than `minutes` back to pending, but only if their
 * attempt count is below MAX_AUTO_RETRY_ATTEMPTS. Jobs that have exhausted
 * retries stay failed and surface in the admin panel for inspection.
 * @param {number} minutes
 * @param {number} [maxAttempts=MAX_AUTO_RETRY_ATTEMPTS]
 * @returns {{ reset: number, exhausted: number }}
 */
export function resetFailedJobsOlderThan(minutes, maxAttempts = MAX_AUTO_RETRY_ATTEMPTS) {
  const db = getDb();
  const cutoff = new Date(Date.now() - Number(minutes) * 60 * 1000).toISOString();
  const reset = db
    .prepare(
      `UPDATE translation_job_store
       SET status='pending', error=NULL, completed_at=NULL
       WHERE status='failed'
         AND completed_at IS NOT NULL
         AND completed_at <= ?
         AND attempts < ?`
    )
    .run(cutoff, Number(maxAttempts) || MAX_AUTO_RETRY_ATTEMPTS);
  const exhausted = db
    .prepare(
      `SELECT COUNT(*) AS c FROM translation_job_store
       WHERE status='failed' AND attempts >= ?`
    )
    .get(Number(maxAttempts) || MAX_AUTO_RETRY_ATTEMPTS)?.c || 0;
  return { reset: reset.changes || 0, exhausted };
}

export async function runTranslationJob(id) {
  const db = getDb();
  const job = getTranslationJob(id);
  if (job.status === 'running') throw new Error('already_running');

  // Flip to running and bump attempts counter (so failed retries are capped).
  db.prepare(
    `UPDATE translation_job_store
     SET status='running', started_at=datetime('now'), error=NULL,
         attempts = attempts + 1
     WHERE id=?`
  ).run(Number(id));

  try {
    const result = await translateResource(job.resource, job.targetLangs, { jobId: Number(id) });
    for (const lang of job.targetLangs) {
      markCurrent(job.resource, lang);
    }
    db.prepare(
      `UPDATE translation_job_store
       SET status='done', result_json=?, completed_at=datetime('now'), error=NULL
       WHERE id=?`
    ).run(JSON.stringify(result), Number(id));
    return getTranslationJob(id);
  } catch (err) {
    db.prepare(
      `UPDATE translation_job_store
       SET status='failed', error=?, completed_at=datetime('now')
       WHERE id=?`
    ).run(String(err.message || err), Number(id));
    throw err;
  }
}

/** Compat: apply is no-op after run already writes. */
export function applyTranslationJob(id) {
  const job = getTranslationJob(id);
  if (job.status !== 'done') throw new Error('job_not_done');
  return job;
}
