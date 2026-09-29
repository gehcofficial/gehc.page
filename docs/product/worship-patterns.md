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
