/**
 * Draf curasi Bedah Film: The Case for Christ (2017) — event 17 Okt 2026
 * (origin week 2026-10/W3, slot 18 Okt digeser ke 17 Okt).
 *
 * Dipakai skrip pengisi `scripts/fill-bedah-film-case-for-christ.mjs`
 * (Simpan draft = tulis config.draft; Terapkan tetap via UI agar guard
 *  sesi DRAFT kosong tetap berlaku).
 *
 * Jangkar firman: 1 Korintus 15:3-8 (mati–dikubur–bangkit, 500 saksi) +
 * Yohanes 20:1-29 (makam kosong, saksi wanita, Tomas) + Kis 4:19-20
 * (murid berani bersaksi). Konteks Beyonders: KRS/skripsi/magang/shift/
 * lembur/kos/keuangan awal/relasi Cikarang.
 */

/** Bentuk StoredDraft: { [section]: { [field]: string } }. */
export const CASE_FOR_CHRIST_DRAFT = {
  film: {
    'film-title': 'The Case for Christ (2017, 112 menit — tayang versi 60–95 menit + jeda diskusi)',
    'film-alt':
      '1. Soul Surfer (2011) — perjuangan remaja dengan iman dan identitas setelah tragedi; kuat untuk tema penderitaan dan pengampunan, tapi minim argumen historis kebangkitan. ' +
      '2. The Resurrection of Gavin Stone (2016) — pertobatan dan pelayanan yang otentik; dekat dengan isu topeng di kampus/kerja, tapi fiksi dan tidak menyentuh bukti kebangkitan. ' +
      'The Case for Christ menang untuk pekan ini karena isu sentralnya = investigasi bukti kebangkitan (kisah nyata jurnalis ateis Lee Strobel, Chicago Tribune, lulusan Yale Law; istri Leslie bertobat; ±2 tahun wawancara belasan pakar) — sejajar 1 Korintus 15:3-8.',
    'film-scenes':
      'Adegan 1 — Lee memeriksa bukti medis penyaliban (konsultasi dokter/forensik: Yesus benar mati, bukan pingsan). Paralel 1 Korintus 15:3 + Yohanes 19:33-34: "Kristus telah mati karena dosa-dosa kita, sesuai Kitab Suci." Diskusi: di mana kamu masih menuntut "bukti dulu baru taat" — soal KRS, magang, shift, atau relasi?\n' +
      'Adegan 2 — Leslie berubah + para wanita menemukan makam kosong (Yohanes 20:1-18). Kesaksian yang diremehkan zaman itu ternyata konsisten dan paling awal. Paralel: makam kosong sebagai fakta yang harus dijelaskan, bukan diabaikan. Diskusi: kesaksian siapa yang selama ini kamu remehkan di kos/kelompok?\n' +
      'Adegan 3 — Lee menyerah pada bukti + murid yang pengecut jadi berani mati (1 Korintus 15:5-8: menampakkan diri kepada 500+ orang; Kisah Para Rasul 4:19-20). Mustahil mereka mati untuk dusta yang mereka karang. Diskusi: perubahan apa yang membuktikan Yesus bangkit dalam hidupmu — di kampus, shift, dan keuangan awal?',
    'pleno-prompt':
      'Karakter siapa yang paling mirip kamu minggu ini — Lee yang menuntut bukti sebelum percaya, Leslie yang berubah diam-diam, atau murid yang takut lalu berani bersaksi? Jawab dengan 1 ayat (1 Korintus 15:3-8 / Yohanes 20 / Kis 4:19-20) + 1 situasi konkret (KRS, skripsi, lembur, kos).',
  },
  'likert-film': {
    'likert-film-1': 'Saya merasa perlu bukti yang kuat sebelum percaya kebangkitan Yesus relevan bagi kuliah/pekerjaan saya.',
    'likert-film-2': 'Saya yakin Yesus benar-benar mati disalib dan bangkit secara historis (1 Korintus 15:3-4), bukan sekadar kiasan.',
    'likert-film-3': 'Saya berani jujur soal keraguan iman saya di depan teman kos/kelompok, seperti Leslie kepada Lee.',
    'likert-film-4': 'Saya merasa perubahan hidup saya (sikap di shift/kampus/kos) bisa menjadi bukti Injil bagi orang lain.',
    'likert-film-5': 'Saya percaya Injil memberikan arah bagi keputusan hidup saya minggu ini (KRS, magang, lembur, relasi).',
  },
  deep: {
    'film-q1': 'Kapan terakhir kamu memakai "topeng rohani" — terlihat yakin di ibadah tapi diam-diam ragu seperti Lee di awal? Apa yang kamu tutupi dari teman atau mentor, dan mengapa?',
    'film-q2': 'Bukti kebangkitan mana yang paling menampar kamu — eksekusi medis, makam kosong, 500 saksi (1 Korintus 15:5-8), atau murid yang rela mati (Kis 4:19-20)? Kaitkan ke Yohanes 20 dan situasimu (kos, kampus, shift, keuangan) minggu ini.',
    'film-q3': 'Satu langkah otentik minggu ini: kepada siapa kamu akan jujur soal iman/keraguanmu dan mengajak menyelidiki Yesus (ngobrol 30 menit, baca Yohanes 20 bareng, ikut Bedah Teologis)? Tulis nama + harinya.',
  },
  lesson: {
    'lesson-chip-1': '#Bangkit',
    'lesson-chip-2': '#BuktiNyata',
    'lesson-chip-3': '#SaksiHidup',
    'lesson-chip-4': '#JujurIman',
    'lesson-chip-5': '#BeraniBersaksi',
    'lesson-chip-6': '#KasihKristus',
    'lesson-chip-7': '#Anugerah',
    'lesson-chip-8': '#TerangDunia',
    'lesson-chip-9': '#TaatFirman',
    'lesson-chip-10': '#PulangPadaNya',
  },
};

export const CASE_FOR_CHRIST_TARGET = {
  yearMonth: '2026-10',
  weekIndex: 3,
  slotDate: '2026-10-18',
  eventDate: '2026-10-17',
  patternCode: 'BEDAH_FILM',
};
