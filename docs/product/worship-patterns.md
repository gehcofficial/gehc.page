# Pola Ibadah & Mentoring Day (F5)

> Status: **live di staging** (29 Sep 2026). Kode: `server/routes/worship.mjs`, `src/components/mentoring/*`,
> `src/lib/mentoring.ts`, `src/lib/mentoringPdf.ts`, seed `server/_seed-worship-patterns.cjs`,
> simulasi `scripts/worship-sim.mjs`.

## 1. Konsep

- **Pola ibadah** = skenario ibadah yang bisa dipakai ulang (Monolog, Debat, Bedah Film, Post-to-Post, 3 Sequences).
  Dimiliki **Didaskalia** (`WorshipPattern.ownerDivision = 'DIDASKALIA'`), berisi `phases` (rundown) dan `playbook`
  (skenario markdown).
- **Sesi hari-H** (`WorshipSession`) = pola yang dipakai pada satu event/tanggal. Sesi mengaktifkan **modul web**
  yang dibutuhkan pola.
- **Modul** = registry: `likert`, `rooms`, `timer`, `notes`, `chips`, `wordcloud` (+ rencana: `rounds`, `screening`, `teams`).
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

## 7. Modul berikutnya (belum)

- `DEBAT`: `rounds` (5 ronde × 20', template 11 slide, karantina HP) + timer per ronde.
- `BEDAH_FILM`: `screening` (pemutaran + pleno).
- `THREE_SEQUENCES`: `teams` + mission room + live report.

## 8. Katalog template di Studio (5 Okt 2026)

- Tab **Pola Ibadah** di `DidaskaliaStudioPanel` → `WorshipPatternCatalog`: daftar 6 pola (kartu + badge `pekan ini` + chip modul + badge `template lengkap/parcial`),
  klik kartu → rundown menit-per-menit (dari `phases`, termasuk `notes`) + draft template 7 bagian (dari `playbook`).
- Template baku tiap playbook: 1. Identitas & Tujuan Teologis — 2. Pra-acara — 3. Rundown — 4. Naskah siap baca
  — 5. Modul web & konfigurasi sesi — 6. Peran & personil — 7. Adaptasi tema & firman.
  Slot adaptasi mingguan: `{{tema}}`, `{{firman_ref}}`, `{{firman_text}}`, `{{kitab_fokus}}`.
- Tombol per pola: **Salin naskah** (copy playbook) + **Pakai pekan ini** (simpan `patternCode`, AI generate berikutnya mengikutinya via `patternBlock`).
  Dropdown pola di tab Inti punya tautan `Lihat detail pola →` ke tab katalog.
- Helper: `src/lib/worship-patterns.ts` (`patternTotalMinutes`, `patternTemplateCheck`, `patternDurationDelta`, `moduleLabel`).
- Seed: `server/_seed-worship-patterns.cjs` (6 pola, `phases[].notes`, playbook 7 bagian). Terapkan: `npm run db:seed:worship[:staging|:prod]`.

## 9. Draft Sesi Hari-H di Studio (5 Okt 2026)

- Tab **Draft Sesi** di `DidaskaliaStudioPanel` → `SessionDraftTab`: cari/buat sesi milik event pekan ini
  (`eventId` dari tanggal pekan; `POST /api/worship/sessions` bila belum ada), lalu tampilkan **form kosongan
  per pola** (`src/lib/worship-session-draft.ts`: Post-to-Post = 3 topik × 3 Likert + 12 chip + afirmasi + timer;
  Monolog = 3 Q FGD; Dual Monolog = 2 wajah + 2 Q; Debat = 5 mosi + Trap Reveal; Bedah Film = film + 3 Q;
  3 Sequences = yel-yel/sandi + 2 amplop).
- **Isi dari AI**: `POST /api/didaskalia/studio/:ym/:week/session-draft` (`generateSessionDraft` di
  `server/lib/didaskalia-ai.mjs`) membaca tema + firman + outline 7 Path + ringkasan khotbah pekan ini;
  Post-to-Post terstruktur penuh (topik, 9 Likert, chip, afirmasi), pola lain nilai per kunci template.
  Hasil = usulan → review per field → **Simpan draft** (`config.draft`, tanpa migrasi skema) →
  **Terapkan ke sesi** (`POST /api/worship/sessions/:id/apply-draft`: tulis Likert/chip/timer untuk
  Post-to-Post, simpan `config.draft` untuk pola lain).
- **Guard sesi terisi (server + klien):** apply ditolak (409) bila status ≠ DRAFT, sudah ada jawaban peserta,
  atau sudah berisi soal/chip — sesi 4 Okt otomatis terkunci, ubah manual via kontrol hari-H.
