/**
 * Lightweight in-memory rate limiter (single Node process).
 */

const buckets = new Map();

export function createRateLimiter({ windowMs, maxHits, label = 'rate' }) {
  const window = Math.max(1000, Number(windowMs) || 60000);
  const max = Math.max(1, Number(maxHits) || 60);

  return function check(key) {
    const id = String(key || 'unknown');
    const now = Date.now();
    let row = buckets.get(id);
    if (!row || now - row.start >= window) {
      row = { start: now, count: 0, label };
    }
    row.count += 1;
    buckets.set(id, row);
    if (row.count > max) {
      const err = new Error(`${label}_limit_exceeded`);
      err.status = 429;
      throw err;
    }
    return { remaining: Math.max(0, max - row.count) };
  };
}
