/**
 * Direktori unit pelayanan untuk hub gehc.page.
 * Data tampilan statis (v1) — belum membaca Tenant dari DB.
 * `host` hanya untuk unit yang sudah aktif; lainnya coming soon.
 *
 * Urutan: BIPRA (bapak, ibu, pemuda, remaja, anak) → teritorial (kolom) → lainnya.
 */

import { isStagingHost } from '../lib/host-context';

export type ChurchUnitStatus = 'active' | 'soon';
export type ChurchUnitGroup = 'bipra' | 'teritorial' | 'lainnya';

export type ChurchUnit = {
  id: 'youth' | 'teen' | 'kids' | 'men' | 'women' | 'districts' | 'community';
  name: string;
  nameEn: string;
  desc: string;
  status: ChurchUnitStatus;
  group: ChurchUnitGroup;
  /** Host tujuan bila aktif (mis. youth.gehc.page). */
  host?: string;
  /** Gradien aksen kartu. */
  accent: string;
};

export const CHURCH_GROUP_LABELS: Record<ChurchUnitGroup, { title: string; subtitle: string }> = {
  bipra: { title: 'Kategorial · BIPRA', subtitle: 'Anak, Remaja, Pemuda, Kaum Bapa & Ibu' },
  teritorial: { title: 'Teritorial', subtitle: 'Wilayah & Kolom' },
  lainnya: { title: 'Lainnya', subtitle: 'Komunitas & rekreasional' },
};

export const CHURCH_UNITS: ChurchUnit[] = [
  {
    id: 'men',
    name: 'Pria / Kaum Bapa',
    nameEn: 'Men',
    desc: 'Persekutuan dan pelayanan kaum bapa (P/KB).',
    status: 'active',
    group: 'bipra',
    host: 'men.gehc.page',
    accent: 'from-[#0EA5E9] to-[#1D4ED8]',
  },
  {
    id: 'women',
    name: 'Wanita / Kaum Ibu',
    nameEn: 'Women',
    desc: 'Persekutuan dan pelayanan kaum ibu (W/KI).',
    status: 'active',
    group: 'bipra',
    host: 'women.gehc.page',
    accent: 'from-[#EC4899] to-[#8B5CF6]',
  },
  {
    id: 'youth',
    name: 'Pemuda',
    nameEn: 'Youth',
    desc: 'Komunitas Beyonders — pemuridan, retreat, dan pelayanan pemuda.',
    status: 'active',
    group: 'bipra',
    host: 'youth.gehc.page',
    accent: 'from-[#FF416C] to-[#FF4B2B]',
  },
  {
    id: 'teen',
    name: 'Pra Remaja',
    nameEn: 'Teen',
    desc: 'Pembinaan remaja SMP & SMA di lingkungan gereja.',
    status: 'active',
    group: 'bipra',
    host: 'teen.gehc.page',
    accent: 'from-[#7C3AED] to-[#DB2777]',
  },
  {
    id: 'kids',
    name: 'Anak',
    nameEn: 'Kids',
    desc: 'Sekolah Minggu dan kegiatan anak penuh sukacita.',
    status: 'active',
    group: 'bipra',
    host: 'kids.gehc.page',
    accent: 'from-[#F59E0B] to-[#EF4444]',
  },
  {
    id: 'districts',
    name: 'Wilayah & Kolom',
    nameEn: 'Districts',
    desc: 'Pemetaan jemaat per wilayah/Kolom teritorial.',
    status: 'active',
    group: 'teritorial',
    host: 'districts.gehc.page',
    accent: 'from-[#10B981] to-[#047857]',
  },
  {
    id: 'community',
    name: 'Komunitas & Rekreasional',
    nameEn: 'Community',
    desc: 'Minat, bakat, musik, olahraga, dan kegiatan rekreasional.',
    status: 'active',
    group: 'lainnya',
    host: 'community.gehc.page',
    accent: 'from-[#6366F1] to-[#0EA5E9]',
  },
];

export const ACTIVE_UNIT_HOST: Partial<Record<ChurchUnit['id'], string>> = Object.fromEntries(
  CHURCH_UNITS.filter((u) => u.status === 'active' && u.host).map((u) => [u.id, u.host as string]),
) as Partial<Record<ChurchUnit['id'], string>>;

/**
 * URL portal unit sesuai lingkungan: produksi `men.gehc.page`, staging
 * `staging-men.gehc.page` (mengikuti host hub yang sedang dibuka).
 */
export function unitPortalUrl(id: ChurchUnit['id']): string | null {
  const unit = CHURCH_UNITS.find((u) => u.id === id);
  if (!unit?.host) return null;
  const staging = typeof window !== 'undefined' && isStagingHost(window.location.hostname);
  const host = staging ? unit.host.replace(/^([a-z]+)\./, 'staging-$1.') : unit.host;
  return `https://${host}`;
}

export const DEFAULT_MAP_URL = 'https://share.google/Ro2jBSuGfrzfg49nP';
export const CHURCH_ADDRESS =
  'Gereja GMIM Eben Haezer, Jl. Kasuari No. 12, Cikarang Baru, Kab. Bekasi, Jawa Barat, Indonesia';
