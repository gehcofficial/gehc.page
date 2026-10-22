/**
 * Poll layar hidup: jeda saat tab tersembunyi, langsung segar saat kembali,
 * dan mundur bila server bilang tidak ada perubahan (304).
 */

export type EtagSlot = { etag: string | null };

export function nextUnchangedDelay(currentMs: number, baseMs: number, maxMs: number): number {
  const base = Math.max(1000, baseMs);
  const max = Math.max(base, maxMs);
  const cur = Math.max(base, currentMs);
  return Math.min(max, Math.round(cur * 1.6));
}

export async function fetchWithEtag(
  url: string,
  slot: EtagSlot,
  init: RequestInit = {},
): Promise<{ unchanged: boolean; response: Response; data: unknown }> {
  const headers = new Headers(init.headers || undefined);
  if (slot.etag) headers.set('If-None-Match', slot.etag);
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const tag = response.headers.get('ETag');
  if (tag) slot.etag = tag;
  if (response.status === 304) return { unchanged: true, response, data: null };
  const data = await response.json().catch(() => null);
  return { unchanged: false, response, data };
}

/**
 * `run` mengembalikan false bila payload tidak berubah.
 * Panggilan pertama langsung; berikutnya mengikuti jeda.
 */
export function startVisiblePoll(
  run: () => Promise<boolean | void>,
  baseMs = 15000,
  maxMs = 30000,
): () => void {
  let stopped = false;
  let timer = 0;
  let delay = baseMs;
  const loop = async () => {
    if (stopped) return;
    if (typeof document === 'undefined' || !document.hidden) {
      let changed: boolean | void = true;
      try {
        changed = await run();
      } catch {
        changed = true;
      }
      delay = changed === false ? nextUnchangedDelay(delay, baseMs, maxMs) : baseMs;
    }
    if (!stopped) timer = window.setTimeout(loop, delay);
  };
  void run().catch(() => undefined);
  timer = window.setTimeout(loop, baseMs);
  const onVis = () => {
    if (stopped || typeof document === 'undefined' || document.hidden) return;
    window.clearTimeout(timer);
    delay = baseMs;
    void loop();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
  };
}
