/**
 * OpenAI-compatible translation provider (OpenAI, DeepSeek, Qianwen, etc.).
 *
 * Engine config is read from the DB (translation_engine_config, is_active=1).
 * Falls back to env vars if no active engine is configured.
 *
 * Env (legacy fallback):
 *   TRANSLATION_PROVIDER=deepseek|openai|qianwen|echo
 *   TRANSLATION_API_KEY=
 *   TRANSLATION_BASE_URL=
 *   TRANSLATION_MODEL=
 */
import { getDb } from '../db.js';
import { logApiCall } from './translationApiLog.js';

const LANG_NAMES = { en: 'English', ru: 'Russian' };

const DEEPSEEK_DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
};

const OPENAI_DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

const QIANWEN_DEFAULTS = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-plus',
};

/**
 * Read translation config from the active DB engine, falling back to env vars.
 * NOTE: the returned object includes `apiKey` (full key) for internal use.
 * Do NOT send it to the client without stripping — admin route handles that.
 */
export function getTranslationConfig() {
  // 1. Try active engine from DB
  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT * FROM translation_engine_config WHERE is_active = 1 LIMIT 1`
    ).get();
    if (row && row.api_key) {
      const provider = String(row.provider || '').toLowerCase();
      return {
        provider,
        configured: true,
        canWrite: true,
        model: row.model,
        baseUrl: String(row.base_url || '').replace(/\/$/, ''),
        hasApiKey: true,
        apiKey: row.api_key,
        engineName: row.name,
        source: 'db',
      };
    }
  } catch (_) {
    // DB not ready or table missing — fall through to env
  }

  // 2. Fall back to env vars (backward compat)
  const apiKey =
    process.env.TRANSLATION_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    '';
  const providerEnv = (process.env.TRANSLATION_PROVIDER || '').toLowerCase();
  let provider = providerEnv;
  if (!provider) {
    provider = apiKey ? 'deepseek' : 'echo';
  }

  const defaults =
    provider === 'deepseek' ? DEEPSEEK_DEFAULTS :
    provider === 'openai' ? OPENAI_DEFAULTS :
    provider === 'qianwen' ? QIANWEN_DEFAULTS :
    DEEPSEEK_DEFAULTS;

  const baseUrl = (
    process.env.TRANSLATION_BASE_URL ||
    defaults.baseUrl
  ).replace(/\/$/, '');

  return {
    provider,
    configured: provider === 'echo' || Boolean(apiKey),
    canWrite: provider === 'echo' || Boolean(apiKey),
    model: process.env.TRANSLATION_MODEL || defaults.model,
    baseUrl,
    hasApiKey: Boolean(apiKey),
    apiKey,
    apiKeyEnv: process.env.TRANSLATION_API_KEY
      ? 'TRANSLATION_API_KEY'
      : (process.env.DEEPSEEK_API_KEY ? 'DEEPSEEK_API_KEY' : null),
    source: 'env',
  };
}

/**
 * Translate an array of strings zh → targetLang.
 * Returns same-length array.
 * @param {string[]} texts
 * @param {string} targetLang
 * @param {{ jobId?: number|null }} [opts]  — job id forwarded to API log
 */
export async function translateTexts(texts, targetLang, opts) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const cfg = getTranslationConfig();
  if (cfg.provider === 'echo') {
    const tag = String(targetLang || 'xx').toUpperCase();
    return texts.map((t) => (t && String(t).trim() ? `[${tag}] ${t}` : t));
  }
  if (cfg.provider !== 'openai' && cfg.provider !== 'deepseek' && cfg.provider !== 'qianwen') {
    throw new Error('unsupported_provider');
  }
  if (!cfg.hasApiKey) {
    throw new Error('translation_not_configured');
  }

  const langName = LANG_NAMES[targetLang] || targetLang;
  const chunks = chunkBySize(texts, 60, 12000);
  const jobId = opts && opts.jobId != null ? Number(opts.jobId) : null;

  // Parallel API calls — much faster than sequential.
  const results = await Promise.all(
    chunks.map((chunk) => callOpenAiCompatible(cfg, chunk, langName, { targetLang, jobId }))
  );

  const out = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const translated = results[ci];
    if (translated.length !== chunk.length) {
      // Some models (e.g. Qwen flash) occasionally return wrong count.
      // Best-effort fixup: pad missing slots with originals, truncate extras.
      // This avoids total failure while keeping most translations correct.
      while (translated.length < chunk.length) {
        translated.push(chunk[translated.length]);
      }
      if (translated.length > chunk.length) {
        translated.length = chunk.length;
      }
    }
    out.push(...translated);
  }
  return out;
}

function chunkBySize(items, maxItems, maxChars) {
  const chunks = [];
  let buf = [];
  let chars = 0;
  for (const item of items) {
    const len = String(item || '').length;
    if (buf.length && (buf.length >= maxItems || chars + len > maxChars)) {
      chunks.push(buf);
      buf = [];
      chars = 0;
    }
    buf.push(item);
    chars += len;
  }
  if (buf.length) chunks.push(buf);
  return chunks;
}

function isDeepSeek(cfg) {
  return cfg.provider === 'deepseek' || /deepseek\.com/i.test(cfg.baseUrl || '');
}

async function callOpenAiCompatible(cfg, texts, langName, logCtx = {}) {
  const n = texts.length;
  const system =
    `You are a professional translator for an industrial automation company website (TXAM). ` +
    `Translate the JSON array of ${n} Chinese strings into ${langName}. ` +
    `CRITICAL: You must return EXACTLY ${n} strings in a JSON array — no more, no less. ` +
    `Rules: keep HTML tags and attributes unchanged; keep brand names TXAM / 同兴高科 as appropriate; ` +
    `do not translate URLs, file paths, or emails; return ONLY a JSON array of strings.`;

  const body = {
    model: cfg.model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(texts) },
    ],
  };

  // DeepSeek V4 defaults thinking=on; disable for bulk translation (cost + latency).
  if (isDeepSeek(cfg)) {
    body.thinking = { type: 'disabled' };
  }

  const apiKey = cfg.apiKey || process.env.TRANSLATION_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  const inputChars = texts.reduce((s, t) => s + String(t || '').length, 0);
  const startedAt = Date.now();

  let res;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network / DNS / abort — log and rethrow so the job fails visibly.
    logApiCall({
      engineName: cfg.engineName,
      provider: cfg.provider,
      model: cfg.model,
      targetLang: logCtx.targetLang,
      inputChars,
      outputChars: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      httpStatus: 0,
      error: String(err.message || err),
      jobId: logCtx.jobId,
    });
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    logApiCall({
      engineName: cfg.engineName,
      provider: cfg.provider,
      model: cfg.model,
      targetLang: logCtx.targetLang,
      inputChars,
      outputChars: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      httpStatus: res.status,
      error: errText.slice(0, 500),
      jobId: logCtx.jobId,
    });
    throw new Error(`translation_api_error:${res.status}:${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  const usage = data.usage || {};
  let parsed;
  try {
    parsed = parseJsonArray(content);
  } catch (err) {
    logApiCall({
      engineName: cfg.engineName,
      provider: cfg.provider,
      model: cfg.model,
      targetLang: logCtx.targetLang,
      inputChars,
      outputChars: String(content || '').length,
      promptTokens: Number(usage.prompt_tokens) || 0,
      completionTokens: Number(usage.completion_tokens) || 0,
      totalTokens: Number(usage.total_tokens) || 0,
      durationMs: Date.now() - startedAt,
      success: false,
      httpStatus: res.status,
      error: String(err.message || err),
      jobId: logCtx.jobId,
    });
    throw err;
  }
  const outputChars = parsed.reduce((s, t) => s + String(t || '').length, 0);
  logApiCall({
    engineName: cfg.engineName,
    provider: cfg.provider,
    model: cfg.model,
    targetLang: logCtx.targetLang,
    inputChars,
    outputChars,
    promptTokens: Number(usage.prompt_tokens) || 0,
    completionTokens: Number(usage.completion_tokens) || 0,
    totalTokens: Number(usage.total_tokens) || 0,
    durationMs: Date.now() - startedAt,
    success: true,
    httpStatus: res.status,
    jobId: logCtx.jobId,
  });
  return parsed;
}

function parseJsonArray(content) {
  let raw = String(content || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('translation_bad_response');
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('translation_bad_response');
  return parsed.map((x) => (x == null ? '' : String(x)));
}
