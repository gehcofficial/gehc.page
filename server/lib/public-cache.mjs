/**
 * Cache in-memory ringan untuk endpoint publik read-heavy.
 * Vercel serverless: cache per-instance (cold-start = miss) — tetap memangkas
 * N-query TiDB/Drive berulang dalam masa hangat. TTL default 60 detik.
 */

const store = new Map();

export function getPublicCache(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    store.delete(key);
    return null;
  }
  return hit.data;
}

export function setPublicCache(key, data, ttlMs = 60_000) {
  if (store.size > 200) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), data, ttl: ttlMs });
}

export function bustPublicCache(prefix) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of [...store.keys()]) {
    if (String(k).startsWith(prefix)) store.delete(k);
  }
}

/**
 * Pasang header cache publik dengan SWR agar CDN/browser menahan burst.
 * maxAge detik, swr detik (stale-while-revalidate).
 */
export function setPublicCacheHeaders(res, maxAge = 60, swr = 300) {
  res.setHeader(
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
  );
  res.setHeader('Vary', 'Accept-Encoding, Host');
}
