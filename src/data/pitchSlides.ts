/**
 * Isi presentasi GEHC.page (pitch deck).
 * Disunting manual di sini — bebas diubah tanpa menyentuh komponen.
 * Bahasa dijaga tetap ramah awam (hindari istilah teknis).
 */

export type PitchSlideKind = 'cover' | 'section' | 'list' | 'roadmap' | 'closing' | 'demo' | 'qr';

export type PitchRoadmapItem = {
  label: string;
  status: 'live' | 'soon';
  note?: string;
};

export type PitchDemoStep = {
  icon: 'daftar' | 'install' | 'notif';
  title: string;
  caption: string;
  media: string;
  /** Detik awal untuk melewati idle awal rekaman (default 0.4). */
  startAt?: number;
  /** Detik akhir opsional sebelum loop kembali ke startAt. */
  endAt?: number;
};

export type PitchQrItem = {
  label: string;
  url: string;
  image: string;
};

export type PitchSlide = {
  id: string;
  kind: PitchSlideKind;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  roadmap?: PitchRoadmapItem[];
  demo?: { steps: PitchDemoStep[] };
  qr?: PitchQrItem[];
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
      'Jemaat kita tersebar di banyak kegiatan dan wilayah.',
      'Info penting sering terselip di banyak grup WhatsApp.',
      'Setiap pelayanan butuh ruang sendiri, tetap satu gereja.',
      'Satu tempat untuk semua: agenda, warta, dan data jemaat.',
    ],
  },
  {
    id: 'what',
    kind: 'list',
    eyebrow: 'Apa ini',
    title: 'Apa itu GEHC.page?',
    bullets: [
      'Satu situs resmi gereja: profil, lokasi, kontak, dan jadwal ibadah.',
      'Setiap pelayanan punya halaman dan portalnya sendiri.',
      'Bisa dipasang di HP seperti aplikasi — tanpa unduh di App Store.',
      'Semua terhubung dalam satu ekosistem.',
    ],
  },
  {
    id: 'live',
    kind: 'list',
    eyebrow: 'Sudah berjalan',
    title: 'Portal Pemuda (youth.gehc.page)',
    bullets: [
      'Komunitas Beyonders & 10 rumah pemuridan.',
      'Warta, kalender, dan agenda kegiatan.',
      'Daftar event + QR check-in hari H.',
      'Pengingat agenda & info terbaru lewat notifikasi.',
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
    id: 'cara-mulai',
    kind: 'demo',
    eyebrow: 'Cara mulai',
    title: 'Tiga langkah, langsung terhubung',
    subtitle: 'Daftar → pasang di HP → aktifkan notifikasi.',
    demo: {
      steps: [
        {
          icon: 'daftar',
          title: 'Daftar',
          caption: 'Buka youth.gehc.page → Daftar → isi nama, email, dan kata sandi.',
          media: '/media/demo/01-daftar.webm',
          startAt: 0.3,
        },
        {
          icon: 'install',
          title: 'Pasang di HP',
          caption: 'Ketuk Pasang / Bagikan → Tambah ke Layar Utama. Buka seperti aplikasi biasa.',
          media: '/media/demo/02-pasang.webm',
          startAt: 0.3,
        },
        {
          icon: 'notif',
          title: 'Aktifkan notifikasi',
          caption: 'Dapatkan pengingat agenda dan informasi terbaru langsung di HP.',
          media: '/media/demo/03-notifikasi.webm',
          startAt: 0.3,
        },
      ],
    },
  },
  {
    id: 'akses',
    kind: 'qr',
    eyebrow: 'Akses',
    title: 'Scan untuk mulai',
    subtitle: 'Arahkan kamera HP ke kode — langsung masuk ke halaman yang dituju.',
    qr: [
      { label: 'Daftar Portal Pemuda', url: 'youth.gehc.page', image: '/media/qr-daftar-youth.png' },
      { label: 'Situs Hub Gereja', url: 'gehc.page', image: '/media/qr-hub.png' },
    ],
  },
  {
    id: 'tech',
    kind: 'section',
    eyebrow: 'Kenapa aman & mudah',
    title: 'Gratis, aman, dan sederhana',
    bullets: [
      'Gratis — cukup buka lewat browser HP.',
      'Masuk dengan akun Google, tanpa ribet.',
      'Data jemaat hanya diakses pengurus sesuai peran.',
      'Bertumbuh bertahap tanpa membangun ulang.',
    ],
  },
  {
    id: 'future',
    kind: 'list',
    eyebrow: 'Masa depan',
    title: 'Yang akan datang',
    bullets: [
      'Pengingat agenda lewat notifikasi & WhatsApp.',
      'Galeri dan dokumentasi pelayanan.',
      'Semua pelayanan hadir di satu rumah digital.',
    ],
  },
  {
    id: 'closing',
    kind: 'closing',
    eyebrow: 'Mari bertumbuh bersama',
    title: 'Beyond the Sunday Walk',
    subtitle: 'Daftar sekarang di youth.gehc.page',
  },
];
