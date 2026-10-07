/**
 * Marturia — konstanta + helper murni (Sprint A).
 * Dipakai UI + diuji unit. Server (routes/marturia.mjs) memirror literal yang sama.
 */

/** Template shotlist default Dokumentasi Visual per event. */
export const SHOTLIST_DEFAULTS: string[] = [
  'Suasana venue pra-acara',
  'Pujian & musik',
  'Firman / khotbah',
  'FGD / pleno / sesi inti',
  'Komunitas kelompok',
  'Distribusi konsumsi & kebersamaan',
];

/** Status antrean asset desain. */
export const ASSET_STATUS = ['DIMINTA', 'DIGARAP', 'REVIEW', 'FINAL', 'HANDOFF'] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

/** Alur maju status asset (tidak boleh mundur via UI biasa). */
const ASSET_NEXT: Record<AssetStatus, AssetStatus | null> = {
  DIMINTA: 'DIGARAP',
  DIGARAP: 'REVIEW',
  REVIEW: 'FINAL',
  FINAL: 'HANDOFF',
  HANDOFF: null,
};

export function nextAssetStatus(s: string): AssetStatus | null {
  const cur = (ASSET_STATUS as readonly string[]).includes(s) ? (s as AssetStatus) : null;
  if (!cur) return null;
  return ASSET_NEXT[cur];
}

export function isAssetStatus(s: string): s is AssetStatus {
  return (ASSET_STATUS as readonly string[]).includes(s);
}

/** Status jiwa baru misi. */
export const SOUL_STATUS = ['BARU', 'DIHUBUNGI', 'HADIR', 'DISERAHKAN'] as const;
export type SoulStatus = (typeof SOUL_STATUS)[number];

export function isSoulStatus(s: string): s is SoulStatus {
  return (SOUL_STATUS as readonly string[]).includes(s);
}

/** Kode referral: huruf-angka pendek, tanpa karakter ambigu. */
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeReferralCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length) % REF_ALPHABET.length];
  }
  return `GB-${out}`;
}

/** Link publik referral (tanpa login untuk pengklik). */
export function referralLink(code: string, origin?: string): string {
  const base = (origin || '').replace(/\/$/, '') || 'https://youth.gehc.page';
  return `${base}/#/join?ref=${encodeURIComponent(code)}`;
}
