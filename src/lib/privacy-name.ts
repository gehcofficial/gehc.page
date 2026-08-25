/**
 * Privasi nama untuk halaman publik: "Agnes Reimas" → "Agnes R."
 * Diterapkan pada seluruh nama orang yang tampil di landing/family tree.
 */
export function shortName(full?: string | null): string {
  if (!full) return '';
  // Buang gelar & tanda baca umum
  const clean = full
    .replace(/\b(Pnt|Dkn|Ps)\.?\b/g, '')
    .replace(/\b([A-Z]\.)+\b/g, '') // S.T., S.Kom, dsb.
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}
