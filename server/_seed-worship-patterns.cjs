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

const POST_TO_POST_PLAYBOOK = `# Post-to-Post

## 1. Identitas & Tujuan Teologis
**Nama:** Post-to-Post. **Durasi baku:** 60 menit (varian padat 45 menit: potong monolog jadi 10 menit).
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

const THREE_SEQUENCES_PLAYBOOK = `# The 3 Sequences (Coram Deo Challenge)

## 1. Identitas & Tujuan Teologis
**Nama:** The 3 Sequences. **Durasi baku:** 120 menit (tanpa jeda antar sequence — energi terus naik).
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

const MONOLOG_PLAYBOOK = `# Monolog, Bedah Lagu & Deep Sharing

## 1. Identitas & Tujuan Teologis
**Nama:** Monolog, Bedah Lagu & Deep Sharing. **Durasi baku:** 120 menit (varian padat 90 menit: bedah lagu 10 menit + sharing 25 menit).
**Tujuan:** Menyampaikan eksposisi utuh {{tema}} dari {{firman_ref}} dalam satu suara yang jelas (opsional dua suara), mengendapkannya lewat nyanyian yang disadari, diskusi terpandu yang dipicu mentor, deep sharing yang jujur, dan satu kata penutup dari setiap hati.
**Ayat jangkar:** {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).
Pola default bila pekan tidak memilih pola khusus. Menyerap Dual Monolog: bedah lagu, Satu Kata, deep sharing, dan undian kesaksian.

## 2. Pra-acara (H-7 s/d H-1)
1. Main Speaker siapkan naskah monolog 25-30 menit dari {{firman_ref}} (struktur: teks → konteks → 2-3 poin → aplikasi {{tema}} → panggilan). Boleh dua suara (A rapi + B kusut) untuk tema pertobatan/keterpurukan.
2. Didaskalia tetapkan lagu bedah pekan ini (judul + makna tiap bait + penyanyi) + siapkan 5 pertanyaan web: 3 FGD (observasi → interpretasi → aplikasi) + 2 deep sharing (observasi teks → langkah pulang).
3. Tunjuk pemicu pertanyaan: Mentor/Co-mentor tiap kelompok; bila absen, tunjuk 1 perwakilan jemaat sebagai pemicu (umumkan di briefing).
4. Bagi kelompok 5-8 orang + siapkan ruang diskusi. Uji sound/proyektor untuk slide poin khotbah + lirik lagu (tanpa teks panjang).
5. Siapkan undian kesaksian (modul testimony) untuk momen Satu Kata.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Praise & Worship + Bedah Lagu | 20 | Liturgia + Main Speaker | 2-3 lagu; 1 lagu dibedah per bait (makna + penyanyi) dalam terang {{tema}} |
| 2 | Monolog khotbah (opsional dua suara) | 30 | Main Speaker (Didaskalia) | Eksposisi {{firman_ref}} → aplikasi {{tema}} → panggilan |
| 3 | Briefing + trigger pertanyaan | 5 | Main Speaker + Mentor | Bagi kelompok; umumkan pemicu tiap kelompok; Q dibuka satu per satu dari kontrol |
| 4 | FGD + Deep Sharing terpandu | 40 | Mentor/Pemicu | 3 FGD + 2 deep sharing; tiap Q dipicu berurutan; jawab di web; tutup komitmen & doa |
| 5 | Satu Kata + kesaksian | 10 | MC + Mentor | Tiap peserta tulis 1 kata di web; 3-4 undian bersaksi live |
| 6 | Komitmen + persembahan & doa berkat | 15 | Main Speaker | Komitmen di web + unduh PDF; ayat penutup {{firman_ref}} + berkat |

## 4. Naskah siap baca
**Pembuka ibadah:** "Selamat pagi, Beyonders. Hari ini kita merenungkan {{tema}} dari {{firman_ref}}. Kita mulai dengan menyanyi — bukan otomatisasi, tapi dengan kesadaran."
**Bedah lagu (10 menit dalam segmen 1):** "Kita nyanyikan bait 1 — berhenti — apa arti baris ini dalam terang {{firman_ref}}? Lagu ini tentang [makna], dinyanyikan oleh [penyanyi]. Baru lanjut bait 2."
**Transisi khotbah → diskusi (3 menit, jangan dilewatkan):** "Firman sudah diberitakan: {{firman_text}}. Sekarang Firman itu harus mengendap lewat mulutmu sendiri. Bagi ke kelompok 5-8 orang. Pemicumu akan membuka pertanyaan satu per satu di HP kalian — jawab jujur, tulis di web."
**Panduan mentor/pemicu:** "Mulai dengan doa 1 menit. Buka Q1 (observasi): baca {{firman_ref}} bersama, tandai kata kerja. Q2 (interpretasi): kaitkan dengan {{tema}} + kitab {{kitab_fokus}}. Q3 (aplikasi): tiap orang sebut 1 langkah + 1 pergumulan. Q4 (deep sharing 1): di mana kamu melihat dirimu dalam teks? Q5 (deep sharing 2): langkah pulang apa minggu ini? Tutup 5 menit: komitmen + doa saling mendoakan. Zero judgment — jangan potong tangisan."
**Satu Kata (mentor membuka):** "Minggu ini satu kataku: Lelah. Sekarang giliranmu — tulis satu kata untuk minggumu di web."
**Penutup:** "Kita sudah mendengar, menyanyi dengan sadar, dan saling menguatkan. Unduh rekapmu — bawa komitmenmu keluar pintu ini. {{firman_ref}} menjadi bekal {{tema}}-mu minggu ini."

## 5. Modul web & konfigurasi sesi
Modul: timer, notes, fgd, testimony. Timer layar untuk monolog (30) + diskusi (40) + Satu Kata (10). Notes: 3 FGD + 2 deep sharing + Satu Kata + komitmen per anggota (autosave, unduh PDF, ekspor CSV untuk follow-up mentor). Trigger Q: kontrol membuka Q1–Q5 berurutan (config.fgd); peserta hanya bisa menjawab Q yang terbuka. Lagu: config.song (judul + makna + penyanyi) tampil di web + layar + PDF.

## 6. Peran & personil
- Main Speaker (1, Didaskalia): kuasai naskah + slide poin + lirik bedah, jaga waktu 30 menit. Boleh dua suara untuk tema pertobatan.
- Mentor/Co-mentor (1 per 5-8 jemaat): fasilitasi 5 Q, pastikan semua bersuara, buka diri dulu maksimal 2 menit, jaga zero judgment.
- Pemicu perwakilan (bila mentor absen): 1 jemaat per kelompok, diumumkan di briefing, hanya membuka Q + menjaga giliran.
- Liturgia + Multimedia (2-3): lagu + lirik + timer + countdown Satu Kata.
- MC: jaga transisi, undian kesaksian, hening sebelum doa tutup.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}/{{firman_ref}}/{{kitab_fokus}}; turunkan 3 FGD + 2 deep sharing dari teks (jangan generik): observasi harus menunjuk kata/frasa spesifik {{firman_ref}}.
2. Pilih 1 lagu yang liriknya memuat kosakata {{tema}}; tulis makna tiap bait + nama penyanyi di config.song.
3. Pilih 2-3 ilustrasi dunia Beyonders (KRS/tugas/skripsi/magang; shift/lembur/target; kos/keuangan/relasi) yang memuat {{tema}}.
4. Tulis panggilan 2 kalimat di akhir monolog yang menyebut respons spesifik terhadap {{tema}} minggu ini.
5. Sesuaikan durasi: tema doktrinal berat → monolog 35 + diskusi 45; tema aplikatif → monolog 25 + diskusi 40 + kesaksian 10 menit.`;

const PATTERNS = [
  {
    code: 'MONOLOG',
    name: 'Monolog, Bedah Lagu & Deep Sharing',
    summary:
      'Pola default: monolog (+bedah lagu) → pertanyaan dipicu mentor → FGD + deep sharing → Satu Kata → komitmen. Menyerap Dual Monolog.',
    defaultDurationMin: 120,
    modules: ['timer', 'notes', 'fgd', 'testimony'],
    phases: [
      { no: 1, title: 'Praise & Worship + Bedah Lagu', minutes: 20, owner: 'Liturgia + Main Speaker', notes: '2-3 lagu; 1 lagu dibedah per bait (makna + penyanyi).' },
      { no: 2, title: 'Monolog khotbah (opsional dua suara)', minutes: 30, owner: 'Main Speaker (Didaskalia)', notes: 'Eksposisi firman pekan + aplikasi tema + panggilan.' },
      { no: 3, title: 'Briefing + trigger pertanyaan', minutes: 5, owner: 'Main Speaker + Mentor', notes: 'Bagi kelompok; umumkan pemicu; Q dibuka satu per satu dari kontrol.' },
      { no: 4, title: 'FGD + Deep Sharing terpandu', minutes: 40, owner: 'Mentor/Pemicu', notes: '3 FGD + 2 deep sharing; jawab di web; tutup komitmen & doa.' },
      { no: 5, title: 'Satu Kata + kesaksian', minutes: 10, owner: 'MC + Mentor', notes: '1 kata/orang di web; 3-4 undian bersaksi live.' },
      { no: 6, title: 'Komitmen + persembahan & doa berkat', minutes: 15, owner: 'Main Speaker', notes: 'Komitmen di web + unduh PDF; ayat penutup + berkat.' },
    ],
    playbook: MONOLOG_PLAYBOOK,
    sortOrder: 5,
  },
  {
    code: 'POST_TO_POST',
    name: 'Post-to-Post',
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
    modules: ['screening', 'timer', 'notes', 'testimony'],
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
    name: 'The 3 Sequences',
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

  // Arsip Dual Monolog (diserap MONOLOG) + migrasi sesi lama ke MONOLOG.
  {
    const [dualRows] = await conn.query('SELECT id FROM worship_patterns WHERE code = ? LIMIT 1', ['DUAL_MONOLOG']);
    if (dualRows.length) {
      await conn.query("UPDATE worship_patterns SET status='ARCHIVED' WHERE code='DUAL_MONOLOG'");
      const dualId = dualRows[0].id;
      const monoId = ids.MONOLOG;
      const [moved] = await conn.query('UPDATE worship_sessions SET pattern_id=? WHERE pattern_id=?', [monoId, dualId]);
      console.log(`✓ DUAL_MONOLOG diarsipkan; ${moved.affectedRows || 0} sesi dimigrasi ke MONOLOG`);
    } else {
      console.log('(DUAL_MONOLOG tidak ada — lewati arsip/migrasi)');
    }
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
