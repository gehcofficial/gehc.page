import type { PortalId } from './portal-profiles';

export type UnitPortalModule = {
  id: string;
  title: string;
  description: string;
  tab: string;
  roles?: string[];
};

const SHARED: UnitPortalModule[] = [
  { id: 'pengurus', title: 'Pengurus Unit', description: 'Susunan ketua, sekretaris, bendahara, dan seksi.', tab: 'unit-pengurus' },
  { id: 'members', title: 'Anggota Unit', description: 'Daftar anggota unit (BIPRA/Kolom), pencarian & kontak pengurus.', tab: 'unit-members' },
  { id: 'events', title: 'Program & Event', description: 'Workspace kegiatan ter-scope unit + jemaat.', tab: 'events' },
  { id: 'agenda', title: 'Agenda Kegiatan', description: 'Kelola agenda publik unit.', tab: 'content-activities' },
  { id: 'warta', title: 'Info & Peluang', description: 'Warta internal & pengumuman unit.', tab: 'internal-warta' },
  { id: 'announce', title: 'Pengumuman Push', description: 'Notifikasi ke peran/divisi/kelompok.', tab: 'announcements' },
];

const BY_PORTAL: Partial<Record<PortalId, UnitPortalModule[]>> = {
  jemaat: [
    { id: 'bpmj-dash', title: 'Dasbor BPMJ', description: 'Ringkasan lintas unit, keuangan & keanggotaan.', tab: 'church-dashboard', roles: ['SUPERADMIN', 'BPMJ'] },
    { id: 'kolom', title: 'Kolom & Wilayah', description: 'Kolom teritorial dan anggota per kolom.', tab: 'kolom' },
    { id: 'org', title: 'Unit & Struktur Jemaat', description: 'Departemen jemaat & hirarki organisasi.', tab: 'church-org' },
    ...SHARED,
  ],
  kolom: [
    { id: 'kolom', title: 'Kolom & Wilayah', description: 'Kelola kolom, area, dan anggota teritorial.', tab: 'kolom' },
    ...SHARED,
  ],
  men: [
    { id: 'koinonia', title: 'Koinonia P/KB', description: 'Persekutuan kaum bapa — kelompok & wilayah (MVP: anggota unit).', tab: 'unit-members' },
    ...SHARED,
  ],
  women: [
    { id: 'koinonia', title: 'Koinonia W/KI', description: 'Persekutuan kaum ibu — kelompok & wilayah (MVP: anggota unit).', tab: 'unit-members' },
    ...SHARED,
  ],
  teen: [
    { id: 'groups', title: 'Kelompok Remaja', description: 'Anggota & pengurus remaja (MVP: direktori unit).', tab: 'unit-members' },
    { id: 'curriculum', title: 'Kurikulum & Tema', description: 'Rencana pembinaan — menyusul; sementara via Program & Event.', tab: 'events' },
    ...SHARED,
  ],
  kids: [
    { id: 'classes', title: 'Kelas Sekolah Minggu', description: 'Anggota per usia (MVP: direktori unit).', tab: 'unit-members' },
    { id: 'curriculum', title: 'Kurikulum SM', description: 'Tema pekanan — menyusul; sementara via Program & Event.', tab: 'events' },
    ...SHARED,
  ],
  community: [
    { id: 'interest', title: 'Grup Minat', description: 'Musik, olahraga, seni (MVP: anggota & kegiatan).', tab: 'unit-members' },
    { id: 'practice', title: 'Jadwal Latihan', description: 'Sesi latihan — pakai Program & Event + booking fasilitas.', tab: 'events' },
    ...SHARED,
  ],
};

export function unitPortalModules(portalId: PortalId): UnitPortalModule[] {
  const list = BY_PORTAL[portalId];
  if (list) return list;
  return SHARED;
}

export function unitPortalTagline(portalId: PortalId): string {
  switch (portalId) {
    case 'jemaat':
      return 'Portal payung BPMJ — struktur jemaat, kolom, dan modul lintas unit.';
    case 'kolom':
      return 'Penggembalaan teritorial per Kolom (campur BIPRA).';
    case 'men':
      return 'Persekutuan dan pelayanan Kaum Bapa.';
    case 'women':
      return 'Persekutuan dan pelayanan Kaum Ibu.';
    case 'teen':
      return 'Pembinaan remaja SMP–SMA.';
    case 'kids':
      return 'Sekolah Minggu dan pelayanan anak.';
    case 'community':
      return 'Komunitas minat, bakat, dan rekreasi.';
    default:
      return 'Modul unit ter-scope tenant.';
  }
}
