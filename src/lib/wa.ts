/** Normalisasi nomor telepon Indonesia → digit untuk wa.me (0 → 62). */
export function waDigits(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  if (normalized.length < 9) return null;
  return normalized;
}

/** URL wa.me dengan pesan opsional; null bila nomor tidak valid. */
export function waMeHref(phone?: string | null, text?: string): string | null {
  const digits = waDigits(phone);
  if (!digits) return null;
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}
