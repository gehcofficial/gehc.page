# Pola Ibadah Hari-H (Operasional)

> Aturan main fix. Total **180 menit = batas atas** (rentang jalan 150–180).
> Konsep tiap pola tetap seperti yang sudah ada — penyesuaian hanya di pembuka,
> penutup, trek paralel, dan tambahan Didaskalia.
> Dokumen sistem (modul web, API, Studio): [`worship-patterns.md`](worship-patterns.md).

## 1. Anggaran 180-max

| Blok | Penuh | Hemat | Pemilik |
|---|---|---|---|
| Pra (sambut, absensi QR, antisipasi) | 15 | 10 | Koinonia + Liturgia |
| Pembuka (salam, pujian, doa pembuka) | 15 (2–3 lagu) | 7 (1 lagu + doa) | Pemimpin Pujian / Liturgi |
| Inti Didaskalia (jangkar pola) | s.d. 130 | s.d. 130 | Didaskalia |
| Penutup wajib | 20 (terpisah) | 10 (gabung) | bergantian |
| Pasca (foto session + ramah-tamah) | 10 | 5 (foto saja) | Marturia |

## 2. Aturan elastis (inti sebagai jangkar)

- **Inti panjang** (Debat ±140, Bedah Film ±155): kurangi **blok lain** — pembuka hemat, penutup gabung, pasca 5'. Isi pola tidak dipotong.
- **Inti kurang** (Post-to-Post 60): **tambah di Didaskalia** — menu baku: tambah waktu segmen inti, monolog conclusi oleh speaker, kesaksian, 1 pertanyaan pendalaman, bedah 1 bait lagu.
- Monolog gabungan 120 / 3 Sequences 120: hampir pas, tambahan kecil atau jalan apa adanya. Dual Monolog dilebur ke Monolog (arsip).

## 3. Item auto-wajib (semua ibadah)

Lesson Learned · Persembahan (fisik wajib jalan; doanya boleh gabung) · Doa Syafaat ·
Pengumuman komisi/komite · Terima kasih tuan rumah (sekaligus konsumsi, satu segmen ±3') ·
Doa berkat/tutup · Foto session · Absensi.

## 4. Penggabungan segmen (default hemat waktu)

Item wajib tidak boleh hilang, tapi boleh menumpang segmen tetangga: doa/naskah tetap
diucapkan eksplisit, pemilik satu nama, durasi gabungan ditulis di rundown.

| Gabungan | Contoh | Aturan |
|---|---|---|
| Persembahan + doa pra-inti | Bedah Film: kantong jalan sebelum film, doa = doa sebelum nonton | ±5' kantong + 1 doa menyebut persembahan & film |
| Syafaat = doa tutup (tanpa berkat terpisah) | Pola kontemplatif | Satu doa; berkat dilebur di kalimat penutup |
| Terima kasih tuan rumah = pengumuman | Semua pola | 1 slot ±3' oleh Pembawa Acara |
| Lesson Learned = wrap-up inti | Post-to-Post, 3 Sequences | Chip/refleksi dihitung lesson, tanpa segmen tambahan |

Hierarki hemat saat over-time: (1) gabung penutup → (2) lagu tinggal 1 → (3) pasca tinggal foto.
Dilarang: memotong isi inti, menghilangkan lesson learned, menghilangkan fisik persembahan.
Penggabungan dicatat di rundown final H-1 (diputuskan Didaskalia + Liturgia).

## 5. Trek paralel + T0

**T0 = jam jemaat mulai** (jam pada `EventProgram.eventDate`, mis. undangan 13:00).
Blok PRA (doa petugas + tuan rumah, check Diakonia, slide Marturia) jalan **T-minus** sebelum T0
dan tidak menggeser jam jemaat. Di katalog, fase ber-`anchor: PRA` + `parallelGroup`/`track: parallel`
(diupload via seed, tanpa migrasi); total baku = trek main; paralel tidak dihitung ganda.

Ramah-tamah/konsumsi boleh jalan **paralel** saat segmen pasif panjang — ditulis
`paralel→[segmen]`, tidak dihitung ganda. Contoh utama: Bedah Film — snack diedarkan
tuan rumah selama nonton 91' (dibagikan sebelum lampu redup). Syarat: tidak mengganggu
inti, pemilik jelas (tuan rumah), tercatat di rundown.

**Varian persembahan (MONOLOG):** HEMAT = kantong jalan + 3 doa sekaligus (10');
PENUH = kantong + lagu 1 → doa syafaat → lagu selingan → doa tutup + berkat (+6', syafaat &
tutup pisah, tiap doa diucapkan eksplisit, pemilik satu nama). Lagu selingan = slot Liturgia
di composer, bukan teks beku pola. **Varian pembuka:** DOA saja / LAGU saja / KEDUANYA
(default) — menumpang dalam 15' (kurangi 1 praise bila perlu). Pilihan disimpan per pekan
(`patternVariant`), katalog tetap kanonis.

## 6. Catatan, komitmen & kesaksian (modul web)

Setiap pola punya **momen catat**: semua peserta menulis di HP (slot per pola) +
komitmen pribadi + unduh PDF. Modul `notes` (slot: FGD, deep sharing, film, misi,
argumen) + `testimony`.

**Spin kesaksian**: undian 4 orang dari yang hadir (check-in; fallback pengisi Likert),
komposisi 2 Mentee + 1 Mentor + 1 Co-mentor (dilengkapi acak bila peran kurang, tanpa
ulang per sesi). Roda di layar proyektor, tombol Putar/Ulangi di kontrol, hasil tersimpan
dan bisa diaudit. Yang terpilih bersaksi live; yang lain tetap menulis catatan + komitmen.

| Pola | Momen catat | Kesaksian |
|---|---|---|
| Post-to-Post | per pos + kesimpulan (ada) | opsional via undian |
| Monolog gabungan | bedah lagu + 3 FGD + 2 deep sharing + Satu Kata + komitmen (Q dibuka pemicu) | undian 4 |
| Debat | argumen terbaik + yang meyakinkan | — |
| Bedah Film | Likert AWAL 5 + 3 Q + Likert AKHIR 5 + komitmen + chip | undian 2 (1 Mentee + 1 Mentor) |
| 3 Sequences | laporan tim + deklarasi | — |

## 7. Pemetaan 5 pola → 180 menit

Status segmen: `tetap | gabung→[segmen] | hemat | tambah | paralel`.

### Post-to-Post (±150')

| Segmen | Menit | Status |
|---|---|---|
| Pra + pembuka | 20 | tetap |
| Monolog | 15 | tetap |
| Briefing + Post-to-Post | 25 | tambah (+5 dari 20) |
| Monolog conclusi speaker | 10 | tambah |
| Wrap-up + Lesson Learned (chip) | 15 | tetap |
| Penutup wajib (persembahan, syafaat, pengumuman + terima kasih tuan rumah, berkat) | 20 | tetap |
| Foto + pasca | 10 | tetap |

### Monologue & Dialogue (±170', varian)

| Segmen | Menit | Status |
|---|---|---|
| Pra + pembuka + bedah lagu (judul/makna/penyanyi di web) | 20 | tetap (serapan Dual) |
| Monolog khotbah (opsional dua suara) | 30 | tetap |
| Briefing + umumkan pemicu (mentor/co-mentor/perwakilan) | 5 | tetap |
| FGD 3 Q + deep sharing 2 Q, dibuka berurutan, jawab di HP | 40 | tetap |
| Satu Kata di web + undian kesaksian 4 orang | 10 | tetap (serapan Dual) |
| Komitmen + penutup wajib | 20 | tetap |
| Foto + pasca | 10 | tetap |

Dual Monolog diarsipkan dan diserap seluruhnya (bedah lagu, Satu Kata, deep sharing, dua suara opsional, undian). Sesi lama otomatis migrasi ke pola gabungan.

### Debat (±175', mode hemat)

| Segmen | Menit | Status |
|---|---|---|
| Pra + pembuka hemat (1 lagu) | 10 | hemat |
| 3 ronde × 20' (bukan 5) | 100 | tetap (varian padat) |
| Persembahan + transisi | 10 | tetap |
| Konklusi + Trap Reveal + komitmen | 25 | tetap |
| Syafaat = doa tutup | 5 | gabung |
| Foto (pasca minimal) | 5 | hemat |

Tiap ronde (20') = 11 langkah bertimer **di layar & peserta**: The Reveal 1′ ·
Brainstorming & AI Strategy 4′ · Paparan PRO 4′ · Paparan KONTRA 4′ ·
Sanggahan-1 PRO/KONTRA 1′ · Sanggahan-2 PRO/KONTRA 1′ · Final Blow PRO/KONTRA 1′ ·
Jeda 1′ (3×240s + 8×60s = 1200s) — display-only, transisi manual moderator.
Delegasi 3 orang/tim (1 Mentor + 2 Mentee), sisi PRO/KONTRA diundi acak H-1 (tanpa ulang),
HP dikarantina (AI hanya saat Brainstorming). Juri menilai 4 kriteria berbobot
(biblika 40 · logika 30 · teamwork 20 · etika 10) → skor PRO/KONTRA otomatis per ronde.

### Bedah Film (±155', baku film 90; total = 65 + durasi)

| Segmen | Menit | Status |
|---|---|---|
| Registrasi Ulang | 5 | tetap |
| Persiapan Ibadah (paralel: proyektor/sound + matras/konsumsi) | 5 | tetap (T-minus) |
| Opening (Lagu buka, Doa Buka, Praise & Worship) | 5 | tetap |
| Persembahan + Doa (persembahan & syafaat) | 10 | tetap |
| Transisi — jabarkan Alkitab + Likert Awal (infokan isi catatan saat film) | 5 | tetap |
| Movie Breakdown (ikuti durasi film) + konsumsi paralel (tuan rumah) | 90 | tetap + paralel |
| Transisi — konklusi + Likert Akhir + Lesson Learned Chip + 2 kesaksian | 15 | tetap |
| Lagu & Doa Penutup | 5 | tetap |
| Terima kasih + Pengumuman | 5 | tetap |
| HUT + Doa | 5 | tetap |
| Foto Bersama | 5 | tetap |

### 3 Sequences (±165')

| Segmen | Menit | Status |
|---|---|---|
| Pra + pembuka | 15 | tetap |
| Sequence 1–3 (catatan misi di HP) | 55 | tetap |
| Presentasi + Lesson Learned | 20 | tetap |
| Khotbah penutup + persembahan | 15 | tetap |
| Commissioning + deklarasi | 15 | tetap |
| Syafaat + berkat + terima kasih tuan rumah | 10 | gabung→commissioning |
| Foto + pasca | 10 | tetap |

## 8. Peran per segmen (dari seed penatalayan, tanpa peran baru)

Liturgia: Pemimpin Liturgi/Pujian, Doa Syafaat, Doa Persembahan, Pengumpul, Pembawa Acara.
Didaskalia: Main Speaker, Pembaca Firman, PIC pos, Moderator, Juri, Mentor. Marturia:
Tata Suara, Multimedia/Siaran, Fotografer/Videografer. Koinonia: Tuan Rumah, Penerima
Tamu, Absensi, Dekorasi. Diakonia: Kebersihan, Konsumsi.

## 9. Kaitan sistem

- `phases` tiap pola di DB = implementasi tabel §7 (diselaraskan via seed).
- Modul web per pola (`modules[]`): post-to-post `likert/rooms/timer/notes/chips/wordcloud`;
  monolog `timer/notes/fgd/testimony`; debat `rounds/timer/teams`;
  film `screening/timer/notes/testimony/likert/chips/wordcloud`; 3-seq `teams/timer/notes`. Dual diarsipkan.
- Teknis trigger mentor: `config.fgd {currentQ 0–5, triggerBy, triggerName}` via endpoint stage;
  lagu: `config.song {title, about, singer}`; agregat Satu Kata di endpoint live.
- Rincian teknis: [`worship-patterns.md`](worship-patterns.md).
