/**
 * Katalog slot visual publik — nama file tetap (replace-in-place di Drive).
 * Dipakai drive-provision, drive-seed-visuals, dan GET /api/media/slots.
 */

export const WEBSITE_VISUAL_FOLDER = 'Website Visual [PUBLIK]';
export const WARTA_PUBLIK_FOLDER = 'Warta Publik [PUBLIK]';

export const WEBSITE_VISUAL_SUBFOLDERS = [
  'brand',
  'landing',
  'warta',
  'kegiatan',
  'benzarpreneurship',
  'kelompok',
  'pengurus',
  'testimoni',
  'users',
];

export const TEN_HOMES = [
  'Agape',
  'Avodah',
  'Dunamis',
  'Echad',
  'Hesed',
  'Kairos',
  'Logos',
  'Metanoia',
  'Ruach',
  'Shalom',
];

const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

/** Foto Unsplash yang sama dengan fallback website (src/config/media.ts). */
export const SLOT_SOURCE_URLS = {
  'landing.heroBanner': U('1511671782779-c97d3d27a1d4', 2000),
  'landing.collageWorship': U('1529070538774-1843cb3265df', 1000),
  'landing.collageCommunity': U('1516450360452-9312f5e86fc7', 1000),
  'landing.collageMusic': U('1465847899084-d164df4dedc6', 1000),
  'landing.collageStudy': U('1543269865-cbf427effbad', 1000),
  'landing.collageFriends': U('1517486808906-6ca8b3f04846', 1000),
  'landing.collagePortrait': U('1494790108377-be9c29b29330', 800),
  'warta.bannerDefault': U('1511671782779-c97d3d27a1d4', 1200),
  'kegiatan.bannerDefault': U('1514525253161-7a46d19cd819', 1200),
  'kegiatan.bakuTau': U('1523580494863-6f3031224c94', 1200),
  'benzar.hero': U('1556742049-0cfed4f6a45d', 1600),
  'benzar.productPlaceholder': U('1523275335684-37898b6baf30', 800),
  'pengurus.contoh': U('1494790108377-be9c29b29330', 800),
  'testimoni.contoh': U('1494790108377-be9c29b29330', 800),
};

const HOUSE_COVER_IDS = [
  '1529156069898-49953e39b3ac',
  '1514525253161-7a46d19cd819',
  '1506905925346-21bda4d32df4',
  '1574629810360-7efbbe195018',
  '1469571486292-0ba58a3f068b',
  '1543087903-1ac2ec7aa8c5',
  '1511671782779-c97d3d27a1d4',
  '1507692049790-de58290a4334',
  '1517486808906-6ca8b3f04846',
  '1543269865-cbf427effbad',
];

TEN_HOMES.forEach((name, i) => {
  SLOT_SOURCE_URLS[`kelompok.${name.toLowerCase()}`] = U(HOUSE_COVER_IDS[i], 1200);
});

/** @typedef {{ folder: string, stem: string, ext: string, key: string, usedAt: string, seed?: boolean }} VisualSlot */

/** @type {VisualSlot[]} */
export const VISUAL_SLOTS = [
  {
    folder: 'brand',
    stem: 'logo-gehc',
    ext: 'png',
    key: 'brand.logoGehc',
    usedAt: 'Logo GEHC — Navbar, Footer, PortalLogin, PortalLayout',
  },
  { folder: 'landing', stem: '01-hero-banner', ext: 'png', key: 'landing.heroBanner', usedAt: 'Hero Beyonders — HeroSection' },
  { folder: 'landing', stem: '02-collage-worship', ext: 'png', key: 'landing.collageWorship', usedAt: 'VisualCollage kiri atas — ibadah' },
  { folder: 'landing', stem: '03-collage-community', ext: 'png', key: 'landing.collageCommunity', usedAt: 'VisualCollage kanan atas — komunitas' },
  { folder: 'landing', stem: '04-collage-music', ext: 'png', key: 'landing.collageMusic', usedAt: 'VisualCollage tengah kanan — musik' },
  { folder: 'landing', stem: '05-collage-study', ext: 'png', key: 'landing.collageStudy', usedAt: 'VisualCollage kiri bawah — firman' },
  { folder: 'landing', stem: '06-collage-friends', ext: 'png', key: 'landing.collageFriends', usedAt: 'VisualCollage kanan bawah — kelompok' },
  { folder: 'landing', stem: '07-collage-portrait', ext: 'png', key: 'landing.collagePortrait', usedAt: 'Fallback foto testimoni di VisualCollage' },
  {
    folder: 'landing',
    stem: '08-hero-video',
    ext: 'mp4',
    key: 'landing.heroVideo',
    usedAt: 'Opsional: video Hero (jika ada, mengganti gambar hero)',
    seed: false,
  },
  { folder: 'warta', stem: '01-banner-default', ext: 'png', key: 'warta.bannerDefault', usedAt: 'Banner warta jika edisi tidak punya PNG' },
  { folder: 'kegiatan', stem: '01-banner-default', ext: 'png', key: 'kegiatan.bannerDefault', usedAt: 'Banner kegiatan default — EventsTimeline' },
  { folder: 'kegiatan', stem: 'baku-tau-4', ext: 'png', key: 'kegiatan.bakuTau', usedAt: 'Kartu unggulan BAKU TAU 4.0' },
  { folder: 'benzarpreneurship', stem: '01-hero', ext: 'png', key: 'benzar.hero', usedAt: 'Header halaman Benzarpreneurship' },
  { folder: 'benzarpreneurship', stem: '02-product-placeholder', ext: 'png', key: 'benzar.productPlaceholder', usedAt: 'Produk tanpa foto' },
  { folder: 'benzarpreneurship', stem: '03-qris', ext: 'png', key: 'benzar.qris', usedAt: 'QRIS checkout Benzarpreneurship' },
  ...TEN_HOMES.map((name) => ({
    folder: 'kelompok',
    stem: `cover-${name.toLowerCase()}`,
    ext: 'png',
    key: `kelompok.${name.toLowerCase()}`,
    usedAt: `Cover rumah ${name} — GroupsCarousel`,
  })),
  {
    folder: 'pengurus',
    stem: 'contoh-pengurus',
    ext: 'png',
    key: 'pengurus.contoh',
    usedAt: 'Contoh: ganti nama file menjadi slug orang (cth. stevania-hadinda.png)',
  },
  {
    folder: 'testimoni',
    stem: 'contoh-penulis',
    ext: 'png',
    key: 'testimoni.contoh',
    usedAt: 'Contoh: ganti nama file menjadi slug penulis testimoni',
  },
];

export function fileNameOf(slot) {
  return `${slot.stem}.${slot.ext}`;
}

export function stemOfFileName(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase();
}

export function matchStem(fileName, stem) {
  return stemOfFileName(fileName) === String(stem || '').toLowerCase();
}

export function slugifyName(name) {
  return String(name || '')
    .replace(/^(pdt|pnt|dkn|ptr)\.?\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildPetaVisualText() {
  const rows = VISUAL_SLOTS.map((s) => {
    const note = s.seed === false ? '  [jangan di-seed — unggah sendiri bila perlu]' : '';
    return `${s.folder}/${fileNameOf(s).padEnd(36)}  →  ${s.usedAt}${note}`;
  });
  return `GEHC Youth — Peta Visual Website
================================
Timpa file dengan STEM NAMA YANG SAMA (ekstensi .jpg / .png / .webp boleh).
Website memakai lookup by filename stem, bukan urutan folder.
Foto/video real: replace in place (hapus placeholder, unggah file baru bernama identik).

Folder ini: ${WEBSITE_VISUAL_FOLDER}

Unggah ke Google One memakai akun pemilik Drive (npm run drive:auth),
bukan service account (SA tidak punya kuota My Drive).

-- Slot tetap --
${rows.join('\n')}

-- Warta edisi (pengganti Galeri publik) --
${WARTA_PUBLIK_FOLDER}/YYYY-MM-DD-judul-singkat/foto/*
  →  Foto & video edisi di detail halaman Warta (#/bulletin)

-- Pengurus, testimoni, foto profil --
pengurus/{slug-nama}.png     →  foto pengurus tanpa akun portal
testimoni/{slug-penulis}.png →  foto penulis testimoni tanpa akun
users/{userId}.jpg           →  foto profil kustom (ganti dari portal)

Slug = nama tanpa gelar, huruf kecil, spasi jadi tanda hubung.
Contoh: "Pnt Stevania Hadinda" → stevania-hadinda.png
Foto profil akun: stem = user id (replace in place).

Jangan ubah nama folder. Jangan taruh file slot di luar subfolder yang tertera.
`;
}

export function websiteVisualFolderSpec() {
  return [
    { name: WEBSITE_VISUAL_FOLDER, parent: 'ROOT', key: 'WEBSITE_VISUAL' },
    ...WEBSITE_VISUAL_SUBFOLDERS.map((name) => ({
      name,
      parent: 'WEBSITE_VISUAL',
      key: `visual:${name}`,
    })),
  ];
}
