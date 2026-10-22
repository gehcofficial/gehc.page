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
**Nama:** Bedah Film. **Durasi baku:** 155 menit (film 90 menit; total = 65 + durasi film; film 85 → 150).
**Tujuan:** Mengukur perubahan lewat film — Likert awal (baseline) → nonton & catat (3 Q + afirmasi firman per jawaban) → Likert akhir (5 item yang sama + afirmasi delta) → Lesson Learned + 2 kesaksian. Membuka topeng kesalehan (fake holiness, Christianese) — syarat menjadi murid adalah otentik di hadapan Tuhan dan sesama, seperti api & Roh dalam {{firman_ref}}, bukan sekadar jubah luar.
**Ayat jangkar default:** 2 Raja-raja 2:1-15. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}). Film default 90 menit (bisa bervariasi 60-95; total mengikuti); boleh diganti film lain yang memuat isu {{tema}}.

## 2. Pra-acara (H-7 s/d H-1)
1. Konfirmasi lisensi pemutaran + uji proyektor/sound/subtitle + lampu redup + matras/alas + konsumsi (diedarkan sebelum lampu redup).
2. Umumkan dresscode pekan ini via pengumuman/caption H-7.
3. Susun 5 pernyataan Likert dari {{tema}} (skala 1–5, dipakai awal & akhir, redaksi PRE netral tanpa spoiler) + 3 pertanyaan catatan selama film (Q1 masa lalu, Q2 masa kini, Q3 langkah otentik) + afirmasi firman per jawaban + 8-10 chip Lesson Learned dari {{firman_ref}}.
4. Briefing mentor: mulai duluan, jangan potong tangisan, tutup dengan saling mendoakan. Tonton film minimal 1 kali + catat 3 adegan kunci yang paralel dengan {{firman_ref}}.
5. Cetak sinopsis 1 paragraf tanpa spoiler + ayat {{firman_ref}} untuk dibagikan saat pengantar.

## 3. Rundown (11 blok — total 155' dengan film 90')
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Registrasi Ulang | 5 | Tuan Rumah, Penerima Tamu, Absensi | QR check-in ulang + sambut; masuk pool undian |
| 2 | Persiapan Ibadah | 5 | Tuan Rumah (+ paralel: proyektor/sound + matras/konsumsi) | Doa petugas + standby kru sebelum T0; konsumsi diedarkan sebelum lampu redup |
| 3 | Opening (Lagu buka, Doa Buka, Praise & Worship) | 5 | Pemimpin Pujian, Liturgi, Multimedia | 1 lagu + doa buka dalam 5 mnt |
| 4 | Persembahan + Doa (persembahan & syafaat) | 10 | Main Speaker, Pendoa, Pengumpul | Kantong jalan + doa persembahan & syafaat |
| 5 | Transisi — jabarkan Alkitab + Likert Awal (infokan isi catatan saat film) | 5 | Main Speaker, MC | Sinopsis tanpa spoiler + jembatan ke {{tema}} + "buka HP, isi catatan saat film nanti" (M0) |
| 6 | Movie Breakdown (ikuti durasi film) | 90 | Main Speaker, Multimedia | Layar mode tenang (tanpa countdown); HP tetap boleh untuk jawab 3 Q + afirmasi; konsumsi paralel (M1) |
| 7 | Transisi — konklusi + Likert Akhir + Lesson Learned Chip + 2 kesaksian | 15 | MC, Mentor, 2 terundi | Konklusi firman + Likert AKHIR 5 item yang sama + Lesson Learned maks 3 + undi 1 Mentee + 1 Mentor maju bersaksi (M3 → M4) |
| 8 | Lagu & Doa Penutup | 5 | Liturgia, Pendoa | 1 lagu + doa tutup + berkat |
| 9 | Terima kasih + Pengumuman | 5 | Tuan Rumah, MC, Komisi/Tim Kerja | Apresiasi tuan rumah + info komisi |
| 10 | HUT + Doa | 5 | MC, yang HUT | Rayakan dan doakan yang berulang tahun |
| 11 | Foto Bersama | 5 | Fotografer, Videografer | Foto session + dokumentasi |

## 4. Naskah siap baca
**Registrasi Ulang (5 menit):** "Shalom, Beyonders! Scan QR check-in ulang — yang hadir masuk pool undian kesaksian. Silakan duduk, siapkan HP yang baterainya cukup."
**Persiapan Ibadah (5 menit):** (doa petugas + standby kru; konsumsi diedarkan) "Tim proyektor standby, matras siap. Hadirkan hatimu — kita mulai tepat waktu."
**Opening (5 menit — lagu buka, doa buka, praise & worship):** "Selamat datang di Movie Breakdown. Hari ini {{tema}} dari {{firman_ref}}. Kita buka dengan satu lagu, lalu doa — tata hatimu."
**Persembahan + Doa (10 menit — persembahan & syafaat):** "Kantong jalan. Kita berdoa untuk persembahan dan syafaat — bawa satu nama yang butuh {{tema}} minggu ini."
**Transisi — jabarkan Alkitab + Likert Awal (5 menit):** "Malam ini kita menonton kisah seorang yang memakai topeng demi bertahan hidup. Jangan cari siapa orangnya — cari dirimu. Ayat kita: {{firman_text}} ({{firman_ref}}). Buka HP — jawab 5 pernyataan awal dengan jujur (tidak ada jawaban salah). Nanti selama film, isi juga 3 catatan (Q1-Q3) — HP tetap boleh dipegang."
**Movie Breakdown (ikuti durasi film):** (layar mode tenang, lampu redup) "Harap tenang, fokus mendengar. Selama film, izinkan Roh menyorot filter yang kamu pakai minggu ini. Catat adegan yang menamparmu — tiap jawaban ada afirmasi firman untukmu."
**Transisi — konklusi + Likert Akhir + Lesson Learned + 2 kesaksian (15 menit):** "Film selesai — apa yang berubah? Isi 5 pernyataan yang SAMA dengan jujur, lihat deltamu di layar. Pilih maksimal 3 Lesson Learned yang mewakili aha-momentmu. Dua nama terundi maju bersaksi — yang lain simak, ini buah malam ini."
**Lagu & Doa Penutup (5 menit):** "Kita tutup dengan satu lagu dan doa berkat — bawa komitmen otentikmu keluar pintu ini."
**Terima kasih + Pengumuman (5 menit):** "Terima kasih tuan rumah dan semua yang melayani. Info komisi pekan ini — dengarkan baik-baik."
**HUT + Doa (5 menit):** "Yang berulang tahun pekan ini maju — kita rayakan dan doakan."
**Foto Bersama (5 menit):** "Semua maju — foto bersama!"

## 5. Modul web & konfigurasi sesi
Modul: screening, timer, notes, testimony, likert, chips, wordcloud. Config sesi: {filmJudul, durasiDetik (arsip saja, tanpa countdown), likertRounds:{pre:'open'|'closed', post:'open'|'closed'}, 3 catatan film (Q1-Q3 + afirmasi per jawaban), afirmasi Likert (rendah/tinggi), chipLimit: 3}. Likert = 10 item (5 FILM_PRE + 5 FILM_POST, teks sama, PRE tanpa spoiler); delta pre→post = rata-rata POST − PRE per item, tampil di layar + PDF + CSV. Gates kontrol: M0 (buka AWAL, timer 5') → M1 (mulai film + kunci AWAL, tanpa timer, layar mode tenang) → M3 (buka AKHIR + Lesson Learned serentak, tampil delta) → M4 (undi 2 + kesaksian). Notes: 3 Q selama film + afirmasi per jawaban + komitmen (autosave, unduh PDF, ekspor CSV). Undi: 1 Mentee + 1 Mentor (fallback bebas); nama + grup + hasil Lesson Learned tampil gabungan di layar.

## 6. Peran & personil
- Main Speaker (1): pengantar transisi + penanggung jawab isi film, kuasai paralel film ↔ {{firman_ref}}.
- Multimedia + Tata Suara (1-2): proyektor, sound, subtitle, layar mode tenang (tanpa countdown), cadangan laptop + kabel HDMI + hotspot.
- MC (1): Likert AWAL/AKHIR + Lesson Learned + undian, jaga waktu tiap blok.
- Mentor (1 per 8): pimpin L1, mulai duluan, jangan menghakimi.
- Tuan Rumah + Absensi (2-3): registrasi, sambut, konsumsi, matras.
- Diakonia: matras/alas + konsumsi (paralel persiapan + diedarkan sebelum redup).
- Fotografer dan Videografer (1-2): foto bersama dan dokumentasi.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}/{{firman_ref}}/{{firman_text}}/{{kitab_fokus}}; bila film default kurang cocok, pilih film lain (60-95 menit) yang isu sentralnya = {{tema}} dan tulis 3 adegan paralel baru. Total = 65 + durasi film.
2. Tulis ulang 5 pernyataan Likert dari kosakata {{tema}} (kalimat "Saya ..." + kaitan film; tanpa jawaban benar/salah; PRE tanpa spoiler/nama tokoh) + 3 pertanyaan catatan selama film (rumus Q1 masa lalu, Q2 masa kini, Q3 langkah) + afirmasi firman tiap jawaban + 8-10 chip Lesson Learned format #Kata.
3. Siapkan pancingan cadangan bila jemaat diam 30 detik: "Adegan [X] mengingatkanku pada {{firman_ref}} bagian [...] — ada yang merasakan hal sama?"
4. Cek durasi total: 65 + durasi film (film 90 → 155). Bila film melebihi 95 menit, pilih film lain atau potong 1 lagu praise.`;

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

const MONOLOG_PLAYBOOK = `# Monologue & Dialogue — 60 menit inti, 120 menit ibadah penuh

## 1. Identitas & Tujuan Teologis
**Nama:** Monologue & Dialogue. **Durasi baku:** 120 menit (105 menit jemaat T0→T+105 + 15 menit kru PRA T-minus; inti web 60 menit: F1 20 + F2 25 + F3 10 + Closing 5). Mode PENUH persembahan +6 menit (→ 111 menit jemaat).
**Tujuan:** Menyampaikan eksposisi utuh {{tema}} dari {{firman_ref}} dalam satu suara yang jelas, mengendapkannya lewat nyanyian yang disadari, diskusi terpandu, kesaksian yang jujur, dan chip Lesson Learned dari setiap hati.
**Ayat jangkar:** {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).
Pola default bila pekan tidak memilih pola khusus. Cakupan: Koinonia di luar ibadah, Liturgia di luar firman, Didaskalia dari Bedah Lagu sampai Closing, Marturia dokumentasi.

## 2. Pra-acara (H-7 s/d H-1)
1. Main Speaker siapkan monolog 15-20 menit dari {{firman_ref}} (teks, konteks, 2-3 poin, aplikasi {{tema}}, panggilan).
2. Didaskalia tetapkan lagu bedah pekan ini (judul + makna tiap bait + penyanyi) + siapkan 5 pertanyaan web: 3 FGD observasi-interpretasi-aplikasi + 2 deep sharing cermin-diri dan langkah-pulang + 8-10 chip Lesson Learned dari {{firman_ref}}.
3. Settlement kelompok mentoring: tetapkan Mentor dan Co-mentor tiap kelompok 5-8 orang; siapkan ruang diskusi.
4. Settlement penatalayan: tetapkan Main Speaker, MC, Liturgia, Multimedia, Tuan Rumah, Pengumpul kantong, dan Fotografer dari jadwal pekan berjalan.
5. Uji sound, lirik, proyektor, kode sesi proyektor, dan QR check-in.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| 1 | Doa petugas + tuan rumah (PRA, T-15→T-10) + paralel: check perlengkapan (Diakonia) + slide & sound (Marturia) | 5 | Komisi/Tim Kerja, Tuan Rumah + paralel | Doa + bagi tugas; paralel tak tambah total |
| 2 | Registrasi ulang kehadiran (PRA, T-10→T0) | 10 | Tuan Rumah, Penerima Tamu, Absensi | QR check-in ulang + sambut; yang hadir masuk pool undian |
| 3 | Praise & Worship (T0→T+15) | 15 | Pemimpin Pujian, Liturgi, Multimedia | Varian pembuka per pekan: DOA / LAGU / KEDUANYA (default); total tetap 15 |
| 4 | F1 Bedah Lagu & Monolog | 20 | Main Speaker, Liturgia, Pembaca Firman | Satu lagu dibedah per bait (makna + penyanyi) dalam terang tema pekan + monolog: eksposisi Firman pekan → aplikasi tema pekan → panggilan; umumkan pemicu tiap kelompok; Q1-Q3 terbuka di HP (T1) |
| 5 | F2 Deep Sharing Q4-Q5 | 25 | Mentor, Co-mentor/Pemicu, Mentee | 3 FGD + 2 deep sharing; tiap Q dipicu berurutan; jawab di web; tutup komitmen & doa (T2) |
| 6 | F3 Kesaksian | 10 | MC, Mentor, 3 terundi | Tiap peserta tulis chip Lesson Learned (maks 3); undi bebas 3 bersaksi live + word cloud (T3) |
| 7 | Closing & Transisi | 5 | Main Speaker, Mentor | Rekap + unduh PDF + terima kasih (T4) |
| 8 | Persembahan + doa | 10 (PENUH 16) | Main Speaker, Pendoa, Pengumpul | HEMAT: 3 doa sekaligus. PENUH (+6): kantong + lagu 1 → syafaat → lagu selingan → tutup + berkat |
| 9 | Terima kasih + Pengumuman | 5 | Tuan Rumah, MC, Komisi/Tim Kerja | Apresiasi tuan rumah + info komisi; konsumsi paralel |
| 10 | Selebrasi HUT + doa | 5 | MC, yang HUT | Rayakan dan doakan yang berulang tahun |
| 11 | Foto bersama | 5 | Fotografer, Videografer | Foto session + dokumentasi |
| 12 | Acara bebas & pulang | 5 | Tuan Rumah | Ramah-tamah paralel, tidak dihitung ganda |

## 4. Naskah siap baca
**Pembuka (varian DOA):** "Tata hatimu — kita mulai dalam doa." **(varian LAGU):** "Selamat datang, Beyonders. Hari ini kita merenungkan {{tema}} dari {{firman_ref}}. Tata hatimu — kita mulai dengan menyanyi." **(varian KEDUANYA, default):** doa buka 2 menit, lalu 1 lagu buka, lanjut praise/worship.
**Persembahan (HEMAT):** kantong jalan + 3 doa sekaligus. **(PENUH):** "Kantong jalan diiringi lagu; kita berdoa syafaat; selingan satu lagu; terima berkat dan doa tutup."
**Bedah lagu:** "Kita nyanyikan bait 1, berhenti. Apa arti baris ini dalam terang {{firman_ref}}? Baru lanjut bait 2."
**Transisi khotbah ke diskusi:** "Firman sudah diberitakan: {{firman_text}}. Sekarang Firman itu harus mengendap lewat mulutmu sendiri. Buka HP kalian — Q1 sampai Q3 sudah terbuka."
**Panduan mentor:** "Mulai dengan doa 1 menit. Q1 observasi: baca {{firman_ref}} bersama. Q2 interpretasi: kaitkan dengan {{tema}}. Q3 aplikasi: tiap orang sebut 1 langkah. Q4: di mana kamu melihat dirimu dalam teks? Q5: langkah pulang apa minggu ini? Tutup dengan komitmen dan doa. Zero judgment."
**Kesaksian:** "Tiga nama terundi tampil ke depan. Yang lain pilih maksimal 3 chip yang mewakili aha-moment kalian."
**Penutup:** "Unduh rekapmu dan bawa komitmenmu keluar pintu ini. {{firman_ref}} menjadi bekal {{tema}}-mu minggu ini."

## 5. Modul web & konfigurasi sesi
Modul: timer, notes, fgd, testimony, chips, wordcloud. Fase web: F1 20 menit, F2 25 menit, F3 10 menit, Closing 5 menit — tiap tombol kontrol langsung menjalankan countdown fasenya; habis waktu menunggu operator, tidak auto-lanjut. Trigger Q: T1 membuka Q1-Q3, T2 membuka Q4-Q5. Undian: bebas 3 orang tanpa ulang (nama dan grup tampil di layar). Chip: pilih maksimal 3 per peserta, agregat word cloud. Notes: Q1-Q5 plus Komitmen per anggota (autosave, unduh PDF, ekspor CSV untuk follow-up mentor).

## 6. Peran & personil
- Main Speaker (1, settlement penatalayan): monolog 15-20 menit, persembahan dan doa, closing.
- Liturgia (2-3): pujian, liturgi, lirik dan bedah lagu.
- Mentor dan Co-mentor (1 per 5-8 jemaat): fasilitasi F2, pastikan semua bersuara, buka diri dulu maksimal 2 menit.
- MC (1): transisi, undian kesaksian, HUT.
- Tuan Rumah dan Absensi (2-3): registrasi, sambut, konsumsi, acara bebas.
- Multimedia (1-2): proyektor, countdown fase, kode sesi.
- Fotografer dan Videografer (1-2): foto bersama dan dokumentasi.
- Komisi dan Tim Kerja: pengumuman 5 menit.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}, {{firman_ref}}, {{firman_text}}, dan {{kitab_fokus}}; turunkan 3 FGD dan 2 deep sharing dari kata dan frasa spesifik {{firman_ref}}.
2. Pilih 1 lagu yang liriknya memuat kosakata {{tema}}; tulis makna tiap bait dan nama penyanyi.
3. Susun 8-10 chip Lesson Learned dari poin Firman pekan (format pagar-Kata, tolak yang generik).
4. Pilih 2-3 ilustrasi dunia Beyonders (KRS, tugas, skripsi, magang, shift, lembur, target, kos, keuangan awal, relasi) yang memuat {{tema}}.
5. Sesuaikan durasi blok liturgi bila jemaat membludak: tambah 5 menit registrasi, kurangi 1 lagu praise; inti web 60 menit tidak dipotong.`;

const CREATIVE_LAB_PLAYBOOK = `# Creative Lab — Serving Day

## 1. Identitas & Tujuan Teologis
**Nama:** Creative Lab (Serving Day). **Durasi baku:** 135 menit (115 menit jemaat T0→T+115 + 20 menit kru PRA T-minus).
**Tujuan:** Firman {{tema}} dari {{firman_ref}} tidak berhenti di telinga, tetapi menjadi karya yang terlihat dan komitmen yang dibawa pulang. Lewat The Roots Reminder Jar setiap orang menyimpan penguatan iman; lewat Roots & DNA Creative Lab kelompok menerjemahkan nilai Injil menjadi pot dan tas yang dipakai sehari-hari.
**Ayat jangkar default:** Yakobus 1:22-25. Pekan berjalan pakai {{firman_ref}} — {{firman_text}} (tema: {{tema}}, kitab fokus: {{kitab_fokus}}).

## 2. Pra-acara (H-7 s/d H-1)
1. Didaskalia menetapkan tema, 6 kartu jar, dan arahan pot/tas dari {{firman_ref}}; siapkan 1 contoh karya utuh untuk ditunjukkan.
2. Diakonia menyiapkan per kelompok: 1 jar/toples ±1 liter (muat 30-48 kertas), 6 set kertas kecil per orang, pulpen/spidol, pot, tas kanvas, cat akrilik, kuas, palet, koran/celemek, dan area jemur.
3. Koinonia memakai sepuluh kelompok baku (Agape, Avodah, Dunamis, Echad, Hesed, Kairos, Logos, Metanoia, Ruach, Shalom), masing-masing 5-8 orang: 1 koordinator (Mentor/Co-mentor), 1 perwakilan kelompok, Tim Pot 2-4 orang, Tim Tas 2-4 orang.
4. Marturia menyiapkan slide contoh karya, timer layar, sound, dan dokumentasi; Liturgia menyiapkan praise/worship + lagu tutup.
5. Briefing perwakilan: setiap peserta menulis 6 kartu di kertas, lalu memilih 2 pertanyaan untuk diisi di web (2 slot, tidak boleh sama). Perwakilan melapor ke Admin dan mengunggah foto karya.
6. Layout ruang: peserta langsung duduk per kelompok sejak T0; meja Pot dan Tas disiapkan di meja kelompok yang sama agar tidak ada perpindahan saat aktivitas.
7. Gladi H-1: uji timer layar, proyektor, sound, dan pastikan jumlah alat cukup untuk semua kelompok.

## 3. Rundown
| No | Segmen | Menit | Owner | Naskah kunci |
|---|---|---|---|---|
| — | Persiapan ruang & stasiun seni (PRA, T-20→T0) | 20 | Diakonia | Layout per kelompok, alat seni, area jemur; paralel doa kru, registrasi, slide/sound |
| 1 | Praise & Worship (T0→T+15) | 15 | Liturgia | 1 lagu buka + doa + praise/worship; peserta duduk per kelompok |
| 2 | Preaching & Briefing (T+15→T+30) | 15 | Didaskalia | Khotbah 8-10 menit + briefing 6 kartu, aturan, perwakilan, presentasi |
| 3 | Activity 1 — The Roots Reminder Jar (T+30→T+45) | 15 | Didaskalia + Mentor | Tiap orang menulis 6 kartu; lipat & masukkan jar; pilih 2 pertanyaan untuk web |
| 4 | Activity 2 — Roots & DNA Creative Lab (T+45→T+70) | 25 | Didaskalia + Mentor | Tim Pot ∥ Tim Tas melukis; perwakilan melapor ke Admin + unggah foto; 3 menit terakhir bersih-bersih |
| 5 | Presentasi hasil (T+70→T+90) | 20 | MC/Didaskalia | Urutan hasil undian; 10 kelompok × 2 menit: pot, tas, komitmen |
| 6 | Conclusion (T+90→T+100) | 10 | Didaskalia | Konklusi firman + Satu Kata + komitmen kelompok |
| 7 | Persembahan (T+100→T+110) | 10 | Liturgia | Kantong jalan + doa persembahan & syafaat |
| 8 | Lagu + Doa Tutup (T+110→T+115) | 5 | Liturgia | 1 lagu + doa tutup + berkat |

## 4. Naskah siap baca
**Pembuka:** "Selamat datang, Beyonders. Hari ini kita tidak hanya mendengar firman — kita akan membuat sesuatu dari firman itu. Duduklah bersama kelompokmu."
**Briefing 6 kartu:** "Setiap orang menerima 6 kertas. (1) A Root I Carry — nilai iman atau tradisi baik dari keluarga/GMIM yang ingin kamu bawa. (2) A Truth I Need to Remember — kebenaran tentang Kristus yang ingin kamu ingat saat sulit. (3) When I Feel Lost — pesan penguatan untuk dirimu saat merasa jauh dari Tuhan. (4) A Word for My Community — pesan untuk anggota kelompokmu. (5) A Verse to Hold Onto — satu ayat dan referensinya. (6) My Next Faith Step — satu tindakan nyata minggu ini. Tulis semua 6 di kertas; di web, pilih 2 pertanyaan dan isi jawabanmu di 2 slot."
**Activity 1:** "Tulis dengan jujur, bukan dengan jawaban yang terdengar rohani. Setelah selesai, lipat kartumu dan masukkan ke jar kelompok. Lalu pilih 2 pertanyaan yang paling ingin kamu simpan di web. Jar ini dibawa pulang dan dibuka kembali saat kalian membutuhkan penguatan."
**Activity 2:** "Tim Pot melukis 'Grow What You Believe' — apa yang kita percayai seharusnya bertumbuh dan terlihat dalam hidup kita. Pot melambangkan tempat benih iman bertumbuh; lukis akar, tunas, atau buah sebagai gambaran iman yang dirawat melalui tindakan nyata. Tim Tas melukis 'Carry The Gospel' — membawa Injil ke mana pun kita pergi. Tas kanvas menjadi simbol kehidupan pemuda perantauan; di mana pun tinggal, bekerja, belajar, dan bergaul, bawa nilai kasih, kerendahan hati, pelayanan, dan persatuan dalam Kristus. Sertakan satu kata, simbol, atau kalimat pendek komitmen kelompok di kedua karya. Perwakilan setiap kelompok maju melapor kepada Admin dan mengunggah maksimal 2 foto Pot, 2 foto Tas, dan 1 foto bersama seluruh anggota + karya."
**Presentasi:** "Urutan tampil mengikuti hasil undian di kontrol. Dua menit per kelompok. Perwakilan menunjukkan pot dan tas, menjelaskan maknanya, lalu membacakan komitmen kelompok."
**Konklusi:** "Firman berkata: {{firman_text}} ({{firman_ref}}). Akar yang sehat menghasilkan buah; iman yang dirawat akan terlihat dalam tindakan. Pilih satu kata pelajaran hari ini, lalu bawa jar dan karyamu pulang."
**Persembahan:** "Kantong jalan diiringi doa persembahan dan syafaat; setelah itu kita tutup dengan satu lagu dan doa."
**Penutup:** "Unduh rekapmu, bawa komitmenmu, dan buka kembali jar kelompokmu saat kamu membutuhkan penguatan. {{firman_ref}} menjadi bekal {{tema}}-mu minggu ini."

## 5. Modul web & konfigurasi sesi
Modul: teams, timer, notes, chips, wordcloud, lab updates. Panel kontrol hari-H: papan 10 kelompok baku (5-8 orang, koordinator, perwakilan, Tim Pot/Tas) lewat tombol "Muat 10 kelompok", timer A1 15', A2 25', presentasi 2'/kelompok (blok 20'), navigator 6 kartu jar untuk layar, undian urutan presentasi, status laporan/foto per kelompok, dan unduh CSV. Timer display-only; transisi manual oleh operator. Peserta: semua menulis 6 kartu, memilih 2 pertanyaan untuk 2 slot web; perwakilan mengisi makna/progress Pot & Tas, komitmen, dan 5 foto (2 Pot + 2 Tas + 1 bersama). Semua anggota melihat feed group sendiri. Foto masuk ke folder event "<event> [EV:<slug>:DIDASKALIA]" di bawah Didaskalia [MENTOR]/Kurikulum: Foto Kelompok/<nama> dan Hasil Karya/<nama>. Folder bertag tidak pernah di-rename atau dipindah. Contoh config: activity {phase:A1|A2|PRESENT|DONE, durations:{A1:900,A2:1500,PRESENT:120}, cardIndex, presentIndex 0-9, presentOrder, presentDrawnAt}; teams {teams:[{groupId, name, members, repUserId, repName, memberUserIds, pot, bag, done, missing}]}. Tabel worship_lab_updates (tanpa migrasi baru).

## 6. Peran & personil
- Main Speaker (1, Didaskalia): khotbah singkat, briefing, konklusi.
- MC (1): transisi, presentasi, menjaga 2 menit per kelompok.
- Mentor/Co-mentor (1 per kelompok 5-8 orang): koordinator kelompok, fasilitasi jar dan diskusi karya.
- Perwakilan kelompok (1 per kelompok): melapor ke Admin, mengisi makna/progress/komitmen, dan mengunggah 5 foto karya.
- Anggota kelompok: menulis 6 kartu di kertas, memilih 2 pertanyaan di web, dan melihat feed group sendiri.
- Diakonia (2-3): alat seni, meja, area jemur, kebersihan.
- Liturgia (2-3): praise/worship, persembahan, lagu + doa tutup.
- Multimedia (1-2): slide, timer layar, sound, kode sesi proyektor.
- Fotografer (1-2): dokumentasi karya dan presentasi.

## 7. Adaptasi tema & firman pekan ini
1. Ganti {{tema}}, {{firman_ref}}, {{firman_text}}, dan {{kitab_fokus}}; turunkan 6 kartu dan arahan pot/tas dari kata dan frasa spesifik {{firman_ref}}.
2. Tulis ulang setiap arahan kartu dengan 1 contoh konkret dunia Beyonders (KRS, skripsi, magang, shift, lembur, kos, keuangan awal, relasi) yang memuat {{tema}}.
3. Arahkan pot ke pertumbuhan iman dan tas ke nilai Injil yang dibawa ke tempat kerja/kuliah; tulis komitmen kelompok di kedua karya.
4. Presentasi tetap 2 menit per kelompok untuk sepuluh kelompok baku (blok 20 menit). Kelompok yang belum ada di database tampil sebagai peringatan dan tidak ikut undian.
5. Bila waktu persiapan kurang, minta peserta melukis hanya satu objek per kelompok (pot atau tas) dan presentasi tetap 2 menit.
6. Foto wajib: 1 foto bersama seluruh anggota + hasil karya; maksimal 2 foto Pot dan 2 foto Tas. Perwakilan menekan "Lapor selesai" hanya setelah foto bersama terunggah.`;

const PATTERNS = [
  {
    code: 'MONOLOG',
    name: 'Monologue & Dialogue',
    summary: '',
    defaultDurationMin: 120,
    modules: ['timer', 'notes', 'fgd', 'testimony', 'chips', 'wordcloud'],
    phases: [
      {
        no: 1, title: 'Doa petugas + tuan rumah', minutes: 5, owner: 'Komisi/Tim Kerja, Tuan Rumah', division: 'KOINONIA',
        anchor: 'PRA', parallelGroup: 'pra',
        notes: 'Doa petugas + pembagian tugas. Jam jemaat (T0) mulai setelah blok PRA selesai.',
      },
      {
        no: null, title: 'Check perlengkapan', minutes: 5, owner: 'Diakonia', division: 'DIAKONIA',
        anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
        notes: 'Paralel doa: cek kebersihan, kursi, konsumsi, toilet. Tak tambah total.',
      },
      {
        no: null, title: 'Siapkan slide & sound', minutes: 5, owner: 'Multimedia, Tata Suara', division: 'MARTURIA',
        anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
        notes: 'Paralel doa: slide, lirik, proyektor, sound standby sebelum T0. Tak tambah total.',
      },
      {
        no: 2, title: 'Registrasi ulang kehadiran', minutes: 10, owner: 'Tuan Rumah, Penerima Tamu, Absensi', division: 'KOINONIA',
        anchor: 'PRA', parallelGroup: 'pra-reg',
        notes: 'QR check-in ulang + sambut (T-10→T0); yang hadir masuk pool undian.',
      },
      {
        no: 3, title: 'Praise & Worship', minutes: 15, owner: 'Pemimpin Pujian, Liturgi, Multimedia', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: 'Varian pembuka (pilih per pekan): DOA = doa buka 3 mnt; LAGU = 1 lagu buka; KEDUANYA (default) = doa 2 mnt + 1 lagu buka + praise/worship. Total tetap 15 mnt (kurangi 1 praise bila perlu).',
        segments: [
          { key: 'praise', label: 'Praise', kind: 'song', songs: 2 },
          { key: 'worship', label: 'Worship', kind: 'song', songs: 2 },
        ],
      },
      {
        no: 4, title: 'F1 Bedah Lagu & Monolog', minutes: 20, owner: 'Main Speaker, Liturgia, Pembaca Firman', division: 'DIDASKALIA',
        notes: 'Satu lagu dibedah per bait (makna + penyanyi) dalam terang tema pekan + monolog: eksposisi Firman pekan → aplikasi tema pekan → panggilan; umumkan pemicu tiap kelompok; Q1-Q3 terbuka di HP tanpa countdown. Pemicu: tombol kontrol T1.',
        segments: [
          { key: 'bedah-lagu', label: 'Bedah Lagu', kind: 'song', songs: 1 },
          { key: 'firman', label: 'Firman', kind: 'firman', auto: true },
        ],
      },
      {
        no: 5, title: 'F2 Deep Sharing Q4-Q5', minutes: 25, owner: 'Mentor, Co-mentor/Pemicu, Mentee', division: 'DIDASKALIA',
        notes: '3 FGD + 2 deep sharing; tiap Q dipicu berurutan; jawab di web; tutup komitmen & doa. Countdown + Q1-Q5 looping di layar. Pemicu: tombol kontrol T2.',
      },
      {
        no: 6, title: 'F3 Kesaksian', minutes: 10, owner: 'MC, Mentor, 3 terundi', division: 'DIDASKALIA',
        notes: 'Tiap peserta tulis chip Lesson Learned (maks 3) di web; undi bebas 3 bersaksi live (nama + grup di layar) + word cloud. Pemicu: tombol kontrol T3.',
      },
      {
        no: 7, title: 'Closing & Transisi', minutes: 5, owner: 'Main Speaker, Mentor', division: 'DIDASKALIA',
        notes: 'Rekap + unduh PDF + terima kasih. Pemicu: tombol kontrol T4.',
      },
      {
        no: 8, title: 'Persembahan + doa', minutes: 10, owner: 'Main Speaker, Pendoa, Pengumpul', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: 'Mode HEMAT (default, 10 mnt): kantong jalan; Komitmen di web + unduh PDF; ayat penutup Firman pekan + berkat; 3 doa sekaligus. Mode PENUH (+6 mnt): kantong + lagu 1 → doa syafaat → lagu selingan → doa tutup + berkat (syafaat & tutup pisah, tiap doa eksplisit).',
        segments: [{ key: 'persembahan', label: 'Persembahan', kind: 'song', songs: 2 }],
      },
      {
        no: 9, title: 'Terima kasih + Pengumuman', minutes: 5, owner: 'Tuan Rumah, MC, Komisi/Tim Kerja', division: 'KOINONIA',
        notes: 'Apresiasi tuan rumah + info komisi; konsumsi dan ramah-tamah jalan paralel.',
      },
      {
        no: 10, title: 'Selebrasi HUT + doa', minutes: 5, owner: 'MC, yang HUT', division: 'KOINONIA',
        notes: 'Rayakan dan doakan yang berulang tahun.',
      },
      {
        no: 11, title: 'Foto bersama', minutes: 5, owner: 'Fotografer, Videografer', division: 'MARTURIA',
        notes: 'Foto session + dokumentasi.',
      },
      {
        no: 12, title: 'Acara bebas & pulang', minutes: 5, owner: 'Tuan Rumah', division: 'KOINONIA',
        anchor: 'PASCA',
        notes: 'Ramah-tamah paralel mengikuti blok terima kasih, tidak dihitung ganda.',
      },
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
      {
        no: 1, title: 'Praise & Worship', minutes: 10, owner: 'Liturgia',
        notes: 'Buka dengan 2 lagu syukur yang mengarah ke tema.',
        segments: [{ key: 'praise', label: 'Praise', kind: 'song', songs: 2 }],
      },
      {
        no: 2, title: 'Monolog', minutes: 15, owner: 'Main Speaker (Didaskalia)',
        notes: 'Injil sebagai solusi praktis pergumulan Hubungan/Pekerjaan/Keluarga.',
        segments: [{ key: 'firman', label: 'Firman', kind: 'firman', auto: true }],
      },
      { no: 3, title: 'Briefing aturan main', minutes: 2, owner: 'Main Speaker', notes: 'Total 20 menit; bebas pindah pos bila concern terjawab 5-6 menit.' },
      { no: 4, title: 'Post-to-Post (3 pos serentak)', minutes: 20, owner: 'PIC pos', notes: 'Solusi teologis + praktis per Likert; tanya jawab; catatan individu.' },
      { no: 5, title: 'Wrap-up & Lesson Learned', minutes: 10, owner: 'MC', notes: 'Kembali ke ruang utama; pilih chip words maks 3; doa penutup.' },
    ],
    playbook: POST_TO_POST_PLAYBOOK,
    sortOrder: 10,
  },
  {
    code: 'DEBAT',
    name: 'The Battle of Minds',
    summary: '5 ronde × 20 menit, timer mutlak, karantina HP, konklusi teologis membongkar dikotomi palsu.',
    defaultDurationMin: 140,
    modules: ['rounds', 'timer', 'teams'],
    phases: [
      {
        no: 1, title: 'Opening & nyanyian singkat', minutes: 10, owner: 'Main Speaker',
        notes: 'Doa + baca firman pekan + bacakan aturan emas.',
        segments: [
          { key: 'pembuka', label: 'Pembuka', kind: 'song', songs: 1 },
          { key: 'firman', label: 'Firman', kind: 'firman', auto: true },
        ],
      },
      { no: 2, title: '5 ronde debat', minutes: 100, owner: 'Moderator', notes: 'Per ronde 20 mnt, 11 slide; sanggahan kedua utamakan Mentee.' },
      {
        no: 3, title: 'Persembahan & transisi musik', minutes: 10, owner: 'Main Speaker',
        notes: 'Hening + persembahan sambil juri rekap skor.',
        segments: [{ key: 'persembahan', label: 'Persembahan', kind: 'song', songs: 1 }],
      },
      { no: 4, title: 'Konklusi teologis', minutes: 20, owner: 'Main Speaker', notes: 'Validasi, Trap Reveal dikotomi palsu, panggilan dari firman pekan.' },
    ],
    playbook: DEBAT_PLAYBOOK,
    sortOrder: 30,
  },
  {
    code: 'BEDAH_FILM',
    name: 'Movie Breakdown',
    summary: 'Likert awal + nonton & catat (afirmasi firman) + likert akhir + Lesson Learned + 2 kesaksian.',
    defaultDurationMin: 155,
    modules: ['screening', 'timer', 'notes', 'testimony', 'likert', 'chips', 'wordcloud'],
    phases: [
      {
        no: 1, title: 'Registrasi Ulang', minutes: 5, owner: 'Tuan Rumah, Penerima Tamu, Absensi', division: 'KOINONIA',
        anchor: 'PRA', parallelGroup: 'pra-reg',
        notes: 'QR check-in ulang + sambut; yang hadir masuk pool undian.',
      },
      {
        no: 2, title: 'Persiapan Ibadah', minutes: 5, owner: 'Tuan Rumah', division: 'KOINONIA',
        anchor: 'PRA', parallelGroup: 'pra',
        notes: 'Doa petugas + standby kru sebelum T0. Paralel: proyektor/sound/subtitle (Marturia) + matras/konsumsi diedarkan sebelum lampu redup (Diakonia) — tak tambah total.',
      },
      {
        no: 3, title: 'Opening (Lagu buka, Doa Buka, Praise & Worship)', minutes: 5, owner: 'Pemimpin Pujian, Liturgi, Multimedia', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: '1 lagu + doa buka dalam 5 mnt.',
        segments: [{ key: 'praise', label: 'Praise', kind: 'song', songs: 1 }],
      },
      {
        no: 4, title: 'Persembahan + Doa (persembahan & syafaat)', minutes: 10, owner: 'Main Speaker, Pendoa, Pengumpul', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: 'Kantong jalan + doa persembahan & syafaat; doa tutup + berkat di segmen 8.',
        segments: [{ key: 'persembahan', label: 'Persembahan', kind: 'song', songs: 1 }],
      },
      {
        no: 5, title: 'Transisi — jabarkan Alkitab + Likert Awal', minutes: 5, owner: 'Main Speaker, MC', division: 'DIDASKALIA',
        anchor: 'ACARA',
        notes: 'Sinopsis tanpa spoiler + jembatan ke {{tema}} + infokan isi 3 catatan (Q1-Q3) selama film nanti. Pemicu: tombol kontrol M0 (timer 5 menit).',
      },
      {
        no: 6, title: 'Movie Breakdown (ikuti durasi film)', minutes: 90, owner: 'Main Speaker, Multimedia', division: 'DIDASKALIA',
        anchor: 'ACARA',
        notes: 'Layar mode tenang tanpa countdown (ikuti film, baku 90); lampu redup; HP tetap boleh untuk jawab 3 Q + afirmasi firman per jawaban; konsumsi paralel. Pemicu: tombol kontrol M1.',
      },
      {
        no: 7, title: 'Transisi — konklusi + Likert Akhir + Lesson Learned Chip + 2 kesaksian', minutes: 15, owner: 'MC, Mentor, 2 terundi', division: 'DIDASKALIA',
        anchor: 'ACARA',
        notes: 'Konklusi firman + Likert AKHIR 5 item yang sama + Lesson Learned maks 3 (terbuka serentak via M3) + undi 1 Mentee + 1 Mentor maju bersaksi (M4); nama + grup + hasil Lesson Learned tampil gabungan di layar.',
      },
      {
        no: 8, title: 'Lagu & Doa Penutup', minutes: 5, owner: 'Liturgia, Pendoa', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: '1 lagu + doa tutup + berkat.',
      },
      {
        no: 9, title: 'Terima kasih + Pengumuman', minutes: 5, owner: 'Tuan Rumah, MC, Komisi/Tim Kerja', division: 'KOINONIA',
        anchor: 'ACARA',
        notes: 'Apresiasi tuan rumah + info komisi; konsumsi dan ramah-tamah jalan paralel.',
      },
      {
        no: 10, title: 'HUT + Doa', minutes: 5, owner: 'MC, yang HUT', division: 'KOINONIA',
        anchor: 'ACARA',
        notes: 'Rayakan dan doakan yang berulang tahun.',
      },
      {
        no: 11, title: 'Foto Bersama', minutes: 5, owner: 'Fotografer, Videografer', division: 'MARTURIA',
        anchor: 'ACARA',
        notes: 'Foto session + dokumentasi.',
      },
    ],
    playbook: BEDAH_FILM_PLAYBOOK,
    sortOrder: 40,
  },
  {
    code: 'THREE_SEQUENCES',
    name: 'Mission Sequence',
    summary: 'Gamifikasi misi tanpa jeda: Melayani → Bersekutu → Bersaksi, ditutup Commissioning.',
    defaultDurationMin: 120,
    modules: ['teams', 'timer', 'notes'],
    phases: [
      {
        no: 1, title: 'Opening & praise', minutes: 10, owner: 'Main Speaker',
        notes: 'Doa + firman pekan + aturan tanpa jeda.',
        segments: [
          { key: 'pembuka', label: 'Pembuka', kind: 'song', songs: 1 },
          { key: 'firman', label: 'Firman', kind: 'firman', auto: true },
        ],
      },
      { no: 2, title: 'Sequence 1 — Snack & Merge', minutes: 10, owner: 'Main Speaker', notes: 'Tukar snack 3 mnt + yel-yel misi 7 mnt serentak.' },
      { no: 3, title: 'Sequence 2 — Kode Alkitab', minutes: 15, owner: 'Mentor', notes: 'Sandi, pass message, Runner, puzzle, Validator.' },
      { no: 4, title: 'Sequence 3 — Mission Room (paralel)', minutes: 30, owner: 'Tim', notes: 'Countdown layar; 5 tim kerja serentak.' },
      { no: 5, title: 'Presentasi hasil', minutes: 20, owner: 'MC', notes: 'Maks 4 menit per tim + 1 apresiasi.' },
      {
        no: 6, title: 'Khotbah penutup & persembahan', minutes: 15, owner: 'Main Speaker',
        notes: 'Tema + firman pekan + persembahan.',
        segments: [
          { key: 'firman', label: 'Firman', kind: 'firman', auto: true },
          { key: 'persembahan', label: 'Persembahan', kind: 'song', songs: 1 },
        ],
      },
      { no: 7, title: 'Commissioning & Declaration', minutes: 15, owner: 'Mentor', notes: 'Penumpangan tangan + doa personal + deklarasi Coram Deo.' },
    ],
    playbook: THREE_SEQUENCES_PLAYBOOK,
    sortOrder: 50,
  },
  {
    code: 'CREATIVE_LAB',
    name: 'Creative Lab',
    summary:
      'Serving Day berbasis karya: firman & briefing 15′, The Roots Reminder Jar 15′, Roots & DNA Creative Lab (pot ∥ tas) 25′, presentasi 10 kelompok × 2′ = 20′, konklusi 10′, persembahan 10′, lagu + doa tutup 5′.',
    defaultDurationMin: 135,
    modules: ['teams', 'timer', 'notes', 'chips', 'wordcloud', 'activity', 'lab'],
    phases: [
      {
        no: 1, title: 'Persiapan ruang & stasiun seni', minutes: 20, owner: 'Diakonia', division: 'DIAKONIA',
        anchor: 'PRA', parallelGroup: 'pra',
        notes: 'Layout meja per kelompok (5-8 orang), jar/toples, kertas 6/orang, pot & tas kanvas, cat, kuas, koran/celemek, area jemur. Jam jemaat (T0) mulai setelah blok PRA selesai.',
      },
      {
        no: null, title: 'Doa petugas + briefing kru', minutes: 10, owner: 'Komisi/Tim Kerja, Didaskalia', division: 'DIDASKALIA',
        anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
        notes: 'Paralel persiapan: doa, pembagian stasiun, briefing perwakilan kelompok & MC. Tak tambah total.',
      },
      {
        no: null, title: 'Registrasi ulang + sambut', minutes: 10, owner: 'Tuan Rumah, Penerima Tamu, Absensi', division: 'KOINONIA',
        anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
        notes: 'QR check-in ulang; peserta langsung diarahkan ke kelompoknya. Tak tambah total.',
      },
      {
        no: null, title: 'Slide, sound & contoh karya', minutes: 10, owner: 'Multimedia, Tata Suara', division: 'MARTURIA',
        anchor: 'PRA', parallelGroup: 'pra', track: 'parallel',
        notes: 'Slide contoh pot/tas, timer layar, sound, kode sesi proyektor. Tak tambah total.',
      },
      {
        no: 1, title: 'Praise & Worship', minutes: 15, owner: 'Pemimpin Pujian, Liturgi, Multimedia', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: '1 lagu buka + doa + praise/worship. Peserta sudah duduk per kelompok sejak awal.',
        segments: [{ key: 'praise', label: 'Praise', kind: 'song', songs: 2 }],
      },
      {
        no: 2, title: 'Preaching & Briefing', minutes: 15, owner: 'Main Speaker, MC', division: 'DIDASKALIA',
        anchor: 'ACARA',
        notes: 'Khotbah singkat 8-10 menit dari firman pekan + briefing 5-7 menit: 6 kartu jar, 2 slot web, perwakilan kelompok, Tim Pot/Tas, presentasi 2 menit.',
        segments: [{ key: 'firman', label: 'Firman', kind: 'firman', auto: true }],
      },
      {
        no: 3, title: 'Activity 1 — The Roots Reminder Jar', minutes: 15, owner: 'Didaskalia, Mentor, Co-mentor', division: 'DIDASKALIA',
        anchor: 'ACARA', parallelGroup: 'a1',
        notes: 'Tiap orang menulis 6 kartu (A Root I Carry s/d My Next Faith Step); lipat & masukkan jar kelompok; jar dibawa pulang. Pemicu kontrol: A1 15 menit.',
      },
      {
        no: null, title: 'Pilih 2 pertanyaan untuk web', minutes: 15, owner: 'Setiap peserta', division: 'DIDASKALIA',
        anchor: 'ACARA', parallelGroup: 'a1', track: 'parallel',
        notes: 'Paralel Activity 1: semua menulis 6 kartu di kertas, lalu setiap peserta memilih 2 pertanyaan (tanpa duplikat) dan mengisi jawabannya di 2 slot web. Server menolak lebih dari 2. Tak tambah total.',
      },
      {
        no: 4, title: 'Activity 2 — Pot Painting (Grow What You Believe)', minutes: 25, owner: 'Didaskalia, Mentor, Diakonia', division: 'DIDASKALIA',
        anchor: 'ACARA', parallelGroup: 'a2',
        notes: 'Tim Pot 2-4 orang: gambarkan apa yang perlu dirawat agar iman bertumbuh (akar/tunas/buah). Perwakilan melapor ke Admin + unggah maks 2 foto Pot. Sisa 3 menit bersih-bersih. Pemicu kontrol: A2 25 menit.',
      },
      {
        no: null, title: 'Bag Painting (Carry The Gospel)', minutes: 25, owner: 'Mentor, Co-mentor', division: 'DIDASKALIA',
        anchor: 'ACARA', parallelGroup: 'a2', track: 'parallel',
        notes: 'Paralel di meja yang sama: Tim Tas 2-4 orang menggambarkan nilai Injil yang dibawa ke kuliah, kerja, kos, dan pergaulan. Perwakilan unggah maks 2 foto Tas + 1 foto bersama. Tak tambah total.',
      },
      {
        no: 5, title: 'Presentasi hasil', minutes: 20, owner: 'MC, Didaskalia', division: 'DIDASKALIA',
        anchor: 'ACARA',
        notes: 'Urutan tampil mengikuti undian di kontrol; 10 kelompok × 2 menit (pot, tas, komitmen). Kelompok yang belum termuat tidak ikut undian.',
      },
      {
        no: 6, title: 'Conclusion', minutes: 10, owner: 'Main Speaker, Mentor', division: 'DIDASKALIA',
        anchor: 'ACARA',
        notes: 'Konklusi firman + chip Satu Kata + komitmen kelompok. Pemicu kontrol: DONE → refleksi/WRAPUP.',
      },
      {
        no: 7, title: 'Persembahan + doa', minutes: 10, owner: 'Main Speaker, Pendoa, Pengumpul', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: 'Kantong jalan + doa persembahan & syafaat (mode HEMAT 10 menit).',
        segments: [{ key: 'persembahan', label: 'Persembahan', kind: 'song', songs: 1 }],
      },
      {
        no: 8, title: 'Lagu + Doa Tutup', minutes: 5, owner: 'Liturgia, Pendoa', division: 'LITURGIA',
        anchor: 'ACARA',
        notes: '1 lagu + doa tutup + berkat. Unduh rekap & bawa jar pulang.',
      },
    ],
    playbook: CREATIVE_LAB_PLAYBOOK,
    sortOrder: 45,
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
