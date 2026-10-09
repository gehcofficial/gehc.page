/**
 * Paparan internal pimpinan (#/paparan/<slug>).
 * Isi deck HANYA keluar lewat API ini (tidak dibakar ke bundle klien).
 * Guard: SUPERADMIN + BPMJ + KOMISI. Tanpa tautan di nav mana pun.
 */
import { requireRole } from '../auth.mjs';

/** Peran yang boleh membuka paparan pimpinan. */
export const PAPARAN_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI'];

export const PAPARAN_SLUG = 'bpmj-2026-10';

export function paparanDeck() {
  return {
    slug: PAPARAN_SLUG,
    title: 'Menata Pelayanan Jemaat Perantau dalam Koridor Tata Gereja GMIM',
    slides: [
      {
        id: 'sampul',
        kicker: 'Paparan BPMJ · Oktober 2026',
        title: 'Menata Pelayanan Jemaat Perantau dalam Koridor Tata Gereja GMIM',
        subtitle: 'GMIM Eben Haezer Cikarang · Usul diskusi & keputusan BPMJ',
        callout: { label: 'Target', value: 'Pulang dengan keputusan atas 5 hal di slide terakhir.' },
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
      },
      {
        id: 'smsi',
        kicker: 'Slide 4 · SMSI-82 (24–26 Sep 2026)',
        title: 'Apa kata SMSI ke-82',
        bullets: [
          'BIPRA tidak ex-officio di Badan Pekerja — ketua BIPRA = diteguhkan Penatua, itu saja.',
          'Ketua Kompelka BIPRA = Anggota Majelis Sinode penuh hak suara (dulu peninjau).',
          'Aras tetap 3 (Jemaat–Wilayah–Sinode); BPMW dipertahankan.',
          'Belum final: batas usia Pelsus 60 vs 65 tahun.',
        ],
        callout: { label: 'Sumber', value: 'Masih liputan pers — dikoreksi saat dokumen revisi final terbit.' },
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
      },
      {
        id: 'bzp',
        kicker: 'Slide 8 · Kas Minggu',
        title: 'BZP: model kas Minggu',
        bullets: [
          'Order BIPRA/Kolom H–7 via BPMJ; tanpa order = mode default (100% kas BZP).',
          'Mode kolaborasi: hasil 100% milik pemesan via berita acara hari itu juga.',
          'Rekening operasional: putusan Sidang + 2 tanda tangan + pagu saldo + lapor bulanan.',
          'Klasifikasi hasil usaha vs ABPJ dikonfirmasi ke Bendahara/BPPJ.',
        ],
      },
      {
        id: 'suksesi',
        kicker: 'Slide 9 · Q4 2026',
        title: 'Suksesi Komisi Pemuda',
        bullets: [
          'Masa berakhir 2026 → Rapat Pemilihan (didukung, bukan diangkat langsung).',
          'Critical path: sertifikat kepemimpinan SEBELUM hari-H — Latihan intensif segera.',
          'Kontrak pelayanan tahunan sebagai katup fleksibilitas; Tim Kerja tahunan tetap di bawah komisi.',
          'Yang idle tak perlu mekanisme lowong — cukup tidak dicalonkan lagi.',
        ],
      },
      {
        id: 'atestasi',
        kicker: 'Slide 10 · Gerakan',
        title: 'Gerakan atestasi + sertifikasi',
        bullets: [
          'Tanpa atestasi = tidak eligible jabatan apa pun — portal melacak BELUM / PROSES / SUDAH.',
          'Rekap per Kolom/BIPRA di dasbor BPMJ — gerakan jadi terukur.',
          'Sertifikasi kuarteran: dari gerbang menjadi anak tangga.',
        ],
      },
      {
        id: 'keputusan',
        kicker: 'Slide 11 · Ketok',
        title: 'Minta diketok hari ini',
        bullets: [
          'SK-kan THL + pengakuan masa + kebijakan stop dana pribadi + inventarisasi.',
          'Bentuk Komisi Usaha Dana + rekening + SOP order.',
          'SK Kostor + Surat Tugas asisten.',
          'Latihan Kepemimpinan intensif + Panitia Pemilihan Q4.',
          'Klarifikasi masa komisi + mulai gerakan atestasi.',
        ],
        callout: { label: 'Siap', value: 'Naskah SK, SOP, dan berita acara sudah ada drafnya.' },
      },
    ],
  };
}

/**
 * GET /api/paparan/bpmj-2026-10 — isi deck paparan pimpinan.
 * Hanya SUPERADMIN + BPMJ + KOMISI. 401 tanpa login, 403 peran lain.
 */
export function registerPaparanRoutes(app, { wrap }) {
  app.get('/api/paparan/bpmj-2026-10', requireRole(...PAPARAN_ROLES), wrap(async (_req, res) => {
    res.json(paparanDeck());
  }));
}
