/**
 * Deck presentasi untuk Mentor & Co-Mentor (youth.gehc.page).
 * Fokus: cara kerja regenerasi kelompok + cara orang baru ditempatkan (Jethro),
 * dan fitur portal yang perlu diperhatikan mentor. Bahasa Indonesia, tanpa data pribadi.
 *
 * Sumber angka & aturan (agar tetap akurat):
 * - server/engine.mjs            → ambang grup, idle, mitosis, merger
 * - server/engine.mjs (advanced) → 4 faktor penempatan (30/25/30/15)
 * - server/jethro-placement.mjs  → batch review & commit penempatan
 * - RegenerationWizard.tsx       → 5 langkah regenerasi
 */

import type { PitchSlide } from './pitchSlides';

const DEMO = '/pitch/regenerasi';

export const MENTOR_PITCH_SLIDES: PitchSlide[] = [
  {
    id: 'cover',
    kind: 'cover',
    eyebrow: 'GMIM Eben Haezer Cikarang · Beyonders',
    title: 'Regenerasi & Peran Mentor',
    subtitle: 'Cara sistem bekerja — dan apa yang perlu Anda perhatikan sebagai Mentor / Co-Mentor.',
  },
  {
    id: 'dasar',
    kind: 'section',
    eyebrow: 'Dasar',
    title: 'Kenapa sistem ini ada',
    bullets: [
      '2 Timotius 2:2 — apa yang kita terima, kita percayakan kepada orang yang setia, yang mampu mengajar orang lain.',
      'Keluaran 18 — Yitro (Jethro) mengajarkan Musa: jangan memikul semua sendiri, bagi berlapis.',
      'Dari dua prinsip itu lahir “Jethro Engine”: kelompok kecil, berlapis, dan beregenerasi.',
      'Tujuannya sederhana: tidak ada mentee yang terlewat, tidak ada mentor yang kelelahan.',
    ],
  },
  {
    id: 'peta',
    kind: 'list',
    eyebrow: 'Peta besar',
    title: 'Tiga lapis yang saling terhubung',
    bullets: [
      'Lapis 1 — Orang baru masuk: daftar → profil → tes karunia.',
      'Lapis 2 — Penempatan (Jethro Engine): sistem mengusulkan grup & peran, Komisi memutuskan.',
      'Lapis 3 — Regenerasi kelompok: mentee matang dipromosikan, generasi baru dibuka.',
      'Mentor & Co-Mentor berdiri di tengah ketiganya: penerima, pengusul, dan penggembala.',
    ],
  },
  {
    id: 'alur-baru',
    kind: 'flow',
    eyebrow: 'Lapis 1',
    title: 'Alur orang baru sampai menjadi anggota',
    subtitle: 'Semua tahap tercatat di portal — tidak ada yang diputuskan “di luar kertas”.',
    flow: [
      { title: 'Daftar / Diundang', caption: 'Dari event, undangan, atau mendaftar sendiri.' },
      { title: 'Waiting Pool', caption: 'Masuk antrean onboarding; belum punya kelompok.' },
      { title: 'Lengkapi Profil', caption: 'Data diri, gender, domisili, minat.' },
      { title: 'Tes Karunia', caption: 'Wajib sebelum bisa ditempatkan.' },
      { title: 'Rekomendasi Jethro', caption: 'Sistem menghitung grup & peran terbaik.' },
      { title: 'Review Komisi', caption: 'Disetujui, diubah, atau dijadikan Individu.' },
      { title: 'Commit', caption: 'Role & grup resmi ditetapkan.' },
      { title: 'Anggota Baru', caption: 'Notifikasi, kartu selamat datang, gabung WA.' },
    ],
  },
  {
    id: 'gift',
    kind: 'list',
    eyebrow: 'Lapis 1',
    title: 'Tes Karunia: kenapa wajib',
    bullets: [
      'Diambil saat onboarding (juga bisa dibuka dari Profil → Karunia rohani).',
      'Hasilnya menyimpan 5 karunia teratas (giftsTop5) dan skor per karunia (giftsScores).',
      'Syarat penempatan otomatis: punya akun + gender + tes karunia selesai.',
      'Bagi Anda sebagai mentor: ini daftar kekuatan mentee — dasar untuk memberi tugas pelayanan yang tepat.',
      'Mentee tanpa tes karunia tidak akan muncul di rekomendasi Jethro.',
    ],
  },
  {
    id: 'faktor',
    kind: 'weights',
    eyebrow: 'Lapis 2',
    title: 'Empat parameter Jethro',
    subtitle: 'Skor setiap grup dihitung untuk tiap orang baru, lalu diurutkan.',
    weights: [
      { label: 'Distribusi rata', value: 0.3, note: 'Grup yang slotnya masih banyak lebih dipilih.' },
      { label: 'Keseimbangan gender', value: 0.25, note: 'Gender yang minoritas di grup itu diberi nilai lebih.' },
      { label: 'Keragaman karunia', value: 0.3, note: 'Karunia langka yang belum ada di grup bernilai tinggi.' },
      { label: 'Kesiapan (maturity)', value: 0.15, note: 'Menentukan usulan peran: Mentee, Co-Mentor, atau Mentor.' },
    ],
  },
  {
    id: 'baca-skor',
    kind: 'list',
    eyebrow: 'Lapis 2',
    title: 'Cara membaca rekomendasi di Review Penempatan',
    bullets: [
      'Setiap usulan menyertakan alasan: “Even distribution”, “Gender balance”, “Gift diversity”, “Maturity fit”.',
      'Contoh (ilustrasi): Grup A — distribusi 0,8 · gender 0,7 · karunia 0,9 · kesiapan 0,8 → skor total 0,80.',
      'Kesiapan ≥ 0,8 + belum punya Mentor → diusulkan sebagai Mentor; belum punya Co-Mentor → Co-Mentor.',
      'Kesiapan 0,6–0,8 → diusulkan Co-Mentor bila slotnya kosong; selebihnya Mentee.',
      'Komisi tetap bisa mengubah usulan. Sistem hanya memberi urutan, keputusan tetap manusia.',
      'Jika tidak ada grup yang cocok → bisa ditetapkan sebagai Individu (tanpa kelompok).',
    ],
  },
  {
    id: 'kapasitas',
    kind: 'list',
    eyebrow: 'Lapis 3',
    title: 'Kapasitas & pemicu regenerasi',
    bullets: [
      'Ambang kelompok: 10 anggota aktif (mentor, co-mentor, dan mentee dihitung).',
      'Idle: tidak hadir 4 minggu berturut-turut → muncul di daftar perhatian.',
      'Mitosis: grup penuh + ada ≥2 mentee dengan kehadiran ≥80% selama 8 minggu → usul promosi jadi Mentor & Co-Mentor.',
      'Merger: dua grup saudara yang gabungannya ≤6 orang → disarankan digabung agar koinonia hidup.',
      'Semua pemicu ini muncul sebagai notifikasi & daftar tindak lanjut, bukan keputusan otomatis.',
    ],
  },
  {
    id: 'review-penempatan',
    kind: 'list',
    eyebrow: 'Lapis 2',
    title: 'Alur Review Penempatan (yang Anda terima hasilnya)',
    bullets: [
      'Sistem membuat satu batch usulan untuk semua orang baru yang siap.',
      'Komisi membuka Review Penempatan: melihat grup tujuan, peran, skor, dan alasannya.',
      'Item bisa disetujui, diubah grup/perannya, ditolak, atau dijadikan Individu.',
      'Setelah commit: role & grup benar-benar ditetapkan, dan Anda menerima notifikasi anggota baru.',
      'Kalau usulan terasa janggal, itu wajar — sampaikan ke Komisi sebelum commit.',
    ],
  },
  {
    id: 'demo-panel',
    kind: 'image',
    eyebrow: 'Lapis 3',
    title: 'Panel Regenerasi Kelompok',
    subtitle: 'Satu panel, lima langkah berurutan. Tidak ada langkah yang bisa dilompati.',
    image: {
      src: `${DEMO}/01-panel.png`,
      alt: 'Panel Regenerasi Kelompok dengan lima langkah',
      caption: 'Panel ini dijalankan Komisi. Mentor menerima dampaknya di halaman kelompok masing-masing.',
    },
  },
  {
    id: 'video-regenerasi',
    kind: 'demo',
    eyebrow: 'Lapis 3',
    title: 'Melihat prosesnya berjalan',
    subtitle: 'Perekaman singkat lima langkah regenerasi.',
    demo: {
      steps: [
        { icon: 'daftar', title: 'Alumni', caption: 'Anggota generasi lama ditandai alumni — riwayatnya tetap tersimpan.', media: `${DEMO}/regeneration.webm`, startAt: 0.4 },
        { icon: 'daftar', title: 'Buka generasi', caption: 'Periode generasi baru dibuka dengan konfirmasi.', media: `${DEMO}/regeneration.webm`, startAt: 2.5 },
        { icon: 'daftar', title: 'Pemimpin', caption: 'Mentor & Co-Mentor baru ditetapkan lebih dulu.', media: `${DEMO}/regeneration.webm`, startAt: 5 },
        { icon: 'daftar', title: 'Bawa anggota', caption: 'Anggota dibawa ke generasi baru dengan pratinjau.', media: `${DEMO}/regeneration.webm`, startAt: 8 },
        { icon: 'daftar', title: 'Assign baru', caption: 'Anggota baru ditempatkan. Aksi terakhir masih bisa dibatalkan.', media: `${DEMO}/regeneration.webm`, startAt: 11 },
      ],
    },
  },
  {
    id: 'lima-langkah',
    kind: 'flow',
    eyebrow: 'Lapis 3',
    title: 'Lima langkah regenerasi — urutannya mengikat',
    subtitle: 'Urutan ini disengaja: pemimpin dulu, baru anggota, supaya atribusi generasi benar.',
    flow: [
      { title: '1. Alumni', caption: 'Tandai generasi lama sebagai alumni.' },
      { title: '2. Buka generasi', caption: 'Tetapkan periode baru (mis. 2026-09).' },
      { title: '3. Pemimpin', caption: 'Tentukan Mentor & Co-Mentor generasi baru.' },
      { title: '4. Bawa anggota', caption: 'Bawa mentee yang melanjutkan.' },
      { title: '5. Assign baru', caption: 'Tempatkan anggota baru ke kelompok.' },
    ],
  },
  {
    id: 'roster',
    kind: 'list',
    eyebrow: 'Lapis 3',
    title: 'Yang berubah di halaman kelompok Anda',
    bullets: [
      'Roster anggota menampilkan badge: Aktif, Alumni, Generasi lalu, atau Pindah.',
      '“Sejarah Generasi” menampilkan semua status — bukan hanya yang aktif.',
      'Anggota yang berpindah kelompok tetap terlacak asalnya.',
      'Alumni tetap punya jejak: asal generasinya tercatat di Hall of Alumni.',
      'Salah langkah? Ada “Batalkan aksi terakhir” — snapshot diambil sebelum aksi dijalankan.',
    ],
  },
  {
    id: 'fitur-1',
    kind: 'checklist',
    eyebrow: 'Fitur Anda',
    title: 'Yang perlu diperhatikan: Monitoring',
    checklist: [
      { title: 'Laporan mingguan', detail: 'Kehadiran, evaluasi rohani, dan pokok doa diisi di Monitoring → inilah bahan bakar sistem.' },
      { title: 'Kehadiran', detail: 'Di bawah 4 minggu tanpa hadir, anggota masuk daftar idle. Bukan untuk menghukum — untuk dikunjungi.' },
      { title: 'Kehadiran ≥80%', detail: 'Mentee dengan kehadiran tinggi & konsisten adalah kandidat pemimpin generasi berikutnya.' },
      { title: 'Pokok doa', detail: 'Tulis singkat, tanpa diagnosis. Data ini sensitif dan tidak tampil di halaman publik.' },
    ],
  },
  {
    id: 'fitur-2',
    kind: 'checklist',
    eyebrow: 'Fitur Anda',
    title: 'Yang perlu diperhatikan: Pelayanan & Doa',
    checklist: [
      { title: 'Jadwal Pelayanan', detail: 'Lihat kapan kelompok Anda jadi penanggung jawab atau tuan rumah ibadah.' },
      { title: 'Usulan tukar', detail: 'Bila perlu tukar, musyawarahkan dulu dengan mentor pasangan, lalu ajukan — menunggu persetujuan.' },
      { title: 'Pengingat Kamis', detail: 'Kalau petugas ibadah minggu itu belum lengkap, pengingat otomatis dikirim.' },
      { title: 'Portal Doa', detail: 'Catatan pastoral bersifat privat; yang boleh dibaca hanya pihak terkait.' },
      { title: 'Doa Minggu', detail: 'Daftar konteks doa untuk ibadah, dengan mode “sembunyikan detail” agar aman dibaca di depan jemaat.' },
    ],
  },
  {
    id: 'fitur-3',
    kind: 'checklist',
    eyebrow: 'Fitur Anda',
    title: 'Yang perlu diperhatikan: Komunikasi & Kegiatan',
    checklist: [
      { title: 'Kartu “Grup WhatsApp saya”', detail: 'Di Dashboard — hanya menampilkan grup/BIPRA/kolom/minat yang memang milik Anda.' },
      { title: 'Broadcast WhatsApp', detail: 'Untuk menghubungi mentee dari Roster/Absensi, bukan pengganti pengumuman resmi.' },
      { title: 'Kegiatan & check-in', detail: 'Peserta diverifikasi lewat QR daftar ulang; absensi memengaruhi laporan monitoring.' },
      { title: 'Warta', detail: 'Petugas penatalayan, tuan rumah, dan pokok doa bisa terisi otomatis dari jadwal — tinggal disunting.' },
    ],
  },
  {
    id: 'ritme',
    kind: 'list',
    eyebrow: 'Ritme',
    title: 'Ritme mingguan Mentor & Co-Mentor',
    bullets: [
      'Sebelum Minggu — cek jadwal pelayanan & pastikan petugas kelompok Anda lengkap.',
      'Saat ibadah — pastikan kehadiran tercatat (check-in/absensi).',
      'Setelah ibadah — isi laporan monitoring: kehadiran, suhu rohani, pokok doa.',
      'Pertengahan minggu — hubungi yang absen atau sedang sulit (Portal Doa).',
      'Akhir bulan — tandai mentee yang matang; usulkan promosi bila kelompok sudah penuh.',
    ],
  },
  {
    id: 'dos',
    kind: 'list',
    eyebrow: 'Aturan main',
    title: 'Do & Don’t',
    bullets: [
      'Lakukan: catat kehadiran apa adanya — data jujur menyelamatkan orang.',
      'Lakukan: tutup catatan doa bila sudah selesai, agar fokus tetap tajam.',
      'Lakukan: koordinasikan tukar jadwal dengan mentor pasangan sebelum mengajukan.',
      'Jangan: menyebar pokok doa atau data pribadi mentee ke grup WA.',
      'Jangan: mengubah data/role orang lain — itu kewenangan Komisi.',
      'Jangan: mengerjakan regenerasi sendiri tanpa urutan dan konfirmasi.',
    ],
  },
  {
    id: 'bantuan',
    kind: 'list',
    eyebrow: 'Kalau buntu',
    title: 'Ke mana bertanya',
    bullets: [
      'Data kelompok, kehadiran, atau monitoring → Komisi Pemuda.',
      'Jadwal pelayanan & penatalayan → Liturgia / Marturia.',
      'Catatan pastoral atau kunjungan → Diakonia (bersama mentor).',
      'Akun, akses, dan error teknis → Superadmin portal.',
    ],
  },
  {
    id: 'qr',
    kind: 'qr',
    eyebrow: 'Mulai',
    title: 'Buka dan coba sendiri',
    subtitle: 'Tiga hal untuk dicoba minggu ini.',
    qr: [
      { label: 'Portal Beyonders', url: 'youth.gehc.page', image: '/media/qr-daftar-youth.png' },
      { label: 'Hub gereja', url: 'gehc.page', image: '/media/qr-hub.png' },
    ],
  },
  {
    id: 'closing',
    kind: 'closing',
    eyebrow: 'Terima kasih',
    title: 'Regenerasi bukan program, tapi cara kita mengasihi',
    subtitle: 'Yang Anda catat hari ini adalah masa depan seseorang. Tuhan Yesus memberkati pelayanan Anda.',
  },
];
