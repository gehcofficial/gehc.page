/**
 * Bank Tes Karunia Rohani GEHC Youth — kurasi 22 karunia
 * (Rm 12 · 1Kr 12 · Ef 4 · 1Ptr 4), dikontekstualisasi untuk
 * mahasiswa & pekerja muda. Dapat disunting sebagai config.
 *
 * Skor: tiap pernyataan Likert 1–5; skor karunia = jumlah 3 pernyataan.
 */

export interface GiftDef {
  /** kode unik */
  key: string;
  label: string;
  verse: string;
  items: [string, string, string];
}

export const GIFT_BANK: GiftDef[] = [
  { key: 'NUBUAT', label: 'Nubuat', verse: 'Roma 12:6', items: [
    'Aku merasa mendengar pesan Tuhan untuk situasi tertentu dan berani menyampaikannya.',
    'Orang lain sering merasa dibangkitkan/ditegur lewat kata-kata yang aku sampaikan.',
    'Aku berani menyampaikan kebenaran Firman meski tidak populer.',
  ]},
  { key: 'PENGAJARAN', label: 'Pengajaran', verse: 'Roma 12:7', items: [
    'Aku senang mempelajari Alkitab secara mendalam lalu menjelaskannya dengan sederhana.',
    'Teman-teman paham saat aku menjelaskan firman atau materi.',
    'Aku melihat kesalahan pemahaman doktrin dan ingin memperbaikinya.',
  ]},
  { key: 'HIKMAT', label: 'Hikmat', verse: '1 Korintus 12:8', items: [
    'Teman sering minta pendapatku untuk keputusan penting mereka.',
    'Aku bisa melihat akibat jangka panjang dari sebuah pilihan.',
    'Aku tahu kapan harus bicara dan kapan diam dalam situasi sulit.',
  ]},
  { key: 'PENGETAHUAN', label: 'Pengetahuan', verse: '1 Korintus 12:8', items: [
    'Aku mudah mengingat ayat, fakta firman, atau detail penting.',
    'Aku kadang tahu hal yang tak mungkin kuketahui secara alami.',
    'Aku gemar mengumpulkan pemahaman yang menguatkan iman.',
  ]},
  { key: 'PENGUATAN', label: 'Penguatan (Penghiburan)', verse: 'Roma 12:8', items: [
    'Aku tahu cara menemani orang yang sedang down agar bangkit lagi.',
    'Kata-kataku sering membuat orang termotivasi melanjutkan pelayanan.',
    'Aku peka menemukan sisi positif Tuhan di tengah kegagalan orang.',
  ]},
  { key: 'PEMBEDAAN', label: 'Pembedaan Roh', verse: '1 Korintus 12:10', items: [
    'Aku cepat merasa tidak "enak" saat ada ajaran/perilaku menyesatkan.',
    'Aku bisa membedakan motivasi hati orang (tulus atau bukan).',
    'Aku jarang tertipu oleh tren rohani yang sekadar ramai.',
  ]},
  { key: 'IMAN', label: 'Iman', verse: '1 Korintus 12:9', items: [
    'Aku tenang percaya janji Tuhan walau keadaan mustahil.',
    'Aku berani mengambil langkah besar karena yakin Tuhan menyediakan.',
    'Doa-doaku untuk hal mustahil sering terkabuli.',
  ]},
  { key: 'MUKJIZAT', label: 'Kuasa & Mukjizat', verse: '1 Korintus 12:10', items: [
    'Aku percaya Tuhan bekerja di luar hukum alam lewat doaku.',
    'Aku pernah melihat/mengalami peristiwa yang tak bisa dijelaskan logika.',
    'Aku berani berdoa untuk hal-hal besar tanpa ragu.',
  ]},
  { key: 'PENGOBATAN', label: 'Pengobatan', verse: '1 Korintus 12:9', items: [
    'Aku berani mendoakan orang sakit secara spesifik demi kesembuhan.',
    'Hatiku tergerak kuat saat mendengar ada yang sakit.',
    'Aku percaya kesembuhan ilahi masih terjadi hari ini lewat doa.',
  ]},
  { key: 'BAHASA_ROH', label: 'Bahasa Roh', verse: '1 Korintus 12:10', items: [
    'Aku memiliki bahasa doa khusus yang membangun hatiku.',
    'Berbahasa roh membantuku berdoa di luar batas pikiranku.',
    'Praktik ini meneguhkan kesadarank akan hadirat Roh Kudus.',
  ]},
  { key: 'MENAFSIR', label: 'Menafsirkan Bahasa Roh', verse: '1 Korintus 12:10', items: [
    'Aku dipercayai membingkai makna bahasa roh bagi jemaat.',
    'Aku bisa menangkap inti pesan rohani untuk dibagikan dengan teratur.',
    'Aku menjaga ketertiban ibadah sesuai 1 Korintus 14.',
  ]},
  { key: 'KERASULAN', label: 'Kerasulan', verse: 'Efesus 4:11', items: [
    'Aku suka memulai hal baru: komunitas, pelayanan, atau jangkauan.',
    'Aku melihat peluang di mana orang lain hanya melihat rintangan.',
    'Aku bisa menggerakkan tim lintas kelompok untuk satu misi.',
  ]},
  { key: 'PELAYANAN', label: 'Pelayanan & Membantu', verse: '1 Korintus 12:28', items: [
    'Aku bahagia mengerjakan tugas praktis tanpa perlu sorotan.',
    'Aku cepat melihat kebutuhan orang dan langsung menolong.',
    'Pelayanan di balik layar tidak membuatku tersinggung.',
  ]},
  { key: 'ADMINISTRASI', label: 'Administrasi', verse: '1 Korintus 12:28', items: [
    'Aku rapi mengatur jadwal, anggaran, dan dokumentasi kegiatan.',
    'Orang tenang saat aku yang mengurus detail acara.',
    'Aku suka membuat sistem supaya pelayanan lebih tertata.',
  ]},
  { key: 'MEMBERI', label: 'Memberi', verse: 'Roma 12:8', items: [
    'Aku riang memberi di atas standar tanpa diumumkan.',
    'Aku peka melihat kebutuhan finansial/material orang lain.',
    'Aku mengelola penghasilanku agar bisa lebih banyak memberi.',
  ]},
  { key: 'BELAS_KASIH', label: 'Kemurahan (Belas Kasih)', verse: 'Roma 12:8', items: [
    'Hatiku terenyuh melihat orang jatuh, bukan menghakimi.',
    'Aku rela kehilangan waktu/sumber daya untuk menolong yang susah.',
    'Orang merasa aman bercerita kepadaku tentang kelemahan mereka.',
  ]},
  { key: 'KERAMAHAN', label: 'Keramahan', verse: '1 Petrus 4:9', items: [
    'Aku mudah membuat orang baru merasa diterima.',
    'Rumah/meja makanku sering menjadi tempat berkumpul.',
    'Aku ingat nama & cerita orang baru bahkan setelah sekali bertemu.',
  ]},
  { key: 'INJIL', label: 'Injil', verse: 'Efesus 4:11', items: [
    'Aku nyaman membuka topik iman kepada teman kuliah/kantor.',
    'Aku punya cara sederhana menjelaskan Injil yang mudah dipahami.',
    'Keselamatn orang di sekitarku adalah beban doaku yang utama.',
  ]},
  { key: 'GEMBALA', label: 'Gembala', verse: 'Efesus 4:11', items: [
    'Aku merasa bertanggung jawab menuntaskan pertumbuhan rohani orang-orang yang kudampingi.',
    'Aku konsisten follow-up keadaan rohani teman-temanku.',
    'Orang mau terbuka dan diajak jalan bersama olehku.',
  ]},
  { key: 'MEMIMPIN', label: 'Memimpin', verse: 'Roma 12:8', items: [
    'Saat ada kerjaan tim, aku biasanya yang mengorganisasi.',
    'Aku berani mengambil tanggung jawab atas hasil tim.',
    'Orang merasa aman mengikuti arahan yang aku berikan.',
  ]},
  { key: 'MISI', label: 'Misi', verse: 'Kisah Para Rasul 13:2', items: [
    'Aku tertarik melayani di tempat/budaya yang berbeda dari asalku.',
    'Aku berdoa & belajar tentang pekerjaan Tuhan di luar komunitasku.',
    'Perpindahan tempat bukan penghalang bagiku untuk melayani.',
  ]},
  { key: 'KESUKARELAAN_MENDERITA', label: 'Kesukarelaan Menderita', verse: '1 Petrus 4:12-14', items: [
    'Aku tetap setia melayani meski harus kehilangan kenyamanan.',
    'Tekanan/persekusi karena iman tidak membuatku mundur.',
    'Aku melihat penderitaan karena Kristus sebagai kehormatan.',
  ]},
];

/** Opsi pemetaan bakat (checkbox di profil). */
export const TALENT_OPTIONS = [
  'Musik & Vokal',
  'Desain Grafis',
  'Fotografi / Video',
  'Public Speaking',
  'Mengajar / Fasilitasi',
  'Menulis',
  'Teknologi & IT',
  'Media Sosial',
  'Manajemen Acara',
  'Keuangan',
  'Medis / First Aid',
  'Olahraga',
  'Masak / Konsumsi',
  'Kepemimpinan Tim',
];

export function scoreAnswers(answers: Record<string, number>) {
  const scores = GIFT_BANK.map((g) => ({
    key: g.key,
    label: g.label,
    verse: g.verse,
    score: g.items.reduce((sum, _item, idx) => sum + (answers[`${g.key}-${idx}`] || 0), 0),
  })).sort((a, b) => b.score - a.score);
  const top5 = scores.slice(0, 5).map((s) => ({ key: s.key, label: s.label, score: s.score }));
  return { scores, top5 };
}
