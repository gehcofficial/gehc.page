/**
 * Seed katalog Pola Ibadah (Didaskalia) + sesi Mentoring Day 4 Okt 2026.
 * Idempotent: pola di-upsert per `code`; sesi dibuat sekali (per `slug`).
 *
 * Setiap playbook memakai template baku 7 bagian agar sedetil Post-to-Post:
 * 1. Identitas & Tujuan Teologis — 2. Pra-acara — 3. Rundown — 4. Naskah siap baca
 * 5. Modul web & konfigurasi sesi — 6. Peran & personil — 7. Adaptasi tema & firman.
 * Slot adaptasi mingguan: {{tema}}, {{firman_ref}}, {{firman_text}}, {{kitab_fokus}}.
 *
 * Jalankan: npm run db:seed:worship[:staging|:prod]
 */
require('dotenv').config();
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const uid = (p) => `${p}-${crypto.randomUUID()}`;

const POST_TO_POST_PLAYBOOK = `# Post-to-Post (Mentoring Day)

## 1. Identitas & Tujuan Teologis
**Nama:** Post-to-Post (Mentoring Day). **Durasi baku:** 60 menit (varian padat 45 menit: potong monolog jadi 10 menit).
**Tujuan:** Injil mengubahkan realita keseharian — jemaat datang dengan pergumulan nyata (Hubungan, Pekerjaan/Kuliah, Keluarga), pulang dengan solusi teologis + langkah praktis.
**Ayat jangkar default:** 1 Korintus 15:3-4. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).

## 2. Pra-acara (H-7 s/d H-1)
1. Didaskalia menyiapkan 3 pertanyaan Likert per topik di panel Pola Ibadah (total 9, skala 1-5) — sesuaikan redaksi dengan {{tema}}.
2. Siapkan 3 ruang pos (default Lantai 2/1/3, kapasitas cek via master Tempat Pos) + timer layar + kertas catatan.
3. Jemaat mengisi Likert lewat web sebelum sesi dimulai (form di-unlock panitia via kontrol: Buka Akses Likert).
4. Alokasi ruangan otomatis dari ranking kerentanan topik: rank 1 = ruang terbesar, rank 2 = sedang, rank 3 = kecil.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Praise & Worship | 10 | Liturgia | Buka dengan 2 lagu syukur yang mengarah ke {{tema}} |
| 2 | Monolog | 15 | Main Speaker (Didaskalia) | Injil bukan sekadar tiket ke surga, tetapi solusi {{tema}} berdasar {{firman_ref}} |
| 3 | Briefing aturan main | 2 | Main Speaker | Total 20 menit; bebas pindah pos bila concern terjawab 5-6 menit |
| 4 | Post-to-Post (3 pos serentak) | 20 | PIC pos | Jabarkan solusi teologis + praktis per Likert; buka tanya jawab; dorong catatan individu |
| 5 | Wrap-up & Lesson Learned | 10 | MC | Kembali ke ruang utama; pilih Chip Words (maks 3); doa penutup |

## 4. Naskah siap baca
**Monolog (15 menit):** "Selamat pagi, Beyonders. Hari ini {{tema}}. Firman Tuhan berkata: {{firman_text}} ({{firman_ref}}). Injil bukan sekadar tiket ke surga — ia menjawab pergumulan Hubungan, Pekerjaan, dan Keluarga kita hari ini. Dengarkan, lalu pilih pos yang paling Tuhan ketuk di hatimu."
**Briefing (2 menit):** "Waktunya 20 menit total. Kamu bebas mengatur mobilitas. Kalau concern di satu pos sudah terjawab dalam 5-6 menit, pindah ke pos berikutnya. Tulis catatanmu — ini bekal doamu minggu ini."
**PIC pos:** "Di pos ini kita jawab hasil Likert kalian. Saya jabarkan dulu solusi dari {{firman_ref}}, lalu silakan tanya. Tidak ada pertanyaan bodoh — tulis satu komitmen sebelum pindah."
**Wrap-up:** "Kembali ke ruangan utama. Pilih maksimal 3 chip kata yang paling menggambarkan pelajaranmu hari ini, lalu kita tutup dengan doa."

## 5. Modul web & konfigurasi sesi
Modul: likert, rooms, timer, notes, chips, wordcloud. Contoh config sesi:
- timerSeconds: 1200 (20 menit Post-to-Post). rankFloors: [2,1,3].
- topics: [{code,label,pic}] + affirmations per topik + chipLimit: 3.
- Layar proyektor: #/mentoring/<slug>/layar (akses kode sesi). Kontrol: #/mentoring/<slug>/kontrol.

## 6. Peran & personil
- Main Speaker (1, Didaskalia): monolog + briefing + wrap-up teologis.
- PIC pos (3, mentor/co-mentor): kuasai data Likert posnya, jaga waktu 20 menit untuk banyak orang.
- MC + operator timer/layar (1-2): hitung mundur, trigger wrapup.
- Rasio mentor:mentee per pos maks 1:8. Gladi H-1: uji Likert → alokasi ruang → timer.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}} dengan tema pekan, {{firman_ref}}/{{firman_text}} dengan nats pembimbing, {{kitab_fokus}} dengan bacaan.
2. Tulis ulang 9 Likert: 3 per topik, tiap butir cerminkan satu sisi {{tema}} (contoh pola kalimat: "Saya merasa ..." + gospel_note: solusi dari {{firman_ref}}).
3. Sesuaikan 12 chip words + 3 afirmasi per topik dengan kosakata {{tema}}.
4. Cek ulang alokasi ruang: rank 1 selalu ruang terbesar minggu itu.`;

const DUAL_MONOLOG_PLAYBOOK = `# Dual Monolog — The Awakening of Depravity

## 1. Identitas & Tujuan Teologis
**Nama:** Dual Monolog. **Durasi baku:** 120 menit (varian padat 90 menit: bedah lagu 15 menit + deep sharing 25 menit).
**Tujuan:** Menyadarkan dua wajah keterpurukan — tersesat di luar (pemberontakan terbuka) dan tersesat di dalam rumah Bapa (pelayanan tanpa cinta mula-mula) — lalu memanggil pulang kepada kasih Bapa yang tidak berbasis performa.
**Ayat jangkar default:** Lukas 15:11-32. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).

## 2. Pra-acara (H-7 s/d H-1)
1. Tunjuk 2 speaker (A rapi + B kusut) + 1 pemusik keys/synth + 1 operator lighting. Gladi blocking minimal 1 kali.
2. Siapkan properti: Speaker B (tas ransel, pakaian kerja kusut), Speaker A (Alkitab/notebook, pakaian rapi). Playlist: low synth pad monoton (Bagian 1), musik kaku/dingin (Bagian 2), piano warm block chords (Bagian 3).
3. Cetak panduan pembacaan berbalasan {{firman_ref}} (ayat dibagi per kelompok, ayat terakhir Speaker B) + lirik lagu bedah + 2 pertanyaan deep sharing.
4. Bagi kelompok deep sharing (maks 8 orang, 1 mentor per kelompok). Mentor siapkan kesaksian pembuka 2 menit.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Praise & Bedah Lagu | 25 | Main Speaker + Liturgia | Nyanyi 1 bait → bedah makna teologis → lanjut bait ({{tema}}) |
| 2 | Dual Monolog + pembacaan berbalasan | 25 | Speaker A & B | Outer Exile 5 menit + Inner Exile 5 menit + konvergensi {{firman_ref}} 15 menit |
| 3 | Deep Sharing kelompok | 40 | Mentor | Mentor buka dulu; game Satu Kata; 2 pertanyaan wajib; zero judgment |
| 4 | Persembahan & doa berkat | 10 | Main Speaker | Panggilan pulang + doa (cadangan dari durasi 120 menit) |

## 4. Naskah siap baca
**Bagian 1 — The Outer Exile / Speaker B (menit 00:00-05:00, low synth pad):** "Jam 6 pagi kereta, jam 9 KPI, jam 11 lembur. Aku hafal semua target — tapi kapan terakhir aku sadar Tuhan hadir? Aku tersesat di luar sana. Rutinitasku jalan, hatiku hilang. {{tema}} menamparku: aku jauh, dan aku tahu aku jauh."
**Bagian 2 — The Inner Exile / Speaker A (menit 05:00-10:00, musik kaku):** "Aku tidak pernah absen pelayanan. Alkitabku penuh stabilo. Tapi tadi malam aku sadar: aku melayani tanpa cinta mula-mula. Aku tersesat di dalam rumah Bapa sendiri. {{firman_text}} — itu tentang aku."
**Bagian 3 — Konvergensi (menit 10:00-25:00, piano warm, keduanya sejajar):** "Solusinya satu kata: Pulang. Bukan karena kita sudah cukup baik — karena Bapa sudah lebih dulu berlari. {{firman_ref}} dibaca berbalasan: ayat ganjil kelompok kiri oleh Speaker A, ayat genap kelompok kanan, ayat terakhir kita baca bersama dipimpin Speaker B. Kasih Bapa tidak tergantung performansmu minggu ini."
**Bedah lagu (10 menit dalam segmen 1):** "Kita nyanyikan bait 1 — berhenti — apa arti baris ini dalam terang {{firman_ref}}? Baru lanjut bait 2. Menyanyi dengan kesadaran, bukan otomatisasi."
**Deep sharing (mentor membuka):** "Minggu ini satu kataku: Lelah. Aku pun pernah jadi anak bungsu/sulung dalam {{tema}}. Sekarang giliranmu — satu kata untuk minggumu, lalu 2 pertanyaan wajib kita."

## 5. Modul web & konfigurasi sesi
Modul: timer, notes. Timer layar dipakai untuk 3 blok (25/25/40). Notes: 2 pertanyaan pendalaman wajib + kolom komitmen pulang (diisi mentor di kontrol, diekspor CSV). Tidak perlu Likert/rooms.

## 6. Peran & personil
- Speaker A & B (2, Didaskalia): hafal naskah + blocking; jangan improv melebihi 1 menit.
- Pemusik + lighting (2): eksekusi 3 cue musik/lampu tepat waktu.
- Mentor kelompok (1 per 8 jemaat): buka diri dulu maksimal 2 menit, jaga zero judgment, jangan potong tangisan.
- MC: jaga transisi Bagian 2 → 3 tanpa tepuk tangan di tengah (hening 10 detik).

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}} dan {{firman_ref}}; petakan dua wajah tema ke A (inner exile) dan B (outer exile).
2. Tulis ulang 2 pertanyaan deep sharing: Q1 observasi teks ("Di mana kamu melihat dirimu dalam {{firman_ref}}?"), Q2 aplikasi ("Langkah pulang apa minggu ini dalam {{tema}}?").
3. Pilih 1 lagu yang liriknya memuat kosakata {{tema}} untuk dibedah.
4. Sesuaikan properti/kostum dengan dunia Beyonders pekan itu (kampus: tas + laptop; kerja: seragam shift).`;

const DEBAT_PLAYBOOK = `# Debat — The Battle of Minds

## 1. Identitas & Tujuan Teologis
**Nama:** Debat — The Battle of Minds. **Durasi baku:** 140 menit (5 ronde x 20 menit + pembuka 10 + konklusi 20 + persembahan 10; varian 3 ronde = 100 menit).
**Tujuan:** Melatih berpikir teologis di bawah tekanan waktu — lalu membongkar bahwa mosi-mosi yang diperdebatkan adalah dikotomi palsu. Jawabannya: {{tema}} dalam terang {{firman_ref}}.
**Ayat jangkar default:** Ibrani 10:25. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).

## 2. Pra-acara (H-7 s/d H-1)
1. Siapkan 3-5 mosi dari {{tema}} (pola dikotomi palsu: "X vs Y" yang keduanya benar sebagian). Contoh bawaan (ganti sesuai tema): Spiritualitas pribadi vs komunitas; Karier melesat vs kehadiran fisik ibadah; Ibadah online fokus vs hadir fisik terdistraksi; Kesehatan mental vs ketaatan komunitas; Cuti pelayanan demi pemulihan vs bertahan demi komitmen.
2. Bentuk tim: delegasi 3 orang per tim (1 Mentor + 2 Mentee), tentukan PRO vs KONTRA per ronde via undian H-1.
3. Siapkan layar timer raksasa + buzzer + lembar juri (argumen biblika 40, logika 30, teamwork 20, etika 10) + kotak HP (karantina digital).
4. Briefing juri (2-3 orang Didaskalia) dan moderator: netral, tidak boleh bocorkan Trap Reveal sebelum konklusi.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Opening & nyanyian singkat | 10 | Main Speaker | Doa + baca {{firman_ref}} + aturan emas |
| 2 | 5 ronde debat | 100 | Moderator | Per ronde 20 menit, template 11 slide (lihat Bagian 4) |
| 3 | Persembahan & transisi musik | 10 | Main Speaker | Hening + persembahan sambil juri rekap |
| 4 | Konklusi teologis | 20 | Main Speaker | Validasi → Trap Reveal → {{firman_ref}} → panggilan |

## 4. Naskah siap baca
**Aturan emas (dibacakan Moderator, tidak boleh diubah intinya):** "Satu: delegasi 3 orang per tim — 1 Mentor, 2 Mentee. Dua: karantina HP — HP dan AI hanya boleh saat 4 menit persiapan; setelah pemaparan dimulai HP diletakkan; membaca dari HP berarti argumen tidak dinilai. Tiga: kekuasaan mutlak timer — saat 00:00 dan buzzer bunyi, mic saya interupsi. Tanpa tambahan waktu."
**Template per ronde (20 menit, 11 slide):** 1 The Reveal mosi + PRO vs KONTRA 1 menit Moderator; 2 Brainstorming & AI Strategy 4 menit (3 PRO & 3 KONTRA); 3 Pemaparan PRO 4 menit; 4 Pemaparan KONTRA 4 menit; 5 Sanggahan 1 PRO 1 menit; 6 Sanggahan 1 KONTRA 1 menit; 7 Sanggahan 2 PRO utamakan Mentee 1 menit; 8 Sanggahan 2 KONTRA 1 menit; 9 Final Blow PRO 1 menit; 10 Final Blow KONTRA 1 menit; 11 Jeda & transisi 1 menit.
**Sanggahan kedua (ingatkan tiap ronde):** "Sanggahan kedua wajib utamakan suara Mentee — mentor menahan diri."
**Konklusi — Trap Reveal (20 menit):** "Lima ronde, sepuluh tim, semua argumen bagus — dan semuanya kena jebakan. Setiap mosi tadi adalah dikotomi palsu. Firman berkata: {{firman_text}} ({{firman_ref}}). Dalam {{tema}}, jawabannya bukan pilih satu sisi — melainkan saling menasihati dan menghancurkan dikotomi itu. Minggu ini, siapa yang akan kamu nasihati?"

## 5. Modul web & konfigurasi sesi
Modul: rounds, timer, teams (rounds/teams tampil sebagai tabel statik + timer manual sampai modul interaktif tersedia). Contoh config sesi per ronde: {mosi, proTim, kontraTim, timerDetik: [60,240,240,240,60,60,60,60,60,60,60]}. Timer layar raksasa wajib terlihat kedua tim. Ekspor CSV: skor juri per ronde.

## 6. Peran & personil
- Moderator (1, Didaskalia): netral, tegas memotong mic tepat 00:00, hafal 11 slide.
- Juri (2-3): nilai dengan lembar baku, tidak komentar sebelum konklusi.
- Main Speaker konklusi (1): siapkan Trap Reveal + aplikasi {{tema}} 3 kalimat.
- Operator timer/buzzer/layar (1): uji buzzer H-1; siapkan cadangan stopwatch.
- Peserta: tiap tim 3 orang; penonton boleh bersorak, tidak boleh meneriakkan argumen.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}/{{firman_ref}}; tulis 3-5 mosi baru dari pergumulan nyata Beyonders seputar {{tema}} (rumus: "A yang baik vs B yang baik" — keduanya didukung sebagian ayat).
2. Siapkan Trap Reveal 1 paragraf: tunjukkan kedua sisi mosi runtuh di hadapan {{firman_text}}.
3. Sesuaikan bobot juri bila tema lebih pastoral (naikkan etika) atau doktrinal (naikkan argumen biblika).
4. Batasi 3 ronde bila waktu hanya 100 menit — pilih 3 mosi paling dekat dengan {{tema}}.`;

const BEDAH_FILM_PLAYBOOK = `# Bedah Film — Dropping the Filter

## 1. Identitas & Tujuan Teologis
**Nama:** Bedah Film. **Durasi baku:** 145 menit (film 91 menit + diskusi 40 menit; varian film pendek 60 menit = total 115 menit).
**Tujuan:** Membuka topeng kesalehan (fake holiness, Christianese) — syarat menjadi murid adalah otentik di hadapan Tuhan dan sesama, seperti api & Roh dalam {{firman_ref}}, bukan sekadar jubah luar.
**Ayat jangkar default:** 2 Raja-raja 2:1-15. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}). Film default: The Resurrection of Gavin Stone (91 menit); boleh diganti film lain yang memuat isu {{tema}}.

## 2. Pra-acara (H-7 s/d H-1)
1. Konfirmasi lisensi pemutaran + uji proyektor/sound/subtitle + lampu redup + kursi melingkar untuk pleno.
2. Siapkan panduan pleno (2-3 perwakilan campuran Mentor/Mentee) + 3 pertanyaan deep sharing dari {{tema}} + tisu + gitar/piano untuk transisi.
3. Briefing mentor: mulai duluan, jangan potong tangisan, tutup dengan saling mendoakan. Tonton film minimal 1 kali + catat 3 adegan kunci yang paralel dengan {{firman_ref}}.
4. Cetak sinopsis 1 paragraf tanpa spoiler + ayat {{firman_ref}} untuk dibagikan saat pengantar.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Opening + praise singkat + doa | 10 | Liturgia + MC | Doa + baca {{firman_ref}} 1 menit |
| 2 | Pengantar film | 5 | Main Speaker | Sinopsis tanpa spoiler + jembatan ke {{tema}} |
| 3 | Pemutaran film | 91 | Multimedia | Lampu redup, HP silent, tidak ada komentar |
| 4 | Transisi emosional | 4 | Pemusik | Piano/gitar, lampu separuh, hening |
| 5 | Pleno analisa film | 15 | MC | 2-3 suara + pancingan {{tema}} |
| 6 | Team discussion / deep sharing | 25 | Mentor | 3 pertanyaan wajib {{tema}} |
| 7 | Doa persembahan & kolekte | 5 | Main Speaker | Doa sambil musik lembut |
| 8 | Konklusi teologis & doa berkat | 10 | Main Speaker | Api & Roh vs jubah luar + panggilan otentik |

## 4. Naskah siap baca
**Pengantar (5 menit, tanpa spoiler):** "Malam ini kita menonton kisah seorang yang memakai topeng kesalehan demi bertahan hidup. Jangan cari siapa orangnya — cari dirimu. Ayat kita: {{firman_text}} ({{firman_ref}}). Tema kita {{tema}}. Selama 91 menit, izinkan Roh menyorot filter yang kamu pakai minggu ini."
**Transisi emosional (4 menit):** (musik lembut, lampu separuh) "Tahan dulu komentar. Tarik napas. Biarkan adegan terakhir mengendap. Kalau matamu panas — tidak apa-apa. Tuhan sedang bekerja."
**Pleno (15 menit, pancingan wajib):** "Karakter siapa yang paling bikin kamu tertampar, dan kenapa? Hubungkan dengan {{firman_ref}} — di mana letak topengmu dalam {{tema}} minggu ini?"
**Deep sharing (25 menit, 3 pertanyaan wajib — sesuaikan redaksi dengan {{tema}}):** Q1 "Kapan terakhir kamu berakting suci agar diterima?" Q2 "Topeng apa yang paling berat kamu pakai dalam {{tema}}?" Q3 "Apa arti {{firman_ref}} bagimu: api & Roh, bukan sekadar jubah — langkah otentik apa minggu ini?"
**Konklusi (10 menit):** "Elisa tidak meminta jubah Elia — ia meminta api dan Roh. Jubah bisa dipalsukan; kuasa tidak. Lepaskan filter. Jadilah murid yang otentik dalam {{tema}} — mulai dari kelompok kecilmu malam ini."

## 5. Modul web & konfigurasi sesi
Modul: screening, timer, notes. Config sesi: {filmJudul, durasiDetik, subtitleBahasa, 3 adeganKunci:[{menit, catatan}], pancinganPleno, qDeepSharing:[3]}. Timer layar untuk segmen 4-8. Notes: komitmen "topeng yang kulepas minggu ini" (opsional anonim, ekspor CSV).

## 6. Peran & personil
- Main Speaker (1): pengantar + konklusi, kuasai paralel film ↔ {{firman_ref}}.
- Multimedia (1-2): proyektor, sound, subtitle, cadangan laptop + kabel HDMI + hotspot.
- MC pleno (1): pilih 2-3 suara campuran Mentor/Mentee, jaga waktu 15 menit.
- Mentor (1 per 8): pimpin deep sharing, mulai duluan, jangan menghakimi.
- Pemusik (1): 4 menit transisi + latar doa, volume rendah.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}/{{firman_ref}}; bila film default kurang cocok, pilih film lain (60-95 menit) yang isu sentralnya = {{tema}} dan tulis 3 adegan paralel baru.
2. Tulis ulang 3 pertanyaan deep sharing dari kosakata {{tema}} (rumus Q1 masa lalu, Q2 masa kini, Q3 langkah).
3. Siapkan pancingan pleno cadangan bila jemaat diam 30 detik: "Adegan [X] mengingatkanku pada {{firman_ref}} bagian [...] — ada yang merasakan hal sama?"
4. Cek durasi total: film + 54 menit bingkai. Potong 1 lagu bila film melebihi 95 menit.`;

const THREE_SEQUENCES_PLAYBOOK = `# The 3 Sequences — Grand Finale (Coram Deo Challenge)

## 1. Identitas & Tujuan Teologis
**Nama:** The 3 Sequences (Grand Finale). **Durasi baku:** 120 menit (tanpa jeda antar sequence — energi terus naik).
**Tujuan:** Mengubah 9-to-5 menjadi altar — Melayani (mencair), Bersekutu (firman sebagai kompas), Bersaksi (keluar sebagai utusan). Ditutup commissioning: dari peserta menjadi utusan {{tema}}.
**Ayat jangkar default:** Matius 28:19-20. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).

## 2. Pra-acara (H-7 s/d H-1)
1. Siapkan snack Rp5.000 per orang + 2 amplop studi kasus dari {{tema}} + puzzle ayat {{firman_ref}} + yel-yel + template video CapCut + 2 HP cadangan.
2. Bentuk 2 kelompok besar (contoh 8+8=16): Subteam 1 (11 orang, Lantai 2) + Subteam 2 (5 orang, Lantai 1). Tunjuk The Runner (1, cepat + hafal) dan The Validator (1, teliti).
3. Uji rute lari Lantai 2 → Lantai 1 + bisikan 1x + validasi ke Main Speaker. Siapkan hadiah amplop + countdown layar 30 menit.
4. Briefing 5 tim Mission Room: Soal (3), Eksekusi Lapangan (5), Narasi (3), Presentasi (2), Editor (3). Minta izin lokasi wawancara warga non-GEHC.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Opening & praise | 10 | Main Speaker | Doa + {{firman_ref}} + aturan tanpa jeda |
| 2 | Sequence 1 — Snack & Merge | 10 | Main Speaker | Tukar snack 3 menit + yel-yel misi 7 menit |
| 3 | Sequence 2 — Kode Alkitab | 15 | Mentor | Sandi → pass message → Runner → puzzle → Validator |
| 4 | Sequence 3 — Mission Room paralel | 30 | Tim | Countdown layar; 5 tim kerja serentak |
| 5 | Presentasi hasil | 20 | MC | Maks 4 menit per tim |
| 6 | Khotbah penutup & persembahan | 15 | Main Speaker | {{tema}} + {{firman_ref}} |
| 7 | Commissioning & Declaration | 15 | Mentor | Penumpangan tangan + doa personal + deklarasi |

## 4. Naskah siap baca
**Opening:** "Hari ini tidak ada jeda — tiga sequence, satu misi: {{tema}}. Firman-Nya: {{firman_text}} ({{firman_ref}}). Dari jam 9 sampai jam 5 hidupmu adalah rutinitas — hari ini rutinitas itu jadi altar. Siap?"
**Sequence 1 (10 menit):** "Tukar snack Rp5.000 dengan orang yang belum kamu kenal — 3 menit, kenalan kilat: nama + satu pergumulan {{tema}}. Lalu 7 menit: rumuskan Yel-Yel Misi kelompokmu dari {{firman_ref}} — teriakkan serentak sekeras-kerasnya!"
**Sequence 2 (15 menit):** "Subteam 1 pecahkan sandi → bisikkan berantai 1 kali saja → Runner lari ke Lantai 1 → Subteam 2 susun puzzle ayat → Validator bawa ke saya. Benar = Amplop Studi Kasus + telepon rekan di Lantai 2 sebagai penanda Sequence 3 dimulai!"
**Sequence 3 (30 menit, countdown):** "Lima tim jalan serentak. Tim Soal rumuskan 2-3 pertanyaan dari amplop {{tema}}. Tim Lapangan wawancara warga — kirim video via WA. Tim Narasi kaitkan dengan {{firman_ref}}. Tim Presentasi siapkan pitching 4 menit. Tim Editor potong video di CapCut. Timer jalan — tidak ada waktu tambahan!"
**Presentasi (20 menit):** "Maksimal 4 menit per tim. Yang lain dengar, catat, beri satu apresiasi."
**Commissioning (15 menit):** "Kita tutup berlutut. Mentor tumpangkan tangan dan doakan personal 1 menit per orang. Lalu deklarasikan bersama: 'Di hadapan Allah — Coram Deo — kerja dan kuliahku adalah mezbah {{tema}}. Aku diutus!'"

## 5. Modul web & konfigurasi sesi
Modul: teams, timer, notes. Config sesi: {kelompokBesar:[{nama,anggota,lantai}], subteam:{satu,dua}, runner, validator, amplopStudiKasus:[2], timMissionRoom:{soal,lapangan,narasi,presentasi,editor}, countdownDetik:1800}. Timer layar raksasa untuk Sequence 3. Notes: live report per tim + ekspor CSV.

## 6. Peran & personil
- Main Speaker (1): komando 3 sequence, validasi puzzle, khotbah penutup.
- Mentor lantai (2): dampingi Subteam 1 & 2, jaga keamanan rute lari.
- Runner + Validator (2): latih khusus H-1 (hafalan + ketelitian).
- 5 tim Mission Room (16 orang contoh): ketua tim masing-masing pegang checklist.
- Operator countdown + sound (1): countdown 30 menit + backsound naik per 10 menit.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}/{{firman_ref}}; tulis 2 amplop studi kasus baru dari kasus nyata Beyonders seputar {{tema}} (1 paragraf kasus + 2 pertanyaan + ayat penuntun).
2. Buat sandi Kode Alkitab dari {{firman_ref}} (contoh: nomor ayat jadi kode angka) dan puzzle dari teks {{firman_text}} yang dipotong 5-7 bagian.
3. Sesuaikan yel-yel: wajib memuat 1 kata dari {{tema}} + 1 frasa dari {{firman_ref}}.
4. Atur ulang komposisi tim bila kehadiran di bawah 12 orang: gabung Narasi+Presentasi, Lapangan minimal 3 orang.`;

const MONOLOG_PLAYBOOK = `# Monolog & FGD (Standar)

## 1. Identitas & Tujuan Teologis
**Nama:** Monolog & FGD (Standar). **Durasi baku:** 90 menit (varian lengkap 110 menit: FGD 50 menit; varian padat 70 menit: monolog 20 + FGD 25).
**Tujuan:** Menyampaikan eksposisi utuh {{tema}} dari {{firman_ref}} dalam satu suara yang jelas, lalu mengendapkannya lewat diskusi kelompok kecil (observasi → interpretasi → aplikasi).
**Ayat jangkar:** {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).
Pola default bila pekan tidak memilih pola khusus. Cocok untuk tema doktrinal yang perlu penyampaian utuh sebelum diskusi.

## 2. Pra-acara (H-7 s/d H-1)
1. Main Speaker siapkan naskah monolog 25-35 menit dari {{firman_ref}} (struktur: teks → konteks → 2-3 poin → aplikasi {{tema}} → panggilan).
2. Didaskalia siapkan panduan FGD (1 lembar per kelompok): 1 pertanyaan observasi + 1 interpretasi + 1 aplikasi dari {{tema}} + kolom komitmen.
3. Bagi kelompok 5-8 orang (1 mentor per kelompok) + siapkan ruang yang memungkinkan 35 menit diskusi tanpa gangguan.
4. Uji sound/proyektor untuk 3-5 slide poin khotbah (tanpa teks panjang di slide).

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Praise & Worship | 15 | Liturgia | 2-3 lagu mengarah ke {{tema}} + doa pembuka |
| 2 | Monolog khotbah | 30 | Main Speaker (Didaskalia) | Eksposisi {{firman_ref}} → aplikasi {{tema}} → panggilan |
| 3 | Briefing FGD | 3 | Main Speaker | Bagi kelompok, bagikan panduan, jelaskan 3 langkah |
| 4 | FGD kelompok | 35 | Mentor | Observasi → interpretasi → aplikasi; tutup komitmen & doa |
| 5 | Persembahan & doa berkat | 10 | Main Speaker | Ayat penutup {{firman_ref}} + berkat |

## 4. Naskah siap baca
**Pembuka ibadah:** "Selamat pagi, Beyonders. Hari ini kita merenungkan {{tema}} dari {{firman_ref}}. Mari siapkan hati — Tuhan akan berbicara dahulu, baru kita menanggapi."
**Transisi khotbah → FGD (3 menit, jangan dilewatkan):** "Firman sudah diberitakan: {{firman_text}}. Sekarang Firman itu harus mengendap lewat mulutmu sendiri. Bagi ke kelompok 5-8 orang. Tiga langkah: pertama amati — apa kata teks? Kedua pahami — apa artinya dalam {{tema}}? Ketiga terapkan — apa langkahmu minggu ini? Tulis satu komitmen sebelum berdoa tutup."
**Panduan mentor FGD:** "Mulai dengan doa 1 menit. Observasi 10 menit (baca {{firman_ref}} bersama, tandai kata kerja). Interpretasi 10 menit (kaitkan dengan {{tema}} + kitab {{kitab_fokus}}). Aplikasi 10 menit (tiap orang sebut 1 langkah + 1 pergumulan). Tutup 5 menit: komitmen + doa saling mendoakan."
**Penutup:** "Kita sudah mendengar dan saling menguatkan. Bawa komitmenmu keluar pintu ini. {{firman_ref}} menjadi bekal {{tema}}-mu minggu ini."

## 5. Modul web & konfigurasi sesi
Modul: timer, notes. Timer layar untuk monolog (30) + FGD (35) dengan peringatan 5 menit terakhir. Notes: panduan FGD digital + kolom komitmen per anggota (ekspor CSV untuk follow-up mentor).

## 6. Peran & personil
- Main Speaker (1, Didaskalia): kuasai naskah + 3-5 slide poin, jaga waktu 30 menit.
- Mentor (1 per 5-8 jemaat): fasilitasi 3 langkah, pastikan semua bersuara, jaga waktu.
- Liturgia + Multimedia (2-3): 2-3 lagu + slide + timer.
- Usher (1-2): bagi kelompok cepat (< 3 menit) sesuai denah yang sudah disiapkan.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}/{{firman_ref}}/{{kitab_fokus}}; turunkan 3 pertanyaan FGD dari teks (jangan generik): observasi harus menunjuk kata/frasa spesifik {{firman_ref}}.
2. Pilih 2-3 ilustrasi dunia Beyonders (KRS/tugas/skripsi/magang; shift/lembur/target; kos/keuangan/relasi) yang memuat {{tema}}.
3. Tulis panggilan 2 kalimat di akhir monolog yang menyebut respons spesifik terhadap {{tema}} minggu ini.
4. Sesuaikan durasi: tema doktrinal berat → monolog 35 + FGD 40; tema aplikatif → monolog 25 + FGD 35 + kesaksian 5 menit.`;

const PATTERNS = [
  {
    code: 'MONOLOG',
    name: 'Monolog & FGD (Standar)',
    summary:
      'Pola default: khotbah monolog sentral + FGD kelompok (observasi → interpretasi → aplikasi).',
    defaultDurationMin: 90,
    modules: ['timer', 'notes'],
    phases: [
      { no: 1, title: 'Praise & Worship', minutes: 15, owner: 'Liturgia', notes: 'Buka dengan 2-3 lagu yang mengarah ke tema pekan.' },
      { no: 2, title: 'Monolog khotbah', minutes: 30, owner: 'Main Speaker (Didaskalia)', notes: 'Eksposisi firman pekan + aplikasi tema + panggilan.' },
      { no: 3, title: 'Briefing FGD', minutes: 3, owner: 'Main Speaker', notes: 'Bagi kelompok + bagikan panduan 3 langkah.' },
      { no: 4, title: 'FGD kelompok', minutes: 35, owner: 'Mentor', notes: 'Observasi 10 mnt, interpretasi 10 mnt, aplikasi 10 mnt, komitmen + doa 5 mnt.' },
      { no: 5, title: 'Persembahan & doa berkat', minutes: 10, owner: 'Main Speaker', notes: 'Ayat penutup + berkat.' },
    ],
    playbook: MONOLOG_PLAYBOOK,
    sortOrder: 5,
  },
  {
    code: 'POST_TO_POST',
    name: 'Post-to-Post (Mentoring Day)',
    summary:
      'Monolog singkat + jemaat berpindah pos sesuai kebutuhan. Didukung modul web: Likert, alokasi ruang, timer, catatan, chip words, word cloud.',
    defaultDurationMin: 60,
    modules: ['likert', 'rooms', 'timer', 'notes', 'chips', 'wordcloud'],
    phases: [
      { no: 1, title: 'Praise & Worship', minutes: 10, owner: 'Liturgia', notes: 'Buka dengan 2 lagu syukur yang mengarah ke tema.' },
      { no: 2, title: 'Monolog', minutes: 15, owner: 'Main Speaker (Didaskalia)', notes: 'Injil sebagai solusi praktis pergumulan Hubungan/Pekerjaan/Keluarga.' },
      { no: 3, title: 'Briefing aturan main', minutes: 2, owner: 'Main Speaker', notes: 'Total 20 menit; bebas pindah pos bila concern terjawab 5-6 menit.' },
      { no: 4, title: 'Post-to-Post (3 pos serentak)', minutes: 20, owner: 'PIC pos', notes: 'Solusi teologis + praktis per Likert; tanya jawab; catatan individu.' },
      { no: 5, title: 'Wrap-up & Lesson Learned', minutes: 10, owner: 'MC', notes: 'Kembali ke ruang utama; pilih chip words maks 3; doa penutup.' },
    ],
    playbook: POST_TO_POST_PLAYBOOK,
    sortOrder: 10,
  },
  {
    code: 'DUAL_MONOLOG',
    name: 'Dual Monolog',
    summary: 'Drama monolog-dialogis 2 speaker (anak bungsu vs anak sulung) + bedah lagu + deep sharing.',
    defaultDurationMin: 120,
    modules: ['timer', 'notes'],
    phases: [
      { no: 1, title: 'Praise & Bedah Lagu', minutes: 25, owner: 'Main Speaker', notes: 'Nyanyi 1 bait, bedah makna teologis, lanjut bait berikutnya.' },
      { no: 2, title: 'Dual Monolog + pembacaan berbalasan', minutes: 25, owner: 'Main Speaker', notes: 'Outer Exile 5 mnt + Inner Exile 5 mnt + konvergensi firman 15 mnt.' },
      { no: 3, title: 'Deep Sharing kelompok', minutes: 40, owner: 'Mentor', notes: 'Mentor buka dulu 2 mnt; Satu Kata; 2 pertanyaan wajib; zero judgment.' },
      { no: 4, title: 'Persembahan & doa berkat', minutes: 10, owner: 'Main Speaker', notes: 'Panggilan pulang + doa (bagian dari 120 menit).' },
    ],
    playbook: DUAL_MONOLOG_PLAYBOOK,
    sortOrder: 20,
  },
  {
    code: 'DEBAT',
    name: 'Debat — The Battle of Minds',
    summary: '5 ronde × 20 menit, timer mutlak, karantina HP, konklusi teologis membongkar dikotomi palsu.',
    defaultDurationMin: 140,
    modules: ['rounds', 'timer', 'teams'],
    phases: [
      { no: 1, title: 'Opening & nyanyian singkat', minutes: 10, owner: 'Main Speaker', notes: 'Doa + baca firman pekan + bacakan aturan emas.' },
      { no: 2, title: '5 ronde debat', minutes: 100, owner: 'Moderator', notes: 'Per ronde 20 mnt, 11 slide; sanggahan kedua utamakan Mentee.' },
      { no: 3, title: 'Persembahan & transisi musik', minutes: 10, owner: 'Main Speaker', notes: 'Hening + persembahan sambil juri rekap skor.' },
      { no: 4, title: 'Konklusi teologis', minutes: 20, owner: 'Main Speaker', notes: 'Validasi, Trap Reveal dikotomi palsu, panggilan dari firman pekan.' },
    ],
    playbook: DEBAT_PLAYBOOK,
    sortOrder: 30,
  },
  {
    code: 'BEDAH_FILM',
    name: 'Bedah Film',
    summary: 'Pemutaran film + pleno analisa + deep sharing identitas & topeng.',
    defaultDurationMin: 145,
    modules: ['screening', 'timer', 'notes'],
    phases: [
      { no: 1, title: 'Opening + praise + pengantar', minutes: 15, owner: 'Main Speaker', notes: 'Sinopsis tanpa spoiler + jembatan ke tema pekan.' },
      { no: 2, title: 'Pemutaran film', minutes: 91, owner: 'Multimedia', notes: 'Lampu redup, HP silent, tanpa komentar selama film.' },
      { no: 3, title: 'Pleno analisa film', minutes: 15, owner: 'MC', notes: '2-3 suara campuran Mentor/Mentee + pancingan tema.' },
      { no: 4, title: 'Team discussion / deep sharing', minutes: 25, owner: 'Mentor', notes: '3 pertanyaan wajib: akting suci, topeng terberat, langkah otentik.' },
      { no: 5, title: 'Persembahan + konklusi + doa berkat', minutes: 15, owner: 'Main Speaker', notes: 'Api & Roh vs jubah luar + panggilan otentik.' },
    ],
    playbook: BEDAH_FILM_PLAYBOOK,
    sortOrder: 40,
  },
  {
    code: 'THREE_SEQUENCES',
    name: 'The 3 Sequences (Grand Finale)',
    summary: 'Gamifikasi misi tanpa jeda: Melayani → Bersekutu → Bersaksi, ditutup Commissioning.',
    defaultDurationMin: 120,
    modules: ['teams', 'timer', 'notes'],
    phases: [
      { no: 1, title: 'Opening & praise', minutes: 10, owner: 'Main Speaker', notes: 'Doa + firman pekan + aturan tanpa jeda.' },
      { no: 2, title: 'Sequence 1 — Snack & Merge', minutes: 10, owner: 'Main Speaker', notes: 'Tukar snack 3 mnt + yel-yel misi 7 mnt serentak.' },
      { no: 3, title: 'Sequence 2 — Kode Alkitab', minutes: 15, owner: 'Mentor', notes: 'Sandi, pass message, Runner, puzzle, Validator.' },
      { no: 4, title: 'Sequence 3 — Mission Room (paralel)', minutes: 30, owner: 'Tim', notes: 'Countdown layar; 5 tim kerja serentak.' },
      { no: 5, title: 'Presentasi hasil', minutes: 20, owner: 'MC', notes: 'Maks 4 menit per tim + 1 apresiasi.' },
      { no: 6, title: 'Khotbah penutup & persembahan', minutes: 15, owner: 'Main Speaker', notes: 'Tema + firman pekan + persembahan.' },
      { no: 7, title: 'Commissioning & Declaration', minutes: 15, owner: 'Mentor', notes: 'Penumpangan tangan + doa personal + deklarasi Coram Deo.' },
    ],
    playbook: THREE_SEQUENCES_PLAYBOOK,
    sortOrder: 50,
  },
];

const TOPICS = [
  { code: 'HUBUNGAN', label: 'Hubungan (Romansa & Pertemanan)', pic: 'Putri, Jere' },
  { code: 'PEKERJAAN', label: 'Pekerjaan & Perkuliahan', pic: 'Ka Dif, Ka Michel' },
  { code: 'KELUARGA', label: 'Keluarga', pic: 'Ka Ais, Theo' },
];

const ITEMS = [
  {
    topic: 'HUBUNGAN',
    order: 1,
    text: "Saya sering merasa harus memakai 'topeng' atau menyembunyikan kelemahan saya supaya bisa diterima, disukai, atau tidak ditinggalkan oleh pasangan maupun teman-teman circle saya.",
    note: 'Kita dikasihi Kristus apa adanya; tidak perlu mencari validasi manusia.',
  },
  {
    topic: 'HUBUNGAN',
    order: 2,
    text: 'Ketika disakiti atau dikhianati oleh teman atau pasangan, saya merasa sangat sulit untuk memaafkan dan move on sebelum mereka merasakan kerugian atau pembalasan yang setimpal.',
    note: 'Anugerah pengampunan Tuhan memampukan kita mengampuni orang lain.',
  },
  {
    topic: 'HUBUNGAN',
    order: 3,
    text: 'Saya cenderung menilai hubungan saya sehat hanya dari perasaan nyaman, tanpa pernah membawanya dalam doa dan komitmen untuk saling menumbuhkan iman.',
    note: 'Hubungan yang berpusat pada Kristus bertumbuh lewat komitmen, bukan sekadar rasa nyaman.',
  },
  {
    topic: 'PEKERJAAN',
    order: 1,
    text: 'Saya merasa harga diri dan nilai saya sebagai manusia sangat ditentukan oleh pencapaian saya (seperti IPK tinggi di kampus, pujian atasan, atau besarnya gaji di tempat kerja).',
    note: "Identitas ditentukan oleh karya Kristus, membebaskan kita dari 'hustle culture'.",
  },
  {
    topic: 'PEKERJAAN',
    order: 2,
    text: 'Di lingkungan kerja atau kampus yang keras, saya merasa wajar jika sesekali kita harus mengorbankan kejujuran (misal: menyontek, memanipulasi data, menjilat atasan) demi bisa survive atau sukses.',
    note: 'Bekerja sebagai hamba Tuhan menjadikan integritas lebih utama dari kesuksesan instan.',
  },
  {
    topic: 'PEKERJAAN',
    order: 3,
    text: 'Saya sulit memandang pekerjaan/kuliah saya sebagai ibadah — saya mengerjakannya sekadar untuk memenuhi tuntutan, bukan sebagai pelayanan kepada Tuhan.',
    note: 'Coram Deo: seluruh kerja adalah mezbah penyembahan.',
  },
  {
    topic: 'KELUARGA',
    order: 1,
    text: "Saya sering merasa sangat tertekan atau burnout karena merasa harus selalu berjuang memenuhi tuntutan dan ekspektasi keluarga/orang tua, agar saya dianggap 'anak kebanggaan'.",
    note: 'Kasih Bapa di surga tidak berbasis target pencapaian.',
  },
  {
    topic: 'KELUARGA',
    order: 2,
    text: 'Saya merasa sangat kesulitan untuk tetap menunjukkan kasih kepada anggota keluarga yang memiliki sifat toxic, sering mengecewakan, atau pernah menorehkan luka batin pada saya.',
    note: 'Kasih Agape memampukan kita mengasihi yang sulit dikasihi, karena kita pun telah lebih dulu diampuni.',
  },
  {
    topic: 'KELUARGA',
    order: 3,
    text: 'Saya lebih nyaman membagikan pergumulan saya kepada teman atau media sosial daripada kepada keluarga sendiri, sehingga keluarga menjadi tempat yang paling asing bagi saya.',
    note: 'Keluarga adalah komunitas iman pertama tempat kita dipulihkan.',
  },
];

const CHIPS = [
  { code: 'KASIH_AGAPE', label: '#KasihAgape', topic: 'HUBUNGAN' },
  { code: 'BEBAS_VALIDASI', label: '#BebasValidasi', topic: 'HUBUNGAN' },
  { code: 'PENGAMPUNAN', label: '#Pengampunan', topic: 'HUBUNGAN' },
  { code: 'PEMULIHAN_LUKA', label: '#PemulihanLuka', topic: 'HUBUNGAN' },
  { code: 'INTEGRITAS', label: '#Integritas', topic: 'PEKERJAAN' },
  { code: 'BUKAN_HUSTLE_CULTURE', label: '#BukanHustleCulture', topic: 'PEKERJAAN' },
  { code: 'IDENTITAS_BARU', label: '#IdentitasBaru', topic: 'PEKERJAAN' },
  { code: 'KARYA_SALIB', label: '#KaryaSalib', topic: 'PEKERJAAN' },
  { code: 'BEBAS_TUNTUTAN', label: '#BebasTuntutan', topic: 'KELUARGA' },
  { code: 'HAMBA_TUHAN', label: '#HambaTuhan', topic: 'KELUARGA' },
  { code: 'RUMAH_BAPA', label: '#RumahBapa', topic: 'KELUARGA' },
  { code: 'CORAM_DEO', label: '#CoramDeo', topic: null },
];

const AFFIRMATIONS = {
  HUBUNGAN: [
    'Kamu tidak perlu topeng: kamu dikasihi Kristus apa adanya.',
    'Kamu sanggup mengampuni karena kamu sudah lebih dulu diampuni.',
    'Identitasmu bukan ditentukan siapa yang tinggal, tetapi siapa yang menebusmu.',
  ],
  PEKERJAAN: [
    'Nilaimu bukan angka di kampus atau pujian atasan, tetapi karya Kristus.',
    'Integritasmu adalah ibadah yang Tuhan lihat, bahkan saat tak ada yang menonton.',
    'Kerjamu adalah mezbah: dari 9-to-5 menjadi altar.',
  ],
  KELUARGA: [
    'Kasih Bapa tidak menuntut prestasi — kamu boleh pulang apa adanya.',
    'Rumah yang sulit pun bisa menjadi ladang kasih Agape.',
    'Keluarga adalah tempat pertama kamu belajar dikasihi dan mengasihi.',
  ],
};

async function upsertPattern(conn, p) {
  const [rows] = await conn.query('SELECT id FROM worship_patterns WHERE code = ? LIMIT 1', [p.code]);
  const payload = [
    p.name,
    p.summary,
    JSON.stringify(p.phases),
    JSON.stringify(p.modules),
    p.playbook,
    'ACTIVE',
    p.defaultDurationMin,
    p.sortOrder,
  ];
  if (rows.length) {
    await conn.query(
      'UPDATE worship_patterns SET name=?, summary=?, phases=?, modules=?, playbook=?, status=?, default_duration_min=?, sort_order=? WHERE code=?',
      [...payload, p.code],
    );
    return rows[0].id;
  }
  const id = uid('wp');
  await conn.query(
    'INSERT INTO worship_patterns (id, code, name, summary, phases, modules, playbook, status, default_duration_min, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, p.code, ...payload],
  );
  return id;
}

(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  const ids = {};
  for (const p of PATTERNS) {
    ids[p.code] = await upsertPattern(conn, p);
    console.log(`✓ pola ${p.code}`);
  }

  const SLUG = 'mentoring-2026-10-04';
  const [existing] = await conn.query('SELECT id FROM worship_sessions WHERE slug = ? LIMIT 1', [SLUG]);
  let sessionId = existing[0]?.id || null;

  if (!sessionId) {
    sessionId = uid('ws');
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const config = {
      timerSeconds: 1200,
      rankFloors: [2, 1, 3],
      floors: [
        { floor: 1, label: 'Lantai 1' },
        { floor: 2, label: 'Lantai 2' },
        { floor: 3, label: 'Lantai 3' },
      ],
      topics: TOPICS.map((t) => ({ code: t.code, label: t.label, pic: t.pic })),
      affirmations: AFFIRMATIONS,
      chipLimit: 3,
    };
    await conn.query(
      `INSERT INTO worship_sessions (id, pattern_id, slug, title, tenant_id, session_date, status, access_code, config)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        sessionId,
        ids.POST_TO_POST,
        SLUG,
        'Mentoring Day — More Than Good News',
        'tenant-youth',
        '2026-10-04',
        'DRAFT',
        code,
        JSON.stringify(config),
      ],
    );
    console.log(`✓ sesi ${SLUG} dibuat (kode akses: ${code})`);
  } else {
    console.log(`sesi ${SLUG} sudah ada — dilewati`);
  }

  const [items] = await conn.query('SELECT COUNT(*) n FROM worship_likert_items WHERE session_id = ?', [sessionId]);
  if (!items[0].n) {
    let order = 0;
    for (const t of TOPICS) {
      const topicItems = ITEMS.filter((i) => i.topic === t.code);
      for (const it of topicItems) {
        order += 1;
        await conn.query(
          'INSERT INTO worship_likert_items (id, session_id, topic_code, text, gospel_note, sort_order) VALUES (?,?,?,?,?,?)',
          [uid('wli'), sessionId, t.code, it.text, it.note, order],
        );
      }
    }
    console.log(`✓ ${ITEMS.length} pertanyaan Likert dibuat`);
  } else {
    console.log('pertanyaan Likert sudah ada — dilewati');
  }

  const [chips] = await conn.query('SELECT COUNT(*) n FROM worship_chips WHERE session_id = ?', [sessionId]);
  if (!chips[0].n) {
    let order = 0;
    for (const c of CHIPS) {
      order += 1;
      await conn.query(
        'INSERT INTO worship_chips (id, session_id, code, label, topic_code, sort_order, is_active) VALUES (?,?,?,?,?,?,?)',
        [uid('wc'), sessionId, c.code, c.label, c.topic, order, 1],
      );
    }
    console.log(`✓ ${CHIPS.length} chip words dibuat`);
  } else {
    console.log('chip words sudah ada — dilewati');
  }

  await conn.end();
  console.log('✓ Selesai (seed pola ibadah).');
})().catch((e) => {
  console.error('Gagal seed worship:', e?.message || e);
  process.exit(1);
});
