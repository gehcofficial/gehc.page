# Pola Ibadah & Mentoring Day (F5)

> Status: **live di staging** (29 Sep 2026). Kode: `server/routes/worship.mjs`, `src/components/mentoring/*`,
> `src/lib/mentoring.ts`, `src/lib/mentoringPdf.ts`, seed `server/_seed-worship-patterns.cjs`,
> simulasi `scripts/worship-sim.mjs`.

## 1. Konsep

- **Pola ibadah** = skenario ibadah yang bisa dipakai ulang. Standar nama English-only (9 Okt 2026; kode stabil):
  Monologue & Dialogue, The Battle of Minds, Movie Breakdown, Post-to-Post, Mission Sequence. Penjelas Indonesia ada di `summary` tiap pola.
  Dimiliki **Didaskalia** (`WorshipPattern.ownerDivision = 'DIDASKALIA'`), berisi `phases` (rundown) dan `playbook`
  (skenario markdown).
- **Sesi hari-H** (`WorshipSession`) = pola yang dipakai pada satu event/tanggal. Sesi mengaktifkan **modul web**
  yang dibutuhkan pola.
- **Modul** = registry: `likert`, `rooms`, `timer`, `notes`, `chips`, `wordcloud`, `rounds`, `screening`, `teams`, `fgd`, `testimony`.
  Registry segmen + gerbang per pola: `src/lib/session-engine.ts` (post-to-post memakai alur lama,
  kompatibel mundur). Aturan operasional hari-H (180-max, gabungan segmen, trek paralel,
  catatan & spin kesaksian): [`pola-ibadah-hari-H.md`](pola-ibadah-hari-H.md).
- **Routing hari-H** hanya untuk Pemuda/Beyonders: `#/mentoring/<slug>` (peserta, login), `#/mentoring/<slug>/layar`
  (proyektor, **kode sesi**), `#/mentoring/<slug>/kontrol` (control room, Didaskalia).

## 2. Status sesi

`DRAFT → LIKERT_OPEN → RUNNING → WRAPUP → CLOSED`

- Admin memicu lewat control room: **Buka Akses Likert**, **Start Sesi**, **Trigger Lesson Learned**, **Tutup Sesi**, **Reset ke Draft**.
- **+5 menit** menambah durasi tanpa reset.
- **Auto-wrapup**: saat `RUNNING` dan `now ≥ startedAt + timerSeconds`, server otomatis memindahkan status ke `WRAPUP`
  (lazy, pada pembacaan `GET /session/:slug` atau `GET /live/:slug`) → segmen Lesson Learned terbuka meski admin lupa.

## 3. Alur peserta (4 segmen)

| Segmen | Isi | Syarat |
|---|---|---|
| 1 · Likert | 9 pernyataan skala 1–5 (3 topik) | status `LIKERT_OPEN`/`RUNNING` |
| 2 · Arah Pos | prioritas + lantai, **rute berurutan**, afirmasi, progres `n/total`, pesan “lanjut ke lantai berikutnya bila concern sudah terjawab” | sudah mengisi Likert |
| 3 · Kunjungan & Catatan | timer besar, catatan per pos + kesimpulan (auto-save), unduh **PDF rekap** | `RUNNING` |
| 4 · Lesson Learned | chip words (maks 3), pop-up afirmasi, tombol **Lihat layar utama**, unduh PDF | `WRAPUP`/`CLOSED` |

## 4. Perhitungan

- **Kerentanan topik** = `Σ (6 − skor)`.
- **Ranking topik** → lantai mengikuti `config.rankFloors` (default `[2,1,3]` = rank 1 ke Lantai 2, rank 2 ke Lantai 1,
  rank 3 ke Lantai 3). Dihitung ulang setiap polling.
- **Timer** = `timerSeconds − (serverNow − startedAt)`; klien memakai offset `serverNow` agar tidak drift.
- **Word cloud** = agregat chip per sesi; ukuran font ∝ `√count`.
- **Polling**: peserta 5 s, proyektor 3 s (tanpa WebSocket).

## 5. API ringkas

| Endpoint | Untuk |
|---|---|
| `GET /api/worship/session/:slug` | peserta: state, soal, `myValues`, `myNotes`, `myResult`, rooms, progress |
| `POST /api/worship/likert` | peserta: kirim 9 jawaban → prioritas + lantai |
| `PUT /api/worship/notes` | peserta: catatan per pos + kesimpulan (upsert; kosong = hapus) |
| `POST /api/worship/chips` | peserta: maks 3 chip |
| `GET /api/worship/live/:slug` | progres, rooms, word cloud (`?code=` untuk proyektor tanpa login) |
| `GET/POST/PUT /api/worship/patterns[/:code]` | katalog pola (Didaskalia) |
| `GET/POST/PUT /api/worship/sessions[/:id]` | sesi + `PUT /state` (`open-likert\|start\|wrapup\|close\|reset\|extend`) |
| `POST/PUT/DELETE .../likert-items`, `.../chips` | editor soal & chip |
| `GET .../export.csv` | evaluasi: jawaban, chip, **catatan per topik + kesimpulan** |

## 6. Simulasi 3 lantai

```powershell
npm run worship:sim                      # 60 peserta, mode both (final + live)
npm run worship:sim:reset                # bersihkan sesi demo
node scripts/worship-sim.mjs --participants 100 --mode final
```

- Memakai akun `@gehc.demo` (password `password123`; siapkan dengan `node server/set-demo-passwords.mjs`).
- Menyalin soal/chip dari sesi template `mentoring-2026-10-04`.
- Distribusi dominasi topik: PEKERJAAN 40%, HUBUNGAN 35%, KELUARGA 25% → memastikan 3 lantai terisi.
- Guard: menolak host produksi kecuali `--force`.

## 7. Status modul per pola (5 Okt 2026)

- `POST_TO_POST`: `likert/rooms/timer/notes/chips/wordcloud` — penuh.
- `MONOLOG`: `timer/notes/fgd/testimony` — penuh (bedah lagu + 5 Q dipicu mentor + Satu Kata + PDF di `#/mentoring/<slug>`). Menyerap Dual Monolog (diarsipkan; sesi lama migrasi otomatis).
- `DEBAT`: `rounds/timer/teams` — penuh (panel ronde/fase/skor di kontrol, mosi + skor di peserta & layar).
- `BEDAH_FILM`: `screening/notes/testimony/likert/chips/wordcloud` — penuh (panel mulai/henti tanpa countdown, pre-roll slideshow ala bioskop saat menunggu (deck default + pengumuman custom `screening.preShow` dari panel kontrol, ganti 7 s/slide); timer **per langkah saja**: M0 Likert AWAL 5', M3 Likert AKHIR 5', M4 Undi & Kesaksian 10' — tanpa timer sesi penuh, bagian pemutaran film tanpa timer; M1 otomatis menandai film tayang, M3 menghentikannya; peserta telat (gate AWAL terkunci) lanjut ke Nonton & Catat; layar mode tenang + nada bioskop, Likert AWAL/AKHIR 5 item + afirmasi + delta, Lesson Learned + undi 2 dengan nama & grup di layar). Sim: `npm run film:sim`.
- `THREE_SEQUENCES`: `teams/timer/notes` — penuh (panel susun tim, papan tim di peserta & layar).
- Status panggung live (`PUT .../sessions/:id/stage`, tersimpan di `config.rounds/screening/teams`); alur peserta
  generik `PatternDay` (segmen + widget dari `session-engine.ts`) untuk semua pola non-post-to-post.
- `testimony` (semua pola yang memakai): pool check-in → undi 4 (2 Mentee + 1 Mentor + 1 Co-mentor),
  roda di `/layar`, kontrol di `/kontrol`, hasil di `config.testimony.picks`.

## 8. Katalog template di Studio (5 Okt 2026)

- Tab **Pola Ibadah** di `DidaskaliaStudioPanel` → `WorshipPatternCatalog`: daftar 5 pola aktif + arsip (kartu + badge `pekan ini` + chip modul + badge `template lengkap/parcial`),
  klik kartu → rundown menit-per-menit (dari `phases`, termasuk `notes`) + draft template 7 bagian (dari `playbook`).
- Template baku tiap playbook: 1. Identitas & Tujuan Teologis — 2. Pra-acara — 3. Rundown — 4. Naskah siap baca
  — 5. Modul web & konfigurasi sesi — 6. Peran & personil — 7. Adaptasi tema & firman.
  Slot adaptasi mingguan: `{{tema}}`, `{{firman_ref}}`, `{{firman_text}}`, `{{kitab_fokus}}`.
- Tombol per pola: **Salin naskah** (copy playbook) + **Pakai pekan ini** (simpan `patternCode`, AI generate berikutnya mengikutinya via `patternBlock`).
  Dropdown pola di tab Inti punya tautan `Lihat detail pola →` ke tab katalog.
- **Timeline & T0 (13 Okt 2026):** tiap fase boleh ber-`anchor` (`PRA` = kru T-minus sebelum jam jemaat, `ACARA`, `PASCA`) +
  `parallelGroup`/`track: parallel` (se-grup jalan bareng, tak tambah total). Katalog tampil relatif (`T-15–T0`);
  mode pekan tampil absolut bila event punya jam (`12:45–13:00`) — jam diedit via input **Jam jemaat mulai (T0)**
  di `PolaSesiPanel` (reuse `PATCH /api/events/:id {eventDate}`, butuh peran Komisi+; selain itu jadi preview lokal).
  Total baku = trek main; banner katalog memisah `jemaat + kru (T-minus)`.
- **Varian pekan (13 Okt 2026):** tersimpan di studio week sebagai `patternVariant` (`opening: DOA|LAGU|KEDUANYA`,
  `offering: HEMAT|PENUH`; default `KEDUANYA+HEMAT`; reset ikut kembali default). Pembuka total tetap 15'
  (doa/lagu menumpang); persembahan PENUH +6' (kantong + lagu 1 → syafaat → lagu selingan → tutup + berkat,
  syafaat & tutup pisah). Varian diteruskan ke prompt AI (`patternBlock`), tanpa mengubah skeleton
  Liturgia (tetap kind `song`/`firman`; doa ditangani batas lunak doa/lagu buka → doa tutup).
- Helper: `src/lib/worship-patterns.ts` (`patternTotalMinutes`, `patternTemplateCheck`, `patternDurationDelta`, `moduleLabel`,
  `patternTimeline`, `patternCongregationMinutes`, `patternPreMinutes`, `patternParallelCheck`, `sanitizePatternVariant`,
  `formatRangeRel`, `formatRangeAbs`, `patternVariantText`, `OFFERING_PENUH_DELTA_MIN`; cakupan bertambah `DIAKONIA`).
- Seed: `server/_seed-worship-patterns.cjs` (6 pola, `phases[].notes`, playbook 7 bagian). Terapkan: `npm run db:seed:worship[:staging|:prod]`.

## 9. Draft Sesi Hari-H di Studio (5 Okt 2026)

- Tab **Draft Sesi** di `DidaskaliaStudioPanel` → `SessionDraftTab`: cari/buat sesi milik event pekan ini
  (`eventId` dari tanggal pekan; `POST /api/worship/sessions` bila belum ada), lalu tampilkan **form kosongan
  per pola** (`src/lib/worship-session-draft.ts`: Post-to-Post = 3 topik × 3 Likert + 12 chip + afirmasi + timer;
   Monolog = 3 Q FGD + lagu (judul/makna/penyanyi) + 2 Q deep sharing; Debat = 5 mosi + Trap Reveal; Bedah Film = film + Likert 5 (2 ronde) + 3 Q + chip;
  3 Sequences = yel-yel/sandi + 2 amplop).
- **Isi dari AI**: `POST /api/didaskalia/studio/:ym/:week/session-draft` (`generateSessionDraft` di
  `server/lib/didaskalia-ai.mjs`) membaca tema + firman + outline 7 Path + ringkasan khotbah pekan ini;
  Post-to-Post terstruktur penuh (topik, 9 Likert, chip, afirmasi), pola lain nilai per kunci template.
  Hasil = usulan → review per field → **Simpan draft** (`config.draft`, tanpa migrasi skema) →
  **Terapkan ke sesi** (`POST /api/worship/sessions/:id/apply-draft`: tulis Likert/chip/timer untuk
  Post-to-Post, simpan `config.draft` untuk pola lain).
- **Guard sesi terisi (server + klien):** apply ditolak (409) bila status ≠ DRAFT, sudah ada jawaban peserta,
  atau sudah berisi soal/chip — sesi 4 Okt otomatis terkunci, ubah manual via kontrol hari-H.

## 10. Reset pola ke Monolog (5 Okt 2026)

- Default pekan **selalu MONOLOG** (seed, fallback, dropdown); bila pekan terlanjur diganti pola,
  tab **Draft Sesi** punya tombol **Reset ke Monolog** → `POST /api/didaskalia/studio/:ym/:week/reset-pattern`
  (set `patternCode=MONOLOG` + hapus sesi DRAFT kosong yang tertaut ke event pekan itu; sesi
  berjalan/terisi dilaporkan sebagai `kept` dan tidak disentuh).
- `DELETE /api/worship/sessions/:id` (Didaskalia + tulis): hanya DRAFT dengan 0 respons/vote/catatan;
  hapus cascade (items → responses, chips → votes, notes) dalam satu transaksi, else 404/409.

## 11. Akses Rundown (17 Okt 2026)

- **Lihat (read-only) untuk semua divisi + tuan rumah/PJ:**
  - `MentoringControl` (`#/mentoring/<slug>/kontrol`): kartu Rundown pola
    tampil untuk semua login; `permissions.canWrite` menentukan banner
    **Mode lihat-saja** + fieldset aksi ter-disable.
  - `ControlRoomPanel` (tab `ibadah` **semua divisi**): expander
    "Rundown pola" per blok ibadah — payload `GET /api/events/:id/worship`
    kini memuat `pattern.phases`.
  - `ManageGroupsMonitoring` tab **Jadwal Pelayanan**: expander
    "Rundown pola ibadah" per baris real (lazy fetch) + link kontrol —
    tuan rumah/penanggung jawab ikut jadwal yang sudah ada.
- **Kendali (write) tetap least privilege:** `PUT /state` dan
  `PUT /stage` tetap `requireDivision('DIDASKALIA')` +
  `requireRole(SUPERADMIN/KOMISI/COMMITTEE)`; UI hanya menyembunyikan
  tombol (server tetap 403 — defense in depth). Operator di luar peran itu:
  daftarkan sebagai Tim Kerja Didaskalia event.
- Komponen bersama: `src/components/mentoring/PatternRundownList.tsx`
  (`bare` untuk expander, kartu penuh untuk kontrol). Peserta (MENTEE)
  tidak diberi rundown penuh — alur tetap per segmen (anti-spoiler film).