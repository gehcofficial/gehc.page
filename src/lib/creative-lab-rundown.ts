/**
 * Salinan klien dari server/lib/creative-lab-rundown.mjs.
 * Dipakai bila respons API masih membawa fase katalog lama.
 */

export const CREATIVE_LAB_SUMMARY =
  'Serving Day berbasis karya: Praise & Worship 10′, Firman & Briefing 15′, Sesi 1 · Reminder Jar 15′, Sesi 2 · Art Stations 25′ (20′ melukis paralel + 5′ unggah), Presentasi Kelompok 30′, Konklusi 10′, Persembahan & Doa 10′, Lagu & Doa Penutup 5′, lalu pasca Monolog: Terima Kasih & Pengumuman 5′, HUT & Doa 5′, Foto Bersama 5′, Acara Bebas & Pulang 5′.';

export type LabPhase = {
  no?: number | null;
  title?: string | null;
  minutes?: number | null;
  owner?: string | null;
  division?: string | null;
  notes?: string | null;
  anchor?: string | null;
  parallelGroup?: string | null;
  track?: string | null;
  segments?: Array<{ key?: string; label?: string; kind?: string; songs?: number; auto?: boolean }> | null;
};

const STRONG_MARKERS = [
  'preaching & briefing',
  'preaching and briefing',
  'the roots reminder jar',
  'roots reminder jar',
  'pot painting',
  'bag painting',
  'presentasi hasil',
  'activity 1',
  'activity 2',
  'pilih 2 pertanyaan',
  'persiapan ruang & stasiun',
  'persiapan ruang dan stasiun',
  'lagu + doa tutup',
  'persembahan + doa',
];

function normTitle(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalCreativeLabPhases(): LabPhase[] {
  return [
    {
      no: 1, title: 'Persiapan Ruang & Perlengkapan', minutes: 20, owner: 'Diakonia', division: 'DIAKONIA',
      anchor: 'PRA', parallelGroup: 'pra',
      notes: 'Layout meja per kelompok (5-8 orang), jar/toples, kertas 6/orang, media dua stasiun, cat, kuas, koran/celemek, area jemur. Bahan aktivitas dibagikan ke mentor dan co-mentor saat kedatangan, bukan di tengah sesi. Jam jemaat (T0) mulai setelah blok PRA selesai.',
    },
    {
      no: null, title: 'Doa Petugas', minutes: 10, owner: 'Komisi/Tim Kerja, Tuan Rumah', division: 'KOINONIA',
      anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
      notes: 'Doa, pembagian stasiun, briefing perwakilan kelompok dan MC (paralel). Tak tambah total.',
    },
    {
      no: null, title: 'Registrasi Ulang', minutes: 10, owner: 'Tuan Rumah, Penerima Tamu, Absensi', division: 'KOINONIA',
      anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
      notes: 'QR check-in ulang; peserta langsung diarahkan ke kelompoknya (paralel). Bahan aktivitas sudah diterima mentor/co-mentor saat kedatangan. Tak tambah total.',
    },
    {
      no: null, title: 'Cek Slide & Sound', minutes: 10, owner: 'Multimedia, Tata Suara', division: 'MARTURIA',
      anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
      notes: 'Slide contoh karya, timer layar, sound, kode sesi proyektor (paralel). Tak tambah total.',
    },
    {
      no: 1, title: 'Praise & Worship', minutes: 10, owner: 'Pemimpin Pujian, Liturgi, Multimedia', division: 'LITURGIA',
      anchor: 'ACARA',
      notes: '1 lagu buka + doa + praise/worship. Peserta sudah duduk per kelompok sejak awal. T0–T+10.',
      segments: [{ key: 'praise', label: 'Praise', kind: 'song', songs: 2 }],
    },
    {
      no: 2, title: 'Firman & Briefing', minutes: 15, owner: 'Pembicara Firman, MC', division: 'DIDASKALIA',
      anchor: 'ACARA',
      notes: 'Layar judul tema sampai Briefing dimulai; lalu instruksi maju ke depan + slot urutan (nomor grup). Undian dari kontrol. Nama perwakilan hanya di Sesi 2, bukan Briefing/Presentasi. T+10–T+25.',
      segments: [{ key: 'firman', label: 'Firman', kind: 'firman', auto: true }],
    },
    {
      no: 3, title: 'Sesi 1 · Reminder Jar', minutes: 15, owner: 'Didaskalia, Mentor, Co-mentor', division: 'DIDASKALIA',
      anchor: 'ACARA',
      notes: 'Bahan sudah ada di meja sejak kedatangan. Tiap orang menulis 6 kartu; lipat dan masukkan jar kelompok. Web: pilih 2 dari 6 (paralel). Subjudul tema di draft. Pemicu kontrol: A1 15 menit. T+25–T+40.',
    },
    {
      no: 4, title: 'Sesi 2 · Art Stations', minutes: 25, owner: 'Didaskalia, Mentor, Diakonia', division: 'DIDASKALIA',
      anchor: 'ACARA',
      notes: '20 menit melukis Stasiun A ∥ Stasiun B (paralel), lalu 5 menit unggah foto dan makna. Bahan tidak dibagikan di tengah sesi. Nama media dan judul tema di draft. Pemicu kontrol: A2 25 menit. T+40–T+65.',
    },
    {
      no: 5, title: 'Presentasi Kelompok', minutes: 30, owner: 'MC, Didaskalia', division: 'DIDASKALIA',
      anchor: 'ACARA',
      notes: '10 kelompok × sekitar 2,5 menit termasuk transisi. Tiga slide: Pot, Bag, Commitment. Timer default 150 detik. T+65–T+95.',
    },
    {
      no: 6, title: 'Konklusi', minutes: 10, owner: 'Pembicara Firman, Mentor', division: 'DIDASKALIA',
      anchor: 'ACARA',
      notes: 'Konklusi firman + chip Satu Kata + komitmen kelompok. Pemicu kontrol: DONE → refleksi/WRAPUP. T+95–T+105.',
    },
    {
      no: 7, title: 'Persembahan & Doa', minutes: 10, owner: 'Pembicara Firman, Doa Syafaat, Pengumpul Persembahan', division: 'LITURGIA',
      anchor: 'ACARA',
      notes: 'Kantong jalan + doa persembahan dan syafaat (mode HEMAT 10 menit). T+105–T+115.',
      segments: [{ key: 'persembahan', label: 'Persembahan', kind: 'song', songs: 1 }],
    },
    {
      no: 8, title: 'Lagu & Doa Penutup', minutes: 5, owner: 'Liturgia, Pendoa', division: 'LITURGIA',
      anchor: 'ACARA',
      notes: '1 lagu + doa tutup + berkat. Unduh rekap dan bawa jar pulang. T+115–T+120.',
    },
    {
      no: 9, title: 'Terima Kasih & Pengumuman', minutes: 5, owner: 'Tuan Rumah, MC, Komisi/Tim Kerja', division: 'KOINONIA',
      anchor: 'ACARA',
      notes: 'Apresiasi tuan rumah + info komisi; konsumsi dan ramah-tamah jalan paralel. T+120–T+125.',
    },
    {
      no: 10, title: 'HUT & Doa', minutes: 5, owner: 'MC, yang HUT', division: 'KOINONIA',
      anchor: 'ACARA',
      notes: 'Rayakan dan doakan yang berulang tahun. T+125–T+130.',
    },
    {
      no: 11, title: 'Foto Bersama', minutes: 5, owner: 'Fotografer, Videografer', division: 'MARTURIA',
      anchor: 'ACARA',
      notes: 'Foto session + dokumentasi. T+130–T+135.',
    },
    {
      no: 12, title: 'Acara Bebas & Pulang', minutes: 5, owner: 'Tuan Rumah', division: 'KOINONIA',
      anchor: 'PASCA',
      notes: 'Ramah-tamah paralel mengikuti blok terima kasih, tidak dihitung ganda. T+135–T+140.',
    },
  ];
}

/** Nama perwakilan dan pencatat di layar proyektor hanya saat Sesi 2 (fase A2). */
export function labDisplayShowsRepNames(phase?: string | null): boolean {
  return String(phase || '') === 'A2';
}

export function legacyCreativeLabHits(phases: LabPhase[] | null | undefined): number {
  const list = Array.isArray(phases) ? phases : [];
  let hits = 0;
  for (const phase of list) {
    const title = normTitle(phase?.title);
    if (title && STRONG_MARKERS.some((marker) => title.includes(marker))) hits += 1;
  }
  return hits;
}

export function normalizeCreativeLabPhases<T extends LabPhase>(phases: T[] | null | undefined, patternCode?: string | null): T[] {
  const list = Array.isArray(phases) ? phases : [];
  const code = String(patternCode || '').toUpperCase();
  if (code && code !== 'CREATIVE_LAB') return list;
  const hits = legacyCreativeLabHits(list);
  const legacy = code === 'CREATIVE_LAB' ? hits >= 1 : hits >= 2;
  if (!legacy) return list;
  return canonicalCreativeLabPhases() as T[];
}
