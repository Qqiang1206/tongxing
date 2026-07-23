/**
 * Short-lived in-memory cache for public /api/v1 content reads.
 * Cleared on admin/catalog writes so publish updates appear quickly.
 */
const DEFAULT_TTL_MS = 45_000;

const store = new Map();

function ttlMs() {
  const raw = process.env.PUBLIC_CACHE_TTL_MS;
  if (raw == null || raw === '') return DEFAULT_TTL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TTL_MS;
}

export function clearPublicCache() {
  store.clear();
}

export function cachedPublic(key, producer) {
  const ttl = ttlMs();
  if (ttl === 0) return producer();

  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const value = producer();
  store.set(key, { value, expiresAt: now + ttl });
  return value;
}
