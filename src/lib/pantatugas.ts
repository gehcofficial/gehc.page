import { Flame, BookOpen, Heart, HandHeart, Megaphone } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Meta lima fungsi gereja klasik (pantatugas) — payung struktur pelayanan
 * GEHC Youth. Dipakai StrukturSection, PantatugasShowcase, dan portal.
 * Detail keputusan: pandangan terbaru inklusi Benzarpreneurship & penugasan orang.
 * Reference: pantatugas.md
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

// 5 Panca Tugas + 1 Divisi tambahan (Benzarpreneurship)
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
    tagline: 'Memelihara persekutuan & relasi baru',
    color: '#059669',
    icon: Heart,
  },
  {
    name: 'DIAKONIA',
    label: 'Diakonia',
    tagline: 'Melayani kebutuhan praktis',
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
];

// Divisi tambahan di luar 5 panta tugas
export const BENZARPR_ENUM = 'BENZARPR';

export interface SubDivisionMeta {
  name: string;
  label: string;
  tagline: string;
  color: string;
}

/**
 * Dapatkan sub-divisi untuk sebuah pillar.
 */
export function subDivisions(pillarName: string): SubDivisionMeta[] {
  const key = pillarName.toUpperCase();
  return SUB_DIVISIONS[key] || [];
}

/** Pillar metadata per nama */
export function pillarByName(name?: string | null): PillarMeta | undefined {
  if (!name) return undefined;
  return PANTATUGAS.find((p) => p.name === name.toUpperCase().trim());
}

/** Record nama → array sub-divisi meta */
export const SUB_DIVISIONS: Record<string, SubDivisionMeta[]> = {
  LITURGIA: [
    {
      name: 'Liturgi & Musik',
      label: 'Liturgi & Musik',
      tagline: 'Memaksimalkan pemuda dalam pelayanan ibadah, musik, WL, Singers, Kantoria, Rebanda, Banners',
      color: '#7C3AED',
    },
    {
      name: 'Pendoa',
      label: 'Pendoa',
      tagline: 'Doa strategis untuk kebutuhan spiritual acara & jemaat — orang sakit, ulang tahun, doa berjenjang',
      color: '#7C3AED',
    },
    {
      name: 'Intercessor',
      label: 'Intercessor',
      tagline: 'Prayer covering pra-during-pasca untuk seluruh rangkaian kegiatan & misi jemaat',
      color: '#7C3AED',
    },
  ],
  DIDASKALIA: [
    {
      name: 'Kurikulum & Pembekalan',
      label: 'Kurikulum & Pembekalan',
      tagline: 'Penyusunan modul & kurikulum pemuridan + pembekalan mentor-comentor-mentee oleh Main Speaker (Putri Massie & Alvandi Saerang)',
      color: '#0EA5E9',
    },
  ],
  KOINONIA: [
    {
      name: 'Program Persekutuan',
      label: 'Program Persekutuan',
      tagline: 'Kegiatan bersama: games, bonding, ice breaking, konsep acara (olahraga, latihan, dekorasi) + koordinator rundown acara',
      color: '#059669',
    },
    {
      name: 'Public Relations (PR)',
      label: 'Public Relations (PR)',
      tagline: 'Follow-up newcomer & anggota, MC acara, update media sosial, komunikasi internal-eksternal ⭐',
      color: '#059669',
    },
  ],
  DIAKONIA: [
    {
      name: 'Logistik & Akomodasi',
      label: 'Logistik & Akomodasi',
      tagline: 'Fasilitas, tempat, sarana pelayanan',
      color: '#EA580C',
    },
    {
      name: 'Konsumsi',
      label: 'Konsumsi',
      tagline: 'Momen makan bersama tetap dirancang Koinonia',
      color: '#EA580C',
    },
    {
      name: 'Medis & First Aid',
      label: 'Medis & First Aid',
      tagline: 'Penanganan kesehatan & darurat selama acara',
      color: '#EA580C',
    },
  ],
  MARTURIA: [
    {
      name: 'Dokumentasi',
      label: 'Dokumentasi',
      tagline: 'Merekam foto/video, catat kesaksian & progres pelayanan',
      color: '#DC2626',
    },
    {
      name: 'Desain & Publikasi',
      label: 'Desain & Publikasi',
      tagline: 'Produksi visual, branding, publish content ke channel (pendukung PR Koinonia)',
      color: '#DC2626',
    },
    {
      name: 'Penginjilan Praktis',
      label: 'Penginjilan Praktis',
      tagline: 'Pendekatan praktis dalam menyebarkan Injil',
      color: '#DC2626',
    },
  ],
  BENZARPR: [
    {
      name: 'Merchandise',
      label: 'Merchandise',
      tagline: 'Eben Haezer Goods — produksi & penjualan merchandise sebagai identitas & alat kesaksian',
      color: '#F6AE4A',
    },
    {
      name: 'Fundraising',
      label: 'Fundraising',
      tagline: 'Usaha dana: penjualan makan-minum mingguan & penggalangan dana program',
      color: '#F6AE4A',
    },
    {
      name: 'Donation',
      label: 'Donation',
      tagline: 'Pengelolaan persembahan & donasi khusus program pelayanan pemuda',
      color: '#F6AE4A',
    },
  ],
};

export const SUPPORT_DIVISION = 'PENOPANG';