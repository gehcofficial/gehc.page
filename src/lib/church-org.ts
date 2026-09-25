/**
 * Katalog unit pelayanan jemaat (di bawah BPMJ) — di luar Pelsis BIPRA & Kolom.
 * Unit & posisi disimpan di `StrukturMember.division` + `.position` (tanpa enum Role baru).
 */

export type ChurchUnitCode = 'PEMBANGUNAN' | 'THL' | 'TECHTEAM' | 'PANJI';

export type ChurchSubDivision = { name: string; tagline: string };

export type ChurchUnitDef = {
  code: ChurchUnitCode;
  label: string;
  labelEn: string;
  tagline: string;
  /** Emoji/ikon teks untuk tampilan ringan. */
  icon: string;
  color: string;
  subdivisions: ChurchSubDivision[];
  /** Posisi kepengurusan unit (bukan sub-divisi). */
  positions: string[];
};

export const CHURCH_UNITS: ChurchUnitDef[] = [
  {
    code: 'PEMBANGUNAN',
    label: 'Departemen Pembangunan',
    labelEn: 'Building & Development',
    tagline: 'Penyewaan, pemeliharaan & fasilitas bangunan gereja',
    icon: '🏗️',
    color: '#F59E0B',
    subdivisions: [
      { name: 'Fasilitas & Penyewaan', tagline: 'Penyewaan ruang/gedung, jadwal & tarif' },
      { name: 'Pemeliharaan', tagline: 'Perawatan bangunan, inventaris & perbaikan' },
    ],
    positions: ['Ketua', 'Bendahara', 'Kostor', 'Asisten Kostor'],
  },
  {
    code: 'THL',
    label: 'Tim Harmoni Liturgi',
    labelEn: 'Harmony of Liturgy Team',
    tagline: 'Penatalayanan jemaat (Stewardship) + Multimedia, Dokumentasi & Sound (MDS)',
    icon: '🎼',
    color: '#7C3AED',
    subdivisions: [
      { name: 'Stewardship', tagline: 'Penatalayanan seluruh jemaat (petugas ibadah & acara)' },
      { name: 'MDS', tagline: 'Multimedia, Dokumentasi & Sound System' },
    ],
    positions: ['Ketua', 'Koordinator Stewardship', 'Koordinator MDS'],
  },
  {
    code: 'TECHTEAM',
    label: 'Tim Tech',
    labelEn: 'Tech Team',
    tagline: 'Website, sistem & dukungan operasional-administrasi gereja',
    icon: '💻',
    color: '#0EA5E9',
    subdivisions: [
      { name: 'Web & Sistem', tagline: 'Website gehc.page, portal & integrasi' },
      { name: 'Operasional & Administrasi', tagline: 'Dukungan operasional & administrasi' },
    ],
    positions: ['Ketua', 'Koordinator'],
  },
  {
    code: 'PANJI',
    label: 'Panji Yosua',
    labelEn: 'Panji Yosua (Security)',
    tagline: 'Keamanan event utama & reguler gereja',
    icon: '🛡️',
    color: '#059669',
    subdivisions: [
      { name: 'Keamanan Event', tagline: 'Pengamanan event utama (ibadah raya, perayaan, dsb.)' },
      { name: 'Penjagaan Rutin', tagline: 'Penjagaan & ketertiban kegiatan rutin' },
    ],
    positions: ['Ketua', 'Koordinator'],
  },
];

export const CHURCH_UNIT_CODES: ChurchUnitCode[] = CHURCH_UNITS.map((u) => u.code);

const BY_CODE = new Map<string, ChurchUnitDef>(CHURCH_UNITS.map((u) => [u.code, u]));

export function isChurchUnitCode(code?: string | null): code is ChurchUnitCode {
  return !!code && BY_CODE.has(String(code).toUpperCase());
}

export function churchUnitByCode(code?: string | null): ChurchUnitDef | null {
  if (!code) return null;
  return BY_CODE.get(String(code).toUpperCase()) || null;
}

export function churchUnitLabel(code?: string | null): string {
  return churchUnitByCode(code)?.label || String(code || '');
}
