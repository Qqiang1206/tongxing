/**
 * Translation API call logging & aggregation.
 *
 * Each chunk call to translateProvider.callOpenAiCompatible writes one row,
 * tagged with job_id (when available) so a translation job's full cost can
 * be summed back from the log.
 */
import { getDb } from '../db.js';

/**
 * Insert one API call record. Best-effort: never throws into the caller.
 * @param {{
 *   engineName?: string,
 *   provider?: string,
 *   model?: string,
 *   targetLang?: string,
 *   inputChars?: number,
 *   outputChars?: number,
 *   promptTokens?: number,
 *   completionTokens?: number,
 *   totalTokens?: number,
 *   durationMs?: number,
 *   success?: boolean,
 *   httpStatus?: number,
 *   error?: string,
 *   jobId?: number|null,
 * }} data
 */
export function logApiCall(data) {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO translation_api_log
        (engine_name, provider, model, target_lang,
         input_chars, output_chars,
         prompt_tokens, completion_tokens, total_tokens,
         duration_ms, success, http_status, error, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.engineName || null,
      data.provider || null,
      data.model || null,
      data.targetLang || null,
      Number(data.inputChars) || 0,
      Number(data.outputChars) || 0,
      Number(data.promptTokens) || 0,
      Number(data.completionTokens) || 0,
      Number(data.totalTokens) || 0,
      Number(data.durationMs) || 0,
      data.success === false ? 0 : 1,
      Number(data.httpStatus) || null,
      data.error ? String(data.error).slice(0, 500) : null,
      data.jobId != null ? Number(data.jobId) : null
    );
  } catch (err) {
    // Logging must never break translation flow.
    console.error('[translationApiLog] logApiCall failed:', err.message);
  }
}

/**
 * List recent API log rows (newest first).
 * @param {{ limit?: number, offset?: number }} opts
 */
export function listApiLogs({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, called_at, engine_name, provider, model, target_lang,
              input_chars, output_chars, prompt_tokens, completion_tokens, total_tokens,
              duration_ms, success, http_status, error, job_id
       FROM translation_api_log
       ORDER BY id DESC
       LIMIT ? OFFSET ?`
    )
    .all(Number(limit) || 50, Number(offset) || 0);
  return rows.map(rowToLog);
}

/**
 * Aggregated usage stats for the overview card.
 * Returns totals for today and the last 7 days, plus per-engine / per-day breakdowns.
 */
export function getApiUsageStats() {
  const db = getDb();
  const today = db
    .prepare(
      `SELECT
         COUNT(*) AS calls,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS ok,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed,
         COALESCE(SUM(duration_ms), 0) AS duration_ms
       FROM translation_api_log
       WHERE date(called_at) = date('now')`
    )
    .get();
  const week = db
    .prepare(
      `SELECT
         COUNT(*) AS calls,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS ok,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed,
         COALESCE(SUM(duration_ms), 0) AS duration_ms
       FROM translation_api_log
       WHERE called_at >= datetime('now', '-6 days', 'start of day')`
    )
    .get();
  const total = db
    .prepare(
      `SELECT
         COUNT(*) AS calls,
         COALESCE(SUM(total_tokens), 0) AS tokens
       FROM translation_api_log`
    )
    .get();
  const perEngine = db
    .prepare(
      `SELECT
         COALESCE(engine_name, provider, '(unknown)') AS engine_name,
         COUNT(*) AS calls,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
       FROM translation_api_log
       GROUP BY COALESCE(engine_name, provider, '(unknown)')
       ORDER BY calls DESC`
    )
    .all();
  const perDay = db
    .prepare(
      `SELECT
         date(called_at) AS day,
         COUNT(*) AS calls,
         COALESCE(SUM(total_tokens), 0) AS tokens,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
       FROM translation_api_log
       WHERE called_at >= datetime('now', '-13 days', 'start of day')
       GROUP BY date(called_at)
       ORDER BY day DESC`
    )
    .all();
  return { today, week, total, perEngine, perDay };
}

function rowToLog(row) {
  return {
    id: row.id,
    calledAt: row.called_at,
    engineName: row.engine_name,
    provider: row.provider,
    model: row.model,
    targetLang: row.target_lang,
    inputChars: row.input_chars,
    outputChars: row.output_chars,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    durationMs: row.duration_ms,
    success: row.success === 1,
    httpStatus: row.http_status,
    error: row.error,
    jobId: row.job_id,
  };
}
