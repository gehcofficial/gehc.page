/**
 * Katalog unit pelayanan jemaat (server) — cermin dari src/lib/church-org.ts.
 * Dipakai endpoint & seed (StrukturMember.division + .position).
 */

export const CHURCH_UNITS = [
  {
    code: 'PEMBANGUNAN',
    label: 'Departemen Pembangunan',
    labelEn: 'Building & Development',
    tagline: 'Penyewaan, pemeliharaan & fasilitas bangunan gereja',
    icon: '🏗️',
    subdivisions: ['Fasilitas & Penyewaan', 'Pemeliharaan'],
    positions: ['Ketua', 'Bendahara', 'Kostor', 'Asisten Kostor'],
  },
  {
    code: 'THL',
    label: 'Tim Harmoni Liturgi',
    labelEn: 'Harmony of Liturgy Team',
    tagline: 'Penatalayanan jemaat (Stewardship) + Multimedia, Dokumentasi & Sound (MDS)',
    icon: '🎼',
    subdivisions: ['Stewardship', 'MDS'],
    positions: ['Ketua', 'Koordinator Stewardship', 'Koordinator MDS'],
  },
  {
    code: 'TECHTEAM',
    label: 'Tim Tech',
    labelEn: 'Tech Team',
    tagline: 'Website, sistem & dukungan operasional-administrasi gereja',
    icon: '💻',
    subdivisions: ['Web & Sistem', 'Operasional & Administrasi'],
    positions: ['Ketua', 'Koordinator'],
  },
  {
    code: 'PANJI',
    label: 'Panji Yosua',
    labelEn: 'Panji Yosua (Security)',
    tagline: 'Keamanan event utama & reguler gereja',
    icon: '🛡️',
    subdivisions: ['Keamanan Event', 'Penjagaan Rutin'],
    positions: ['Ketua', 'Koordinator'],
  },
];

export const CHURCH_UNIT_CODES = CHURCH_UNITS.map((u) => u.code);

export function churchUnitByCode(code) {
  return CHURCH_UNITS.find((u) => u.code === String(code || '').toUpperCase()) || null;
}
