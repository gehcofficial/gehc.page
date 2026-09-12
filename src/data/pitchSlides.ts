/**
 * Isi presentasi GEHC.page (pitch deck).
 * Disunting manual di sini — bebas diubah tanpa menyentuh komponen.
 */

export type PitchSlideKind = 'cover' | 'section' | 'list' | 'roadmap' | 'closing';

export type PitchRoadmapItem = {
  label: string;
  status: 'live' | 'soon';
  note?: string;
};

export type PitchSlide = {
  id: string;
  kind: PitchSlideKind;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  roadmap?: PitchRoadmapItem[];
};

export const PITCH_SLIDES: PitchSlide[] = [
  {
    id: 'cover',
    kind: 'cover',
    eyebrow: 'GMIM Eben Haezer Cikarang',
    title: 'GEHC.page',
    subtitle: 'Rumah digital jemaat — satu gereja, banyak pelayanan.',
  },
  {
    id: 'why',
    kind: 'section',
    eyebrow: 'Mengapa',
    title: 'Jemaat butuh satu rumah digital',
    bullets: [
      'Jemaat tersebar di banyak aktivitas dan wilayah.',
      'Informasi gereja tersebar di banyak kanal (WA, IG, broadcast).',
      'Setiap kategorial butuh ruang sendiri, tanpa kehilangan identitas gereja.',
      'Satu tempat untuk pelayanan, agenda, dan administrasi.',
    ],
  },
  {
    id: 'what',
    kind: 'list',
    eyebrow: 'Apa ini',
    title: 'Apa itu GEHC.page?',
    bullets: [
      'Laman hub resmi gereja: profil, lokasi, kontak, dan jadwal ibadah.',
      'Direktori pelayanan: Anak, Pra Remaja, Pemuda, P/KB, W/KI, dan Kolom.',
      'Tiap unit punya portalnya sendiri di subdomainnya.',
      'Satu basis data, satu ekosistem — bukan situs terpisah-pisah.',
    ],
  },
  {
    id: 'live',
    kind: 'list',
    eyebrow: 'Sudah berjalan',
    title: 'Portal Pemuda (youth.gehc.page)',
    bullets: [
      'Komunitas Beyonders & 10 rumah pemuridan.',
      'Warta mingguan, kalender, dan agenda kegiatan.',
      'Pendaftaran event + QR check-in hari H.',
      'Administrasi: data jemaat, monitoring, dan integrasi Google Drive.',
      'Akses berjenjang 8 peran (BPMJ, Komisi, Tim Kerja, Mentor, dll.).',
    ],
  },
  {
    id: 'units',
    kind: 'roadmap',
    eyebrow: 'Direktori',
    title: 'Pelayanan di GEHC',
    roadmap: [
      { label: 'Pemuda', status: 'live', note: 'Portal aktif' },
      { label: 'Pra Remaja', status: 'soon' },
      { label: 'Anak', status: 'soon' },
      { label: 'Pria / Kaum Bapa', status: 'soon' },
      { label: 'Wanita / Kaum Ibu', status: 'soon' },
      { label: 'Wilayah & Kolom', status: 'soon' },
      { label: 'Komunitas & Rekreasional', status: 'soon' },
    ],
  },
  {
    id: 'tech',
    kind: 'section',
    eyebrow: 'Teknologi',
    title: 'Sederhana, aman, dan terpusat',
    bullets: [
      'Satu aplikasi, satu basis data untuk seluruh unit.',
      'Login Google + sesi aman; hak akses sesuai peran.',
      'Media dan dokumen di Google Drive (siap Google Workspace).',
      'Dapat dikembangkan bertahap tanpa membangun ulang.',
    ],
  },
  {
    id: 'future',
    kind: 'list',
    eyebrow: 'Masa depan',
    title: 'Yang akan datang',
    bullets: [
      'Login terpadu lintas unit dari hub gereja.',
      'Konten gereja: warta, kalender gerejawi, dan pengumuman.',
      'Peta, kontak, dan sosial media resmi di satu tempat.',
      'Galeri jemaat dan dokumentasi pelayanan.',
      'Notifikasi dan pengingat lewat WhatsApp/email.',
    ],
  },
  {
    id: 'closing',
    kind: 'closing',
    eyebrow: 'Mari bertumbuh bersama',
    title: 'Beyond the Sunday Walk',
    subtitle: 'Kunjungi gehc.page · Portal Pemuda di youth.gehc.page',
  },
];
