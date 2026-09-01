import { Flame, BookOpen, Heart, HandHeart, Megaphone, Store } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Meta lima fungsi gereja klasik (panca tugas) + Benzarpreneurship — payung struktur pelayanan
 * GEHC Youth. Dipakai StrukturSection, PantatugasShowcase, dan portal.
 * Reference: pantatugas.md · pancatugas-operating-model.md
 */
export interface PillarMeta {
  /** Kode divisi di database (uppercase) */
  name: string;
  /** Label tampil manusiawi */
  label: string;
  tagline: string;
  color: string;
  icon: ComponentType<{ className?: string }>;
}

/** Lima pillar teologis (punya Kepala Divisi) */
export const PANTA_DIVISIONS = [
  'LITURGIA',
  'DIDASKALIA',
  'KOINONIA',
  'DIAKONIA',
  'MARTURIA',
] as const;

export type PantaDivision = (typeof PANTA_DIVISIONS)[number];

export const DIVISION_HEAD_POSITION = 'Kepala Divisi';
export const OPEN_HOD_NAME = 'Kepala Divisi — Rekrutmen Berlangsung';
export const OPEN_COORDINATOR_NAME = 'Koordinator — Posisi Terbuka';

// 6 Divisi: 5 Panca Tugas + Benzarpreneurship
export const PANTATUGAS: PillarMeta[] = [
  {
    name: 'LITURGIA',
    label: 'Liturgia',
    tagline: 'Memuliakan Tuhan dalam ibadah & doa',
    color: '#7C3AED',
    icon: Flame,
  },
  {
    name: 'DIDASKALIA',
    label: 'Didaskalia',
    tagline: 'Mengajar & memperlengkapi lewat firman',
    color: '#0EA5E9',
    icon: BookOpen,
  },
  {
    name: 'KOINONIA',
    label: 'Koinonia',
    tagline: 'Memelihara persekutuan & relasi',
    color: '#059669',
    icon: Heart,
  },
  {
    name: 'DIAKONIA',
    label: 'Diakonia',
    tagline: 'Melayani kebutuhan praktis & kasih peduli',
    color: '#EA580C',
    icon: HandHeart,
  },
  {
    name: 'MARTURIA',
    label: 'Marturia',
    tagline: 'Menjadi saksi & menginjili',
    color: '#DC2626',
    icon: Megaphone,
  },
  {
    name: 'BENZARPR',
    label: 'Benzarpreneurship',
    tagline: 'Usaha & dana: Merchandise · Penggalangan · Persembahan',
    color: '#F6AE4A',
    icon: Store,
  },
];

export const BENZARPR_ENUM = 'BENZARPR';

export interface SubDivisionMeta {
  name: string;
  label: string;
  tagline: string;
  color: string;
}

export function subDivisions(pillarName: string): SubDivisionMeta[] {
  const key = pillarName.toUpperCase();
  return SUB_DIVISIONS[key] || [];
}

export function pillarByName(name?: string | null): PillarMeta | undefined {
  if (!name) return undefined;
  return PANTATUGAS.find((p) => p.name === name.toUpperCase().trim());
}

export function isPantaDivision(name?: string | null): boolean {
  if (!name) return false;
  return PANTA_DIVISIONS.includes(name.toUpperCase().trim() as PantaDivision);
}

/** Record nama → array sub-divisi meta (canonical ID = Bahasa Indonesia) */
export const SUB_DIVISIONS: Record<string, SubDivisionMeta[]> = {
  LITURGIA: [
    {
      name: 'Liturgi & Ibadah',
      label: 'Liturgi & Ibadah',
      tagline: 'Urutan ibadah Word-centered: pembaca firman, liturgist, WL, banners, flow Minggu/acara',
      color: '#7C3AED',
    },
    {
      name: 'Musik & Vokal',
      label: 'Musik & Vokal',
      tagline: 'Band, singers, kantoria, rebanda, rehearsal — musik sebagai respons pujian',
      color: '#7C3AED',
    },
    {
      name: 'Doa & Intercession',
      label: 'Doa & Intercession',
      tagline: 'Doa korporat mingguan, doa pastoral, prayer covering pra–selama–pasca acara',
      color: '#7C3AED',
    },
  ],
  DIDASKALIA: [
    {
      name: 'Kurikulum Pemuridan',
      label: 'Kurikulum Pemuridan',
      tagline: 'Modul Beyonders/SG, tes karunia, worldview & apologetics pemuda, evaluasi batch',
      color: '#0EA5E9',
    },
    {
      name: 'Pembekalan Tim',
      label: 'Pembekalan Tim',
      tagline: 'Pelatihan mentor/comentor, BAKU TAU, main session pembekalan (Lead Equippers: Putri & Alvandi)',
      color: '#0EA5E9',
    },
  ],
  KOINONIA: [
    {
      name: 'Program & Acara',
      label: 'Program & Acara',
      tagline: 'Konsep, rundown, games/bonding, dekorasi acara',
      color: '#059669',
    },
    {
      name: 'Persekutuan & Integrasi',
      label: 'Persekutuan & Integrasi',
      tagline: 'Welcome newcomer, hospitality, care ringan antar anggota (bukan klinis)',
      color: '#059669',
    },
    {
      name: 'Hubungan & Komunikasi',
      label: 'Hubungan & Komunikasi',
      tagline: 'MC, sosmed, broadcast internal, FAQ acara, input newcomer → Jethro ⭐',
      color: '#059669',
    },
  ],
  DIAKONIA: [
    {
      name: 'Logistik & Fasilitas',
      label: 'Logistik & Fasilitas',
      tagline: 'Venue, peralatan, transport, layout',
      color: '#EA580C',
    },
    {
      name: 'Konsumsi & Keramahan',
      label: 'Konsumsi & Keramahan',
      tagline: 'Menu, vendor/self-made, distribusi — momen makan tetap dirancang Koinonia',
      color: '#EA580C',
    },
    {
      name: 'Kesehatan & Keselamatan',
      label: 'Kesehatan & Keselamatan',
      tagline: 'First aid, protokol darurat, obat',
      color: '#EA580C',
    },
    {
      name: 'Kasih Peduli & Benevolence',
      label: 'Kasih Peduli & Benevolence',
      tagline: 'Bantuan praktis member susah, kunjungan sakit, koordinasi dengan mentor/Komisi',
      color: '#EA580C',
    },
    {
      name: 'Dukungan Perantau',
      label: 'Dukungan Perantau',
      tagline: 'Adaptasi hidup Cikarang, burnout kerja, komunitas praktis perantau',
      color: '#EA580C',
    },
  ],
  MARTURIA: [
    {
      name: 'Dokumentasi Visual',
      label: 'Dokumentasi Visual',
      tagline: 'Foto/video acara, arsip Drive [EVENT:slug]',
      color: '#DC2626',
    },
    {
      name: 'Desain & Publikasi',
      label: 'Desain & Publikasi',
      tagline: 'Poster, deck, brand asset; handoff ke Hubungan & Komunikasi untuk posting',
      color: '#DC2626',
    },
    {
      name: 'Kesaksian & Story',
      label: 'Kesaksian & Story',
      tagline: 'Kurasi testimoni mentee, wall of testimony (approve Komisi), narrative witness',
      color: '#DC2626',
    },
    {
      name: 'Penginjilan & Misi',
      label: 'Penginjilan & Misi',
      tagline: 'Outreach rutin, pre-evangelism, mission trip, invite-a-friend',
      color: '#DC2626',
    },
  ],
  BENZARPR: [
    {
      name: 'Merchandise & Produk',
      label: 'Merchandise & Produk',
      tagline: 'Katalog, stok, fulfillment toko portal — Eben Haezer Goods',
      color: '#F6AE4A',
    },
    {
      name: 'Penggalangan Dana',
      label: 'Penggalangan Dana',
      tagline: 'Jual makan-minum mingguan & penggalangan dana program',
      color: '#F6AE4A',
    },
    {
      name: 'Persembahan & Donasi',
      label: 'Persembahan & Donasi',
      tagline: 'QRIS, donasi khusus, rekonsiliasi ke Bendahara Tim Kerja',
      color: '#F6AE4A',
    },
  ],
};

/** Migrasi nama sub-divisi lama → canonical (full rename DB/Drive) */
export const SUBDIVISION_MIGRATION: Record<string, Record<string, string>> = {
  LITURGIA: {
    'Liturgi & Musik': 'Musik & Vokal',
    Pendoa: 'Doa & Intercession',
    Intercessor: 'Doa & Intercession',
  },
  DIDASKALIA: {
    'Kurikulum & Pembekalan': 'Kurikulum Pemuridan',
  },
  KOINONIA: {
    'Program Persekutuan': 'Program & Acara',
    'Public Relations (PR)': 'Hubungan & Komunikasi',
  },
  DIAKONIA: {
    'Logistik & Akomodasi': 'Logistik & Fasilitas',
    Konsumsi: 'Konsumsi & Keramahan',
    'Medis & First Aid': 'Kesehatan & Keselamatan',
  },
  MARTURIA: {
    Dokumentasi: 'Dokumentasi Visual',
    'Penginjilan Praktis': 'Penginjilan & Misi',
  },
  BENZARPR: {
    Merchandise: 'Merchandise & Produk',
    Fundraising: 'Penggalangan Dana',
    Donation: 'Persembahan & Donasi',
  },
};

export const SUPPORT_DIVISION = 'PENOPANG';
