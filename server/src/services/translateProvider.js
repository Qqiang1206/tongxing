/**
 * OpenAI-compatible translation provider (OpenAI, DeepSeek, etc.).
 *
 * Env:
 *   TRANSLATION_PROVIDER=deepseek|openai|echo
 *     (default: deepseek if key set and no provider; else echo)
 *   TRANSLATION_API_KEY=   (or DEEPSEEK_API_KEY)
 *   TRANSLATION_BASE_URL=
 *   TRANSLATION_MODEL=
 *
 * DeepSeek defaults:
 *   BASE_URL=https://api.deepseek.com
 *   MODEL=deepseek-v4-flash
 *   thinking disabled (cheaper / faster for bulk site copy)
 */

const LANG_NAMES = { en: 'English', ru: 'Russian' };

const DEEPSEEK_DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
};

const OPENAI_DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

export function getTranslationConfig() {
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
    apiKeyEnv: process.env.TRANSLATION_API_KEY
      ? 'TRANSLATION_API_KEY'
      : (process.env.DEEPSEEK_API_KEY ? 'DEEPSEEK_API_KEY' : null),
  };
}

/**
 * Translate an array of strings zh → targetLang.
 * Returns same-length array.
 */
export async function translateTexts(texts, targetLang) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const cfg = getTranslationConfig();
  if (cfg.provider === 'echo') {
    const tag = String(targetLang || 'xx').toUpperCase();
    return texts.map((t) => (t && String(t).trim() ? `[${tag}] ${t}` : t));
  }
  if (cfg.provider !== 'openai' && cfg.provider !== 'deepseek') {
    throw new Error('unsupported_provider');
  }
  if (!cfg.hasApiKey) {
    throw new Error('translation_not_configured');
  }

  const langName = LANG_NAMES[targetLang] || targetLang;
  const chunks = chunkBySize(texts, 40, 12000);
  const out = [];
  for (const chunk of chunks) {
    const translated = await callOpenAiCompatible(cfg, chunk, langName);
    if (translated.length !== chunk.length) {
      throw new Error('translation_length_mismatch');
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

function resolveApiKey() {
  return process.env.TRANSLATION_API_KEY || process.env.DEEPSEEK_API_KEY || '';
}

function isDeepSeek(cfg) {
  return cfg.provider === 'deepseek' || /deepseek\.com/i.test(cfg.baseUrl || '');
}

async function callOpenAiCompatible(cfg, texts, langName) {
  const system =
    `You are a professional translator for an industrial automation company website (TXAM). ` +
    `Translate the JSON array of Chinese strings into ${langName}. ` +
    `Rules: keep HTML tags and attributes unchanged; keep brand names TXAM / 同兴高科 as appropriate; ` +
    `do not translate URLs, file paths, or emails; return ONLY a JSON array of strings with the same length.`;

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

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolveApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`translation_api_error:${res.status}:${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return parseJsonArray(content);
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
