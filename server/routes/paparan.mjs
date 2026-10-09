/**
 * Paparan internal pimpinan (#/paparan/<slug>).
 * Isi deck + glosarium HANYA keluar lewat API ini (tidak dibakar ke
 * bundle klien). Guard: SUPERADMIN + BPMJ + KOMISI.
 * Tanpa tautan di nav mana pun.
 */
import { requireRole } from '../auth.mjs';

/** Peran yang boleh membuka paparan pimpinan. */
export const PAPARAN_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI'];

export const PAPARAN_SLUG = 'bpmj-2026-10';

/**
 * Glosarium istilah (footnote deck). Klien me-render kepanjangan tiap
 * istilah yang dipakai slide. Tambah entri baru di sini bila slide
 * memakai singkatan baru — test menjaga tiap footnote ter-resolve.
 */
export const PAPARAN_GLOSSARY = [
  { term: 'ABPJ', full: 'Anggaran Belanja dan Pendapatan Jemaat', meaning: 'APBD-nya jemaat — ditetapkan Sidang; dasar setoran 35% Sinode + 5% Wilayah.' },
  { term: 'BPPJ', full: 'Badan Pengawas Perbendaharaan Jemaat', meaning: 'Auditor internal (3–5 orang, sidi + non-Pelsus + kompeten); verifikasi belanja dan mutasi.' },
  { term: 'Pelsus', full: 'Pelayan Khusus', meaning: 'Pendeta, Penatua, Syamas/Diaken — pemilik hak suara di Sidang.' },
  { term: 'BIPRA', full: 'Badan Pelayanan Kategorial', meaning: 'Bapak, Ibu, Pemuda, Remaja, Anak — pelayanan kategorial per aras.' },
  { term: 'BPMJ', full: 'Badan Pekerja Majelis Jemaat', meaning: 'Badan kolektif aras jemaat (ketua = pendeta SK BPMS); di portal juga dipakai sebagai label peran baca.' },
  { term: 'BPMW', full: 'Badan Pekerja Majelis Wilayah', meaning: 'Badan aras wilayah — dipertahankan SMSI-82.' },
  { term: 'BPMS', full: 'Badan Pekerja Majelis Sinode', meaning: 'Pimpinan tertinggi GMIM (2022–2027: Pdt. Adolf Katuuk Wenas).' },
  { term: 'AMS', full: 'Anggota Majelis Sinode', meaning: 'Utusan jemaat/wilayah di Sidang Sinode; kini termasuk Ketua Kompelka BIPRA (hak suara penuh).' },
  { term: 'SMSI', full: 'Sidang Majelis Sinode Istimewa', meaning: 'Sidang istimewa GMIM; ke-82 digelar 24–26 Sep 2026 (revisi Tata Gereja).' },
  { term: 'DAP', full: 'Dana Awal Panitia', meaning: 'Uang muka kas (kasbon, wajib LPJ + sisa kembali) ATAU pungutan khusus earmarked — dua perlakuan berbeda.' },
  { term: 'LPJ', full: 'Laporan Pertanggungjawaban', meaning: 'Wajib untuk tiap DAP/panitia; tanpa LPJ = dana hilang.' },
  { term: 'Asben', full: 'Asisten Bendahara', meaning: 'Satu-satunya tangan kas komisi; setor + lapor ke Bendahara.' },
  { term: 'SK', full: 'Surat Keputusan', meaning: 'Pengangkatan resmi (BPMJ + persetujuan Sidang untuk komisi/Kostor).' },
  { term: 'THL', full: 'Tim Harmoni Liturgi', meaning: 'Komisi Kerja liturgi Cikarang: seksi Stewardship + seksi MDS.' },
  { term: 'MDS', full: 'Multimedia, Dokumentasi & Sound system', meaning: 'Seksi teknis THL.' },
  { term: 'BZP', full: 'Benzarpreneurship', meaning: 'Komisi Usaha Dana Jemaat (Merchandise, Fundraising, Donation) — bedakan dari BZP Pemuda.' },
  { term: 'Kategorial', full: 'Komisi Pelayanan Kategorial', meaning: 'Perangkat BIPRA — syarat sidi + sertifikat + kriteria; ketua diteguhkan Penatua.' },
  { term: 'Komisi Kerja', full: 'Komisi Kerja (Pasal 38)', meaning: 'Perangkat bidang tertentu — sidi + bukan Pelsus, tanpa sertifikat; diangkat BPMJ + setuju Sidang.' },
  { term: 'Kolom', full: 'Kolom', meaning: 'Persekutuan teritorial dalam jemaat (campur BIPRA) — bukan Wilayah.' },
  { term: 'Atestasi', full: 'Surat keterangan pindah (atestasi)', meaning: 'Syarat terdaftar di jemaat domisili; tanpa ini tak eligible jabatan.' },
  { term: 'Sidi', full: 'Anggota sidi', meaning: 'Anggota dewasa penuh GMIM — syarat dasar semua jabatan.' },
  { term: 'Earmarked', full: 'Dana terikat tujuan', meaning: 'Hanya untuk tujuan yang diumumkan; alih fungsi butuh keputusan Sidang.' },
  { term: 'DPT', full: 'Daftar Pemilih Tetap', meaning: 'Daftar pemilih Rapat Pemilihan — prasyaratnya anggota terdaftar (atestasi).' },
];

export function paparanDeck() {
  return {
    slug: PAPARAN_SLUG,
    title: 'Menata Pelayanan Jemaat Perantau dalam Koridor Tata Gereja GMIM',
    glossary: PAPARAN_GLOSSARY,
    slides: [
      {
        id: 'sampul',
        kicker: 'Paparan BPMJ · Oktober 2026',
        title: 'Menata Pelayanan Jemaat Perantau dalam Koridor Tata Gereja GMIM',
        subtitle: 'GMIM Eben Haezer Cikarang · Usul diskusi & keputusan BPMJ',
        callout: { label: 'Target', value: 'Pulang dengan keputusan atas 6 hal di slide terakhir.' },
        footnotes: ['BPMJ'],
      },
      {
        id: 'realita',
        kicker: 'Slide 2 · Fakta',
        title: 'Realita kita: jemaat perantau yang dinamis',
        bullets: [
          'Mayoritas anak muda perantau — menetap 3–4 tahun, lalu pindah (magang, kerja, menikah).',
          'Siap memberi diri untuk waktu terbatas: kuarter, semester, atau 1 tahun.',
          'Banyak belum terdata — status atestasi gelap, tidak jelas terdaftar di mana.',
          'Rotasi cepat menuntut pola tugas fleksibel, bukan struktur kaku.',
        ],
        footnotes: ['Atestasi'],
      },
      {
        id: 'tata-gereja',
        kicker: 'Slide 3 · Aturan',
        title: 'Apa kata Tata Gereja (ringkas)',
        bullets: [
          'Pelsus (Pendeta/Penatua/Syamas) = pemilik hak suara di Sidang.',
          'Kategorial: sidi + sertifikat kepemimpinan + kriteria (Pemuda 17–30, belum menikah).',
          'Komisi Kerja (Pasal 38): sidi + bukan Pelsus, tanpa sertifikat — diangkat BPMJ + setuju Sidang.',
          'Kostor = jabatan perorangan (Pasal 24), bukan komisi.',
          'Sidang memutuskan komisi, panitia, pegawai, dan Kostor atas usul BPMJ.',
        ],
        callout: { label: 'Kunci', value: 'Pintu masuk pelayanan itu berlapis — yang berat syaratnya hanya struktural Kategorial.' },
        footnotes: ['Pelsus', 'Kategorial', 'Sidi', 'Komisi Kerja', 'BPMJ'],
      },
      {
        id: 'smsi',
        kicker: 'Slide 4 · SMSI-82 (24–26 Sep 2026)',
        title: 'Apa kata SMSI ke-82',
        bullets: [
          'BIPRA tidak ex-officio di Badan Pekerja — ketua BIPRA = diteguhkan Penatua, itu saja.',
          'Ketua Kompelka BIPRA = Anggota Majelis Sinode hak suara (dulu peninjau).',
          'Aras tetap 3 (Jemaat–Wilayah–Sinode); BPMW dipertahankan.',
          'Belum final: batas usia Pelsus 60 vs 65 tahun.',
        ],
        callout: { label: 'Sumber', value: 'Masih liputan pers — dikoreksi saat dokumen revisi final terbit.' },
        footnotes: ['BIPRA', 'AMS', 'BPMW', 'BPMS', 'SMSI', 'Pelsus'],
      },
      {
        id: 'kesenjangan',
        kicker: 'Slide 5 · Jujur',
        title: 'Kesenjangan hari ini (tanpa menyalahkan)',
        bullets: [
          'THL 8 orang berjalan 2+ tahun tanpa SK — tak terlindungi, tak bisa dimintai tanggung jawab formal.',
          'Alat rusak diganti kantong pribadi — harus berhenti total mulai keputusan hari ini.',
          'Status atestasi mayoritas tak tercatat; Komisi Pemuda tersisa bendahara yang aktif.',
          'Praktik "periode 5 tahun" vs aturan (masa komisi = masa BPMJ).',
        ],
        footnotes: ['THL', 'MDS', 'SK', 'Atestasi', 'BPMJ'],
      },
      {
        id: 'dua-jalur',
        kicker: 'Slide 6 · Solusi',
        title: 'Dua jalur pelayanan perantau',
        bullets: [
          'Struktural (SK penuh, syarat utuh) — untuk yang menetap.',
          'Fungsional (Surat Tugas BPMJ time-boxed kuarter/semester) — tanpa mewakili, tanpa pegang kas, tanpa bersuara; didampingi 1 struktural.',
          'Masa fungsional dihitung pengalaman pelayanan (syarat calon ketua).',
          'Format: "harusnya A, tapi B, dengan catatan C" — di ruang yang memang milik jemaat.',
        ],
        callout: { label: 'Pagar', value: 'Non-sidi/Pelsus di Komisi Kerja, hak suara non-Pelsus, kas luar Bendahara, masa lewat periode — tidak bisa dinego.' },
        footnotes: ['SK', 'BPMJ', 'Sidi', 'Pelsus'],
      },
      {
        id: 'matriks',
        kicker: 'Slide 7 · Peran',
        title: 'Matriks 4 peran internal',
        fields: [
          { label: 'Pembangunan', value: 'Komisi Kerja — aset & sewa milik jemaat, tarif putusan Sidang.' },
          { label: 'Kostor', value: 'Jabatan perorangan + Surat Tugas asisten (tanpa wewenang keuangan/perwakilan).' },
          { label: 'THL (4+4)', value: '1 Komisi Kerja 2 seksi — SK-kan, akui 2 tahun, stop nombok, inventarisasi.' },
          { label: 'BZP', value: 'Komisi Usaha Dana Jemaat — bedakan dari BZP Pemuda.' },
        ],
        callout: { label: 'Prinsip', value: 'Tidak ada milik pribadi atas yang gerejawi.' },
        footnotes: ['Komisi Kerja', 'THL', 'MDS', 'BZP'],
      },
      {
        id: 'kas',
        kicker: 'Slide 8 · Kas',
        title: 'Kas jemaat: tetap 2 pos',
        bullets: [
          'POS 1 — PELAYANAN (kode 1.1–1.10): ibadah, BIPRA, Kolom, diakonia & beasiswa di dalam, pendidikan, personalia, kesekretariatan, kewajiban 35% Sinode + 5% Wilayah, cadangan, kas pembantu.',
          'POS 2 — PEMBANGUNAN (kode 2.1–2.4): sewa ruko ±70 jt/thn a.n. gereja, servis AC, listrik/air, alat kebersihan, perbaikan peralatan, deposit + darurat pindah.',
          'Definisi tertulis: "sewa & rawat, bukan proyek bangun" — supaya tak ditagih gedung.',
          'Satu jenis penerimaan = satu pemilik (kolekte/syukur = Bendahara; sewa = Pembangunan; dana event = Panitia + LPJ).',
        ],
        callout: { label: 'Aturan', value: '100% penerimaan masuk kas jemaat tiap minggu; earmarked tak boleh dicampur operasional.' },
        footnotes: ['ABPJ', 'BPMS', 'BPPJ', 'BIPRA', 'Kolom', 'Earmarked', 'LPJ'],
      },
      {
        id: 'dap',
        kicker: 'Slide 9 · DAP',
        title: 'DAP: dua mekanisme, dua perlakuan',
        fields: [
          { label: 'DAP-Uang Muka (kasbon)', value: 'Bukan pendapatan. Diputus BPMJ. LPJ + sisa kembali 100%. Cth: DAP operasional event.' },
          { label: 'DAP-Pungutan Khusus', value: 'Pendapatan earmarked. Diputus Sidang. LPJ + sisa diputus Sidang. Cth: DAP beli AC.' },
        ],
        callout: { label: 'Dilarang', value: 'Dana hilang tanpa LPJ; earmarked dialihkan tanpa keputusan.' },
        footnotes: ['DAP', 'LPJ', 'Earmarked', 'BPMJ'],
      },
      {
        id: 'bzp',
        kicker: 'Slide 10 · Kas Minggu',
        title: 'BZP: Minggu utama, fleksibel + kolaborasi',
        bullets: [
          'Fokus Minggu; Sabtu/weekday dimungkinkan (order + setuju BPMJ) — cth. bazar kampus PresUniv.',
          'Tanpa order = mode default (100% kas BZP). Kolaborasi internal = 100% milik pemesan via berita acara.',
          'Kolaborasi eksternal (kampus): bagi hasil diputus BPMJ tertulis sebelum hari-H; kas satu pintu via Asben.',
          'Rekening operasional: putusan Sidang + 2 tanda tangan + pagu + lapor bulanan; hasil usaha = sumber #5.',
        ],
        footnotes: ['BZP', 'Asben', 'BPMJ', 'ABPJ'],
      },
      {
        id: 'suksesi',
        kicker: 'Slide 11 · Q4 2026',
        title: 'Suksesi Komisi Pemuda',
        bullets: [
          'Masa berakhir 2026 → Rapat Pemilihan (didukung, bukan diangkat langsung).',
          'Critical path: sertifikat kepemimpinan SEBELUM hari-H — Latihan intensif segera.',
          'Kontrak pelayanan tahunan sebagai katup fleksibilitas; Tim Kerja tahunan tetap di bawah komisi.',
          'Yang idle tak perlu mekanisme lowong — cukup tidak dicalonkan lagi.',
        ],
        footnotes: ['DPT', 'Atestasi'],
      },
      {
        id: 'atestasi',
        kicker: 'Slide 12 · Gerakan',
        title: 'Gerakan atestasi + sertifikasi',
        bullets: [
          'Tanpa atestasi = tidak eligible jabatan apa pun — portal melacak BELUM / PROSES / SUDAH.',
          'Rekap per Kolom/BIPRA di dasbor BPMJ — gerakan jadi terukur.',
          'Sertifikasi kuarteran: dari gerbang menjadi anak tangga.',
        ],
        footnotes: ['Atestasi', 'Kolom', 'BIPRA', 'BPMJ'],
      },
      {
        id: 'keputusan',
        kicker: 'Slide 13 · Ketok',
        title: 'Minta diketok hari ini',
        bullets: [
          'SK-kan THL + pengakuan masa + kebijakan stop dana pribadi + inventarisasi.',
          'Bentuk Komisi Usaha Dana + rekening + SOP order (termasuk Sabtu/kampus).',
          'SK Kostor + Surat Tugas asisten; struktur ABPJ 2 pos + definisi Pembangunan.',
          'Latihan Kepemimpinan intensif + Panitia Pemilihan Q4.',
          'Klarifikasi masa komisi + mulai gerakan atestasi.',
          'Aturan DAP dua mekanisme + LPJ wajib.',
        ],
        callout: { label: 'Siap', value: 'Naskah SK, SOP, dan berita acara sudah ada drafnya.' },
        footnotes: ['THL', 'DAP', 'LPJ', 'ABPJ'],
      },
    ],
  };
}

/**
 * GET /api/paparan/bpmj-2026-10 — isi deck + glosarium paparan pimpinan.
 * Hanya SUPERADMIN + BPMJ + KOMISI. 401 tanpa login, 403 peran lain.
 */
export function registerPaparanRoutes(app, { wrap }) {
  app.get('/api/paparan/bpmj-2026-10', requireRole(...PAPARAN_ROLES), wrap(async (_req, res) => {
    res.json(paparanDeck());
  }));
}
