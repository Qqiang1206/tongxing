/**
 * Automatic translation scheduler.
 *
 * Replaces the manual "立即同步 / 运行 / 应用" admin buttons. Once the server
 * boots, this module ticks every 30s to:
 *   1. enqueue any stale resources into pending jobs (enqueueStaleJobs)
 *   2. pick the oldest pending job and run it serially (one at a time, to
 *      respect translation API rate limits)
 *
 * A second, slower tick (5min) resets failed jobs older than 10 minutes back
 * to pending — but only if their attempts counter is below MAX_AUTO_RETRY_ATTEMPTS
 * (default 5). Jobs that exhaust retries stay failed and surface in the admin
 * panel for inspection; the next zh edit will create a fresh job (attempts=0).
 *
 * Safety:
 *   - When no engine is configured (canWrite=false), the scheduler no-ops.
 *   - `isRunning` guards against overlapping ticks.
 *   - All errors are caught and logged; the scheduler never crashes the process.
 */
import { enqueueStaleJobs, getNextPendingJob, runTranslationJob, resetFailedJobsOlderThan } from './translationJobs.js';
import { getTranslationConfig } from './translateProvider.js';
import { clearPublicCache } from './publicCache.js';
import { getDb } from '../db.js';

const TICK_INTERVAL_MS = 30 * 1000;          // main tick: 30s
const RESET_TICK_INTERVAL_MS = 5 * 60 * 1000; // reset tick: 5min
const RESET_FAILED_AFTER_MIN = 10;            // failed → pending after 10min
const STARTUP_DELAY_MS = 5 * 1000;            // let DB seed finish first

// Catalog kinds → their i18n table. Used by reconcile to detect `missing`
// rows whose resource_translation_status may have been seeded as 'current'
// (so enqueueStaleJobs would skip them on first boot).
const CATALOG_I18N_TABLES = [
  { resource: 'products', table: 'product_i18n' },
  { resource: 'solutions', table: 'solution_i18n' },
  { resource: 'news', table: 'news_i18n' },
];

let isRunning = false;
let tickTimer = null;
let resetTimer = null;
let started = false;
let reconciled = false;

export function startTranslationScheduler() {
  if (started) return;
  started = true;
  // Defer first tick so ensureCategoryTables / engine seed complete first.
  setTimeout(() => {
    tickTimer = setInterval(tick, TICK_INTERVAL_MS);
    resetTimer = setInterval(resetTick, RESET_TICK_INTERVAL_MS);
    // Kick one off immediately (after the startup delay) to drain backlog.
    tick().catch((err) => console.error('[translationScheduler] initial tick failed:', err.message));
  }, STARTUP_DELAY_MS);
  console.log('[translationScheduler] scheduled (tick=%dms, reset=%dms)', TICK_INTERVAL_MS, RESET_TICK_INTERVAL_MS);
}

export function stopTranslationScheduler() {
  if (tickTimer) clearInterval(tickTimer);
  if (resetTimer) clearInterval(resetTimer);
  tickTimer = null;
  resetTimer = null;
  started = false;
}

async function tick() {
  if (isRunning) return;
  // Skip entirely if no engine configured — avoids creating failed jobs.
  let cfg;
  try {
    cfg = getTranslationConfig();
  } catch (err) {
    console.error('[translationScheduler] config read failed:', err.message);
    return;
  }
  if (!cfg || !cfg.canWrite) return;

  // On the first runnable tick, reconcile: any catalog i18n row still in
  // 'missing' state means the en/ru content was never translated. Force its
  // resource_translation_status to 'stale' so enqueueStaleJobs creates a job.
  if (!reconciled) {
    try {
      reconcileMissingTranslations();
    } catch (err) {
      console.error('[translationScheduler] reconcile failed:', err.message);
    }
    reconciled = true;
  }

  // 1. Promote stale resources to pending jobs.
  try {
    enqueueStaleJobs();
  } catch (err) {
    console.error('[translationScheduler] enqueueStaleJobs failed:', err.message);
  }

  // 2. Drain one pending job (serial execution).
  let job;
  try {
    job = getNextPendingJob();
  } catch (err) {
    console.error('[translationScheduler] getNextPendingJob failed:', err.message);
    return;
  }
  if (!job) return;

  isRunning = true;
  const label = job.resource;
  const startedAt = Date.now();
  try {
    console.log('[translationScheduler] running job #%d (%s) attempt=%d', job.id, label, (job.attempts || 0) + 1);
    await runTranslationJob(job.id);
    // Refresh public caches so the translated content shows up immediately.
    try {
      clearPublicCache();
    } catch (_) { /* cache clear is best-effort */ }
    console.log(
      '[translationScheduler] job #%d done (%s) in %dms',
      job.id, label, Date.now() - startedAt
    );
  } catch (err) {
    console.error(
      '[translationScheduler] job #%d failed (%s): %s',
      job.id, label, err.message || err
    );
    // Failure is already recorded with attempts+1 inside runTranslationJob.
  } finally {
    isRunning = false;
  }
}

function resetTick() {
  try {
    const { reset, exhausted } = resetFailedJobsOlderThan(RESET_FAILED_AFTER_MIN);
    if (reset > 0) {
      console.log('[translationScheduler] reset %d failed job(s) to pending', reset);
    }
    if (exhausted > 0) {
      console.warn('[translationScheduler] %d job(s) exhausted retries (staying failed)', exhausted);
    }
  } catch (err) {
    console.error('[translationScheduler] resetTick failed:', err.message);
  }
}

/**
 * Detect catalog i18n rows still in 'missing' state and force their
 * resource_translation_status to 'stale' so enqueueStaleJobs picks them up.
 *
 * This handles the backlog from before the auto-scheduler existed: products /
 * solutions / news created when the admin had to manually click "同步" — those
 * en/ru i18n rows are 'missing' but resource_translation_status was seeded
 * as 'current', so they'd otherwise never be queued.
 *
 * Safe to run on every boot: once all rows are 'current'/'source', this is a
 * no-op.
 */
function reconcileMissingTranslations() {
  const db = getDb();
  let forced = 0;
  for (const { resource, table } of CATALOG_I18N_TABLES) {
    for (const lang of ['en', 'ru']) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${table} WHERE lang = ? AND translation_status = 'missing'`
        )
        .get(lang);
      const missing = Number(row?.c) || 0;
      if (missing === 0) continue;
      db.prepare(
        `INSERT INTO resource_translation_status (resource, lang, status, updated_at)
         VALUES (?, ?, 'stale', datetime('now'))
         ON CONFLICT(resource, lang) DO UPDATE SET status='stale', updated_at=datetime('now')`
      ).run(resource, lang);
      forced++;
      console.log(
        '[translationScheduler] reconcile: %s/%s has %d missing i18n row(s) → forced stale',
        resource, lang, missing
      );
    }
  }
  if (forced > 0) {
    console.log('[translationScheduler] reconcile forced %d resource/lang(s) to stale', forced);
  }
}
