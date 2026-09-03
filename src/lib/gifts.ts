/**
 * `giftsTop5` tersimpan sebagai kolom JSON, dan isinya tidak seragam:
 * hasil gift test menulis `{ key, label, score }` (lihat src/data/giftBank.ts),
 * sedangkan data lama/impor manual bisa berupa string biasa.
 *
 * Selalu lewatkan nilai mentah ke `normalizeGifts` sebelum dirender —
 * merender objeknya langsung memicu React error #31.
 */

export type GiftValue = { key?: string; label?: string; score?: number } | string;

export type NormalizedGift = {
  key: string;
  label: string;
  score?: number;
};

export function normalizeGifts(raw: unknown): NormalizedGift[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g, i) => {
    if (typeof g === 'string') return { key: `gift-${i}`, label: g };
    if (!g || typeof g !== 'object') return { key: `gift-${i}`, label: String(g ?? '') };
    const o = g as Exclude<GiftValue, string> & Record<string, unknown>;
    return {
      key: String(o.key || `gift-${i}`),
      label: String(o.label || o.key || ''),
      score: typeof o.score === 'number' ? o.score : undefined,
    };
  });
}

/** Label saja — untuk badge, ringkasan, dan join koma. */
export function giftLabels(raw: unknown): string[] {
  return normalizeGifts(raw)
    .map((g) => g.label)
    .filter(Boolean);
}
