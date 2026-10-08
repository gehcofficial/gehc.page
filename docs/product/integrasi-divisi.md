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

### 2.1 MONOLOG — Monolog, Bedah Lagu & Deep Sharing (120', default)

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

### 2.2 POST_TO_POST (60')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Praise & Worship | 10 | praise×2 | — |
| 2. Monolog | 15 | — | **auto** |
| 3. Briefing aturan main | 2 | — | — |
| 4. Post-to-Post 3 pos | 20 | — | — |
| 5. Wrap-up & Lesson Learned | 10 | — | — |

Modul: `likert, rooms, timer, notes, chips, wordcloud` (satu-satunya pola
Likert). Guard: apply/convert/delete hanya DRAFT kosong.

### 2.3 DEBAT — Battle of Minds (140')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Opening & nyanyian | 10 | pembuka×1 | **auto** (doa + baca firman + aturan emas) |
| 2. 5 ronde debat | 100 | — | — |
| 3. Persembahan & transisi | 10 | persembahan×1 | — |
| 4. Konklusi teologis | 20 | — | — |

Modul: `rounds, timer, teams`. Kontrol: `DebatPanel` (mosi + fase + skor).

### 2.4 BEDAH_FILM — Movie Breakdown (145')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Opening + praise + pengantar | 15 | praise×2 | — |
| 2. Pemutaran film | 91 | — (Multimedia) | — |
| 3. Pleno analisa | 15 | — | — |
| 4. Team discussion | 25 | — | — |
| 5. Persembahan + konklusi + berkat | 15 | persembahan×1 | — |

Modul: `screening, timer, notes, testimony`. Kontrol: `ScreeningPanel`
(countdown dari `startedAt + durationMin`).

### 2.5 THREE_SEQUENCES — 3 Sequence (120')

| Fase | Menit | Segmen lagu | Firman |
|---|---|---|---|
| 1. Opening & praise | 10 | pembuka×1 | **auto** |
| 2–5. Sequence 1–3 + presentasi | 75 | — | — |
| 6. Khotbah penutup & persembahan | 15 | persembahan×1 | **auto** |
| 7. Commissioning | 15 | — | — |

Modul: `teams, timer, notes`. Kontrol: `TeamsPanel` + countdown misi.

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
  commit + push + sync → migrasi prod.
- **P2**: agregator kontrol + panel Marturia + layar gabungan hari.
- Verifikasi tiap fase: unit + QA API + QA visual staging +
  `schema:check` prod. Additive semua — tanpa sentuh data existing.

## 7. Implementasi P1 (catatan teknis)

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
