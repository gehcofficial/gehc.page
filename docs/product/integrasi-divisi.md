# Integrasi Ibadah 4 Divisi (mengikuti 5 pola katalog)

> Status: P1 berjalan (timeline hari + batas ibadah). P2 (kontrol terpadu +
> Marturia display) berikut. Keputusan dikunci di §0; perubahan butuh
> persetujuan lintas divisi terkait.

## 0. Keputusan yang dikunci

1. Pola = acuan (skeleton + referensi), bukan penegak.
2. Timeline hari = milik Koinonia. Lagu = milik Liturgia (link, bukan salin).
3. Firman = auto Studio / manual fallback, badge jujur.
4. Display agnostik divisi + badge pemilik.
5. Tulis silang divisi dilarang guard (`requireDivision` + peran tulis).
6. Tidak ada hapus data peserta (arsip, bukan delete; delete hanya DRAFT kosong).

## 1. Definisi scope

| Divisi | Scope | Batas |
|---|---|---|
| **Koinonia** | Seluruh acara **hari itu** (ibadah + pengumuman + HUT/selebrasi + makan + games) | Timeline per tanggal (WIB) |
| **Liturgia** | Blok **ibadah**: doa/lagu buka → doa tutup/berkat; fokus **lagu** per segmen | Peringatan lunak bila batas dilanggar |
| **Didaskalia** | **Pola pemberitaan firman** + konten (perikop, monolog, FGD) | Pola = kerangka acuan |
| **Marturia** | **Control room display** (fase berikut) | Operasikan tayangan; konten milik pembuat |

## 2. Peta 5 pola (sumber: `server/_seed-worship-patterns.cjs`)

### 2.1 MONOLOG — Monologue & Dialogue (120', default)

| Fase | Menit | Owner | Segmen lagu | Firman |
|---|---|---|---|---|
| 1. Praise & Worship + Bedah Lagu | 20 | Liturgia + Main Speaker | praise×3, worship×2, bedah-lagu×1 | — |
| 2. Monolog khotbah | 30 | Main Speaker | — | **auto** |
| 3. Briefing + trigger | 5 | Main Speaker + Mentor | — | — |
| 4. FGD + Deep Sharing | 40 | Mentor/Pemicu | — | — |
| 5. Satu Kata + kesaksian | 10 | MC + Mentor | — | — |
| 6. Komitmen + persembahan & berkat | 15 | Main Speaker | persembahan×2 | — |

Modul web: `timer, notes, fgd, testimony`. Kontrol: `FgdTriggerPanel` + roda
kesaksian (2 Mentee + 1 Mentor + 1 Co-mentor) + handoff kurasi `→ Marturia`.
Layar: panduan FGD + Q terkunci + kartu lagu + agregat Satu Kata.

### 2.2 POST_TO_POST — Post-to-Post (60')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Praise & Worship | 10 | praise×2 | — |
| 2. Monolog | 15 | — | **auto** |
| 3. Briefing aturan main | 2 | — | — |
| 4. Post-to-Post 3 pos | 20 | — | — |
| 5. Wrap-up & Lesson Learned | 10 | — | — |

Modul: `likert, rooms, timer, notes, chips, wordcloud` (satu-satunya pola
Likert). Guard: apply/convert/delete hanya DRAFT kosong.

### 2.3 DEBAT — The Battle of Minds (140')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Opening & nyanyian | 10 | pembuka×1 | **auto** (doa + baca firman + aturan emas) |
| 2. Sesi 1 · Debat (5 ronde × 20 di catatan) | 100 | — | — |
| 3. Persembahan & Doa | 10 | persembahan×1 | — |
| 4. Konklusi (Trap Reveal di catatan) | 20 | — | — |

Modul: `rounds, timer, teams`. Kontrol: `DebatPanel` (5 ronde × 11 langkah bertimer +
lembar juri 4-kriteria berbobot + tim PRO/KONTRA undian H-1 + Trap Reveal) &
tombol hari-H D0–D2 (Mulai Ronde 1 → Ronde Berikutnya → Trap Reveal).
Tiap ronde 20′: The Reveal 1′ · Brainstorming & AI 4′ · Paparan PRO 4′ · KONTRA 4′ ·
Sanggahan-1 PRO/KONTRA 1′ · Sanggahan-2 PRO/KONTRA 1′ · Final Blow PRO/KONTRA 1′ · Jeda 1′
(3×240s + 8×60s = 1200s). Juri: biblika 40 · logika 30 · teamwork 20 · etika 10 →
skor PRO/KONTRA otomatis per ronde + total. HP dikarantina; AI hanya saat Brainstorming.

### 2.4 BEDAH_FILM — Movie Breakdown (170', baku film 90; total = 80 + durasi)

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| PRA Registrasi + persiapan (+paralel proyektor/matras) | 10 | — | — |
| Praise + persembahan & syafaat | 15 | praise×1, persembahan×1 | — |
| F0 transisi/pengantar + L0 Likert AWAL 5 item | 10 | — | — |
| F1 Pemutaran film (+konsumsi paralel) | 90 | — (Multimedia) | — |
| L1 Deep sharing 3 Q | 10 | — | — |
| L2 Likert AKHIR (sama) + delta layar | 5 | — | — |
| L3 Komitmen + chip + L4 undi 2 kesaksian | 10 | — | — |
| Doa tutup + terima kasih + HUT + foto | 20 | — | — |

Modul: `screening, timer, notes, testimony, likert, chips, wordcloud`. Kontrol:
`ScreeningPanel` (countdown dari `startedAt + durationMin`) + tombol M0–M4
(gate Likert AWAL/AKHIR via `likertRounds`, wrapup + undi 1 Mentee + 1 Mentor).

### 2.5 THREE_SEQUENCES — Mission Sequence (120')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Praise & Worship | 10 | pembuka×1 | **auto** (pembuka) |
| 2. Sesi 1 · Snack & Merge | 10 | — | — |
| 3. Sesi 2 · Kode Alkitab | 15 | — | — |
| 4. Sesi 3 · Mission Room (5 tim gabungan) | 30 | — | — |
| 5. Presentasi Kelompok | 20 | — | — |
| 6. Konklusi (firman penutup) | 10 | — | **auto** |
| 7. Penutup Sesi · Commissioning & Deklarasi | 10 | — | — |
| 8. Persembahan & Doa | 10 | persembahan×1 | — |
| 9. Lagu & Doa Penutup | 5 | — | — |

Sesi 3 memakai 5 tim gabungan (2 kelompok mentoring per tim, seluruh misi).
Peran Soal / Lapangan / Narasi / Presentasi / Editor hanya teks di dalam tim.

Modul: `teams, timer, notes`. Kontrol: `TeamsPanel` + countdown misi.

### 2.6 CREATIVE_LAB — Creative Lab (140')

Program *Serving Day*: firman menjadi karya (Reminder Jar, dua stasiun). Total 140' =
PRA 20' (kru) + jemaat 120' (Firman & Briefing 15', Presentasi Kelompok 30', sekitar 2,5' per kelompok termasuk transisi).

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| PRA (Persiapan Ruang & Perlengkapan + 3 paralel) | 20 | — | — |
| 1. Praise & Worship | 10 | pembuka×1 | — |
| 2. Firman & Briefing | 10 | — | **auto** |
| 3. Sesi 1 · Reminder Jar (kertas 6, web pilih 2 (paralel)) | 15 | — | — |
| 4. Sesi 2 · Art Stations (20' melukis paralel + 5' unggah) | 25 | — | — |
| 5. Presentasi Kelompok (blok 30') | 30 | — | — |
| 6. Konklusi | 10 | — | — |
| 7. Persembahan & Doa | 10 | persembahan×1 | — |
| 8. Lagu & Doa Penutup | 5 | penutup×1 | — |

Modul: `activity, teams, timer, notes, chips, wordcloud`. Kontrol:
`ActivityPanel` (tombol Sesi 1/Sesi 2 — kunci A1/A2 — Presentasi/berikutnya/stop/reset + durasi fase +
navigator 6 kartu jar + **Muat 10 kelompok** Agape–Shalom, perwakilan
dari anggota kelompok, Stasiun A/B). State di `config` (tanpa migrasi):
`activity` + `teams[].groupId`. Enam kartu: A Root I Carry · A Truth I
Need to Remember · When I Feel Lost · A Word for My Community · A Verse
to Hold Onto · My Next Faith Step. Slot peserta `JAR-ROOT`…`JAR-STEP` +
`KOMITMEN` (maks 2 jawaban jar). Foto di folder event
`[EV:<slug>:DIDASKALIA]`, anak `Foto Kelompok` dan `Hasil Karya`.

## 3. Peran per divisi (RACI ringkas)

- **Koinonia (R timeline hari)**: susun blok per tanggal (ibadah→event,
  pengumuman, HUT/selebrasi, makan, games); tulis `requireDivision('KOINONIA')`;
  baca ringkasan ibadah terkait. Tanpa live-pointer (live tetap per ibadah).
- **Liturgia (R order ibadah)**: isi lagu per slot segmen + momen kustom;
  batas lunak doa-buka/tutup; tulis lagu miliknya + baris non-lagu dalam
  blok ibadah (aturan penulis = pemilik blok).
- **Didaskalia (R pola + konten)**: `segments` per fase, playbook 7 bagian,
  perikop/materi Studio, kontrol mentoring, guard DRAFT-kosong.
- **Marturia (R display, fase berikut)**: panel operasi (link proyektor,
  status engine, push FreeShow), kurasi kesaksian → tampil.
- **Komisi/Superadmin/BOD**: lintas-mengawasi + approve/publish (tak berubah).

## 4. Aturan integrasi

1. **Satu sumber per artefak**: pola di `WorshipPattern`; lagu di
   `songs`/`service_songs`; susunan event di `service_order_items`;
   timeline hari di `day_timeline_items` (baru); konten firman di Studio;
   kesaksian terkuras di Marturia. Referensi via ID/slug, tidak ada salin
   teks antar-divisi (kecuali salinan beku setlist).
2. **Precedence tampil**: setlist kustom → varian master → full master;
   body manual → perikop auto; badge selalu jujur (`dari:`, `auto-sync` /
   `manual`, `master [...]`, pemilik momen).
3. **Batch vs live**: editor = draft + Simpan; kontrol hari-H = live per klik;
   reorder = live; guard 409 untuk sesi terisi.
4. **Guard**: tulis = divisi pemilik + peran tulis; baca layar =
   login/kode; Komisi/Superadmin tembus semua; tanpa tulis silang.
5. **Tidak ada hapus data peserta**: arsip (CLOSED/DONE), bukan delete;
   delete hanya DRAFT kosong via guard.

## 5. Audit tumpang-tindih (putusan)

- Menit fase (Didaskalia, acuan) vs durasi aktual (Koinonia, timeline) —
  referensi, bukan salin.
- `config.song` draft vs pustaka — draft hanya `songId` link (+ badge
  luar-pustaka).
- MC/pengumuman — penulis = pemilik blok (ibadah: Liturgia; hari: Koinonia).
- Kesaksian — undi Didaskalia → kurasi Marturia (handoff sudah ada).
- Warta — alur tetap (Didaskalia isi → Koinonia edit → Marturia desain →
  Komisi terbit).
- Kode proyektor tetap per engine; Marturia operator memakai keduanya.

## 6. Eksekusi bertahap

- **P1**: timeline hari + batas lunak + RACI/docs + slot pola (Didaskalia
  review angka) → lint/suite/build → migrasi lokal+staging → QA 1 hari →
  commit + push + sync → migrasi prod. ✅ selesai
- **P2**: agregator kontrol + panel Marturia + layar gabungan hari. ✅ selesai:
  `ControlRoomPanel` (komposisi klien 3 endpoint, tanpa endpoint/API baru;
  aksi tulis tetap di ruang masing-masing) di tab Ibadah semua divisi +
  `DayScreen` (`#/hari/<tgl>/layar`, login) + operasi display Marturia
  (buat show via `create_show`, remote `next_slide` ke FreeShow lokal —
  sesuai API resmi FreeShow, bukan path tebakan).
- Verifikasi tiap fase: unit + QA API + QA visual staging +
  `schema:check` prod. Additive semua — tanpa sentuh data existing.

## 7. Implementasi P1 (catatan teknis)

- **Absensi mandiri (QR event).** Dua mode hidup berdampingan: (1) panitia
  memindai QR pribadi peserta (alur lama, cadangan), (2) peserta memindai satu
  QR event di layar Koinonia. Token `GEHC-EV|<eventId>|<slot>|<sig>` berputar
  tiap 30 dtk (HMAC `SESSION_SECRET`) + PIN 6 digit, valid hanya pada jendela
  `eventDate` −2 jam s/d +6 jam; rate limit 10 percobaan/5 menit/user. Kehadiran
  ditulis lewat `markAttendee()` yang sama → walk-in mandiri tercatat, audit di
  `event_check_ins` dengan prefix `EVENT-QR|`/`EVENT-PIN|` (tanpa kolom baru).
  Halaman peserta: `#/hadir/<slug>?t=…` (token di hash, tidak terkirim ke server).
- `day_timeline_items(day, sort_order, kind, event_id?, title/body/owner/
  minutes)` — migrasi `server/_migrate-day-timeline.cjs` + npm
  `db:migrate:day-timeline[:staging|:prod]`; tulis
  `requireDivision('KOINONIA')` + SUPERADMIN/KOMISI/COMMITTEE; baca login.
  Ringkasan ibadah per blok: nama + tanggal + jumlah momen + status live.
- Composer `DayTimelinePanel` di tab Ibadah Koinonia (default tanggal event
  terpilih). Blok ibadah cantolkan event; blok lain isi langsung.
- Batas ibadah: `orderBoundaryWarnings` (paritas server↔klien) → banner
  kuning di composer + field `warnings[]` di respons order/bulk/reorder.
  Lunak — tak ada 400.
