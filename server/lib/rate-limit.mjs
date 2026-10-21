/**
 * Rate limit in-memory sederhana (sliding window) untuk endpoint absensi mandiri.
 *
 * Sengaja tanpa dependensi & tanpa tabel: cukup menahan brute-force PIN 6 digit
 * pada satu proses server. Vercel bisa punya beberapa instance, jadi batas ini
 * adalah lapisan tambahan — bukan satu-satunya pertahanan (token HMAC + jendela
 * waktu tetap yang utama).
 */

const buckets = new Map();
const MAX_KEYS = 5000;

function prune(now, windowMs) {
  if (buckets.size <= MAX_KEYS) return;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < windowMs);
    if (fresh.length) buckets.set(key, fresh);
    else buckets.delete(key);
  }
}

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function rateLimit(key, { limit = 10, windowMs = 5 * 60 * 1000, now = Date.now() } = {}) {
  const k = String(key || 'anon');
  const hits = (buckets.get(k) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(k, hits);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, windowMs - (now - hits[0])) };
  }
  hits.push(now);
  buckets.set(k, hits);
  prune(now, windowMs);
  return { allowed: true, remaining: Math.max(0, limit - hits.length), retryAfterMs: 0 };
}

export function resetRateLimit(key) {
  buckets.delete(String(key || 'anon'));
}

/** Dipakai unit test / restart skenario. */
export function clearRateLimits() {
  buckets.clear();
}
