# GEHC Portal — Handoff

## Current — Info & Peluang (Warta Internal) (25 Sep 2026)

**Fitur:** papan berbagi **khusus pemilik akun** (semua peran): beasiswa, lowongan, peluang, kegiatan, kabar umum. Akses lewat tab sidebar **"Info & Peluang"** (grup Utama).

**Skema (migrasi `server/_migrate-internal-warta.cjs`):** `internal_warta` — `title, summary, body, category (BEASISWA|LOWONGAN|PELUANG|KEGIATAN|UMUM), share_user_id, share_note, attachments Json, link, deadline, status (DRAFT|PUBLISHED|ARCHIVED), is_pinned, view_count, created_by_id, published_at`.
**Server (`server/routes/internal-warta.mjs`):** `GET /api/internal-warta` (feed + filter kategori/cari + arsip + auto-arsip saat deadline lewat), `GET /:id` (detail + viewCount), `POST/PATCH/DELETE` (admin SUPERADMIN/KOMISI/COMMITTEE), `POST /upload` (lampiran ke Drive), `GET /attachment/:fileId` (proxy login). Notifikasi **push ke semua akun** saat dipublikasikan (opsional `notify:false`).
**Client:** tab nav `internal-warta` (label i18n id/en) + `src/components/portal/InternalWartaPanel.tsx` — feed kartu (chip kategori, **sharer foto+nama+note**, lampiran file/link, deadline, jumlah dilihat), modal detail, editor admin (**pilih sharer** via `/api/users/search`, unggah berkas, tambah tautan, deadline, sematkan, Draf/Publikasikan).
**Folder lampiran:** `Info & Peluang [PRIVAT]` di Drive, id tersimpan di `ChannelLink` (`INTERNAL_WARTA`/`FOLDER`) via `npm run db:setup:internal-warta-folder[:staging|:prod]` (sudah dijalankan untuk staging & prod).

**Verifikasi:** `lint` bersih ✓ **495 test** hijau ✓ `build` OK ✓ Sidebar menampilkan **"Info & Peluang"** ✓ Panel terbuka (tombol Buat Warta untuk admin) ✓ API staging: CREATE → mentee melihat di feed (sharer tampil) → detail + viewCount → delete ✓ Migrasi staging & prod ✓ Prod & staging = `8ce5752` ✓

**Catatan:** unggah lampiran di **staging** gagal `invalid_grant` (kredensial Drive khusus environment staging Vercel) — berjalan normal secara lokal & seharusnya di **prod**; sementara itu tombol **Tambah tautan** tetap bisa dipakai. Folder Drive sudah dibuat di staging & prod.

### Next
1. Prod: buat warta pertama (mis. "Peluang Beasiswa Korsel"), pilih sharer, unggah PDF/link, publikasikan → cek notifikasi + feed untuk mentee.
2. (Opsional) periksa kredensial Google Drive di environment **staging** Vercel bila ingin upload berfungsi di staging.


## Current — Perbaikan generate Studio Didaskalia (JSON terpotong) + diagnostik AI (25 Sep 2026)

**Masalah:** sejak update (persona Reformed + knowledge base), "Susun draf 7 Path" gagal dengan **"JSON terpotong."**.

**Akar masalah (3 lapis):**
1. **`maxTokens` diabaikan.** SDK `ai` sudah **v7** yang memakai `maxOutputTokens` → limit keluaran tak terkontrol.
2. **JSON cacat dari model:** newline literal di dalam string, **koma hilang**, dan `rhbSections` ditaruh **di luar** objek Path (struktur salah) — keluaran besar (7 Path × 5 RHB) rawan cacat.
3. **Bug kode lama:** template `id: `regen-${...}`` korup menjadi `egen-` (karakter backtick hilang) → `egen is not defined` begitu JSON berhasil. Juga `proposalFromDraft` menjatuhkan RHB dari AI saat struktur lama kosong (setelah reset).

**Perbaikan:**
- `server/ai-provider.mjs`: `maxOutputTokens` + `finishReason`/`usage` + `timeoutMs` (AbortSignal) + opsi **`json` (OpenAI JSON mode)**; tambah `jethroGenerateObject` (structured output via zod).
- `server/lib/didaskalia-ai.mjs`: **generate per-Path paralel 2 gelombang** memakai **structured output zod** (`PathObjectSchema`) + khotbah (`SermonObjectSchema`) → valid & cepat (~18–27s); normalizer JSON (`sanitizeJsonText`: escape newline, sisip koma hilang, buang koma menggantung) + `repairJson` untuk jalur teks; prompt lebih ringkas (body RHB ≤ 220 karakter).
- `server/routes/didaskalia-studio.mjs`: perbaiki template `id` pendingRegen (draft & enrich).
- `server/lib/didaskalia-diff.mjs`: RHB dari AI tetap dipakai bila struktur lama kosong (kasus setelah reset prod).
- **Diagnostik**: `GET /api/ai/health` (SUPERADMIN/KOMISI/COMMITTEE) — uji main & fallback → `{modelId, ok, finishReason, ms}`.
- UI: pesan galat ramah + tombol **Coba lagi** di Studio.

**Verifikasi:** `lint` bersih ✓ **495 test** hijau (baru: `didaskalia-json-repair.test.ts`) ✓ `build` OK ✓ `GET /api/ai/health`: `gpt-4o-mini` ok (`finishReason: stop`) ✓ Staging `/draft` 2026-09 W4 → **200, ~27s, 7 Path lengkap dengan RHB + khotbah** ✓ Residu uji staging dibersihkan ✓ Prod & staging = `93c9161` ✓

**Catatan:** Prod studio masih dalam kondisi ter-reset (bacaan + metode tersisa). Silakan coba **Generate draf** di prod; bila perlu, pantau `GET /api/ai/health`.

### Next
1. Uji generate di prod (2026-09 W4) → tinjau pengajuan (Persetujuan HOD) → Setujui.
2. (Opsional) Judul Path bisa sesekali berulang — tambah penguncian judul lintas-Path bila perlu.


## Current — Voting logo: anti-bypass admin + turnout + deadline + reset (25 Sep 2026)

**Masalah:** akun admin (SUPERADMIN) bisa memilih di semua grup (bypass), keanggotaan tak difilter aktif, dan tidak ada rekap partisipasi/deadline.

**Perbaikan (`server/routes/logo-vote.mjs`):**
- **Tanpa bypass**: `canVoteForGroup(authUser, groupId, activeRole)` wajib `activeRole ∈ {MENTOR, CO_MENTOR, MENTEE, ALUMNI}` **dan** grup ada di `beyonderGroupIds` (RoleAssignment **isActive** + GroupMember ACTIVE/ALUMNI). Staf boleh memilih **hanya** lewat topeng Beyonder.
- **Turnout**: `eligibleVoterIds` (userId unik per grup) → tiap grup punya `voters {voted,total}` + total keseluruhan; tampil "X dari Y sudah memilih".
- **Deadline**: `closesAt` (WIB) + **auto-close** saat lewat; `PUT /api/voting/session` menerima `action: open|close|draft|reset`, `closesAt`, `clearDeadline`.
- **Reset suara** (admin): hapus semua ballot sesi + nolkan hitungan.

**Client (`src/components/voting/GroupLogoVote.tsx`):** banner "Voting hanya untuk Beyonders" + tombol **Ganti ke peran MENTEE/MENTOR** (via `POST /api/auth/active-role`), grup terdeteksi, progress turnout per grup + keseluruhan, kontrol deadline (preset **Minggu 17:00 WIB** + kustom + countdown), tombol **Reset suara** (ConfirmDialog), tombol pilih hanya untuk grup sendiri.

**Verifikasi (staging):** admin `tech@gehc.demo` (SUPERADMIN) → `roleAllowed=false`, `canVote=false`, ballot ditolak; beyonder `alvandi.saerang@gehc.demo` → default topeng COMMITTEE (tak boleh) → ganti topeng MENTEE → hanya **Logos (grp-6)** bisa, ballot grup sendiri **200**, grup lain **403**; turnout Logos `0→1 dari 9`; deadline tersimpan (`2026-10-04 17:00 WIB`); **Reset** → 0 suara + sesi DRAFT (staging bersih). `lint` bersih ✓ **489 test** hijau ✓ `build` OK ✓ Prod & staging = `f9cfa83` ✓

**Catatan:** kolom `closesAt` & tabel ballot sudah ada sejak fitur awal — tidak ada migrasi baru. Prod sesi masih **DRAFT** (belum dibuka) & 0 suara.

### Next
1. Buka sesi di prod + set deadline (mis. Minggu 17:00 WIB), lalu bagikan `https://youth.gehc.page/#/voting`.
2. Bagi yang memakai akun multi-peran (mis. staf merangkap mentee): klik **Ganti ke peran MENTEE/MENTOR** di halaman voting.


## Current — Panel Voting Logo Kelompok `#/voting` (25 Sep 2026)

**Fitur:** voting 1 dari 2 opsi logo per kelompok Beyonders, hanya anggota kelompok terkait (aktif/alumni) yang boleh memilih. Akses via link khusus `#/voting` (tanpa tab sidebar).

**Skema (migrasi `server/_migrate-logo-vote.cjs`):** `group_logo_votes` (sesi: title/status DRAFT|OPEN|CLOSED/closesAt), `group_logo_options` (sessionId, groupId, optionNo, label, imageFileId, philosophy, voteCount), `group_logo_ballots` (unique sessionId+groupId+userId → 1 suara/orang/grup).
**Server (`server/routes/logo-vote.mjs`):** `GET /api/voting` (sesi + grup & opsi + hak pilih + pilihan + tally), `POST /api/voting/ballot` (validasi OPEN + keanggotaan, recompute tally), `GET /api/voting/asset/:fileId` (proxy Drive login-gated + fallback service-account), `GET /api/voting/results` + `PUT /api/voting/session` (admin). Helper `myGroupIds`/`canVoteForGroup`/`isVoteAdmin`.
**Client:** route baru `isVotingHash` (`src/lib/host-context.ts`) → `src/main.tsx` mount standalone `src/components/voting/GroupLogoVote.tsx` (wajib login, redirect `#/login?next=#/voting`): kartu per grup + filosofi + 2 logo + tombol pilih + tally live; kontrol admin Buka/Tutup + rekap.
**Aset logo:** 20 gambar dari folder Drive bersama (`1mCRRWO0QmPR5qR4YUzgRmgjFT1DJoSoQ`, subfolder per grup, file `<Nama>-1.jpg`/`<Nama>-2.jpg`) diunduh + dikompres (sharp, max 900px q82) → **`public/logo-grup/`** (22 MB → 785 KB), `imageFileId` disimpan sebagai path statis. Seed `server/seed-logo-vote.mjs` idempotent (pakai aset statis bila ada, jika tidak pakai id Drive).

**Verifikasi:** `lint` bersih ✓ **489 test** hijau ✓ `build` OK ✓ Migrasi+seed **staging & prod** (20 opsi, 10 grup) ✓ UI staging: `#/voting` tampil judul+filosofi+logo, gambar statis 200 ✓ Vote uji → tally naik → dibersihkan → sesi kembali DRAFT ✓ Prod static `/logo-grup/avodah-1.jpg` = 200 ✓ Prod & staging = `7b95df2` ✓

**Cara pakai:** admin buka sesi dari halaman `#/voting` (tombol **Buka**), bagikan link `https://youth.gehc.page/#/voting` ke Beyonders via WA, lalu **Tutup** saat selesai dan lihat rekap.

### Next
1. Buka sesi + bagikan link; pantau rekap sampai ditutup.
2. (Opsional) Tetapkan logo pemenang per grup setelah voting usai.


## Current — Didaskalia: Knowledge Base + Instruksi AI (Gems-like) + Reset Studio Prod (25 Sep 2026)

**Masalah:** materi hasil AI belum sesuai pemikiran tim; konteks teologi saja tidak cukup; tim butuh memberi "pengetahuan" & instruksi.

**Skema baru** (migrasi `server/_migrate-didaskalia-knowledge.cjs`):
- `didaskalia_knowledge`: `title, content (MediumText), category (FORMAT|TEOLOGI|REFERENSI|CATATAN), tags, source (MANUAL|UPLOAD|DISCUSSION), fileName, isActive, sortOrder, createdById`.
- `didaskalia_ai_config` (singleton `didaskalia-ai`): `instruction`, `maxKnowledgeChars` (default 12000).

**Server:** CRUD `GET/POST/PATCH/DELETE /api/didaskalia/knowledge` + `GET/PUT /api/didaskalia/ai-config` (RBAC Didaskalia + SUPERADMIN/KOMISI/COMMITTEE). `server/lib/didaskalia-ai.mjs` menambah `teamContextBlock()` yang menyisipkan INSTRUKSI KHUSUS TIM + PENGETAHUAN TIM (semua dokumen aktif, dipotong ke `maxKnowledgeChars`) ke prompt draft/enrich/extras/sermon; `refineField` menerima `teamInstruction`.
**Client:** sub-tab "Pengetahuan" di Studio (kelola dokumen, unggah .md/.txt, editor instruksi + batas karakter) lewat `DidaskaliaKnowledgePanel.tsx`. Tombol ".md" di Diskusi Internal menjadikan berkas sebagai dokumen pengetahuan (source DISCUSSION) + entri diskusi.
**Seed:** `server/seed-didaskalia-knowledge.mjs` berisi "Panduan Format Khotbah — Tim Didaskalia" (kategori FORMAT): komposisi 20% Pendahuluan Tematis menjadi 30% Peninjauan Historis menjadi 50% Eksposisi Biblika + alur & catatan gaya (dari file Gemini tim, digeneralisasi).

**Reset Studio Prod** — `scripts/reset-didaskalia-week.mjs` kini bulk (`--all` / `--ym`), menyisakan HANYA `fundamentalFirman` + `kitabFokus` (2 referensi bacaan) + `homileticMethods` + `methodMix` (metode); membersihkan paths/sermon/discussion/rituals/generation/presentation/render/pendingRegen/history, chapterNo dikosongkan, status ke DRAFT. Idempotent & dry-run akurat. **Prod dijalankan: 10 pekan pada 3 bulan (2026-09/10/11) dibersihkan** (verifikasi ulang = 0 perubahan). Script: `db:reset:didaskalia:dry|:staging|:prod`.

**Verifikasi:** `lint` bersih; **489 test** hijau (baru: `didaskalia-knowledge.test.ts` — instruksi & knowledge masuk prompt, batas karakter dipatuhi); `build` OK; migrasi+seed **staging & prod**; API staging knowledge=[Panduan Format Khotbah/FORMAT], CREATE/PATCH/DELETE 200; UI tab "Pengetahuan" + Instruksi + Panduan tampil; tanpa error.

### Next
1. Tim Didaskalia: isi Instruksi Khusus Tim + unggah dokumen pengetahuan via tab Pengetahuan / Diskusi.
2. Susun ulang draf minggu yang sudah direset (Generate draf) lalu nilai apakah sudah sesuai pemikiran tim.


## Current — Penatalayanan Terpadu: sisa item (25 Sep 2026)

**1. Absensi QR oleh Tuan Rumah** — `isKoinoniaOperator(authUser, { eventId })` diperluas: anggota **grup host (Tuan Rumah)** event atau petugas komponen KOINONIA pada event itu boleh mengoperasikan check-in. `requireCheckInOp` kini me-resolve event dari `req.params.slug` sebelum memeriksa izin. Surface baru untuk Tuan Rumah (mentee/mentor tanpa akses panel Koinonia): endpoint `GET /api/events/:id/checkin-access` + komponen **`EventHostCheckIn`** di **Info Event** (blok "Absensi Kehadiran", collapsible, hanya tampil bila diizinkan).

**2. Ritual Pembinaan Pembaca Firman (Serving)** — jenis ritual baru **`READER_COACHING`** ("Pembinaan Pembaca Firman"), ref Meet `READER`, offset H-3 (19:30–20:30). Di-generate otomatis pada **minggu Serving** (bersama `SERVING_BRIEFING`). Ditambahkan di `src/lib/didaskalia.ts`, `server/lib/didaskalia-ai.mjs`, `server/routes/didaskalia-studio.mjs` (REFS, `defaultRitualTimes`, generate), dan tab Jadwal & Meet Studio (editor link kini 4 ruang meet).

**Verifikasi:** `lint` bersih ✓ **486 test** hijau ✓ `build` OK ✓ Staging API: ritual-links = 4 (incl. READER); generate 2026-10 → W1 Mentoring = Sync+Equip, W2–W4 Serving = + Servbriefing + Reader Coaching ✓ `checkin-access` = `{allowed:true}` (SUPERADMIN) ✓ Browser: blok "Absensi Kehadiran" tampil di Info Event (respons 200) dan label "Pembinaan Pembaca Firman" tampil di Studio › Jadwal & Meet ✓ Prod & staging = `0ac9698` ✓

**Catatan:** bundle baru bisa tertunda di browser karena cache **service worker PWA** — muat ulang keras bila belum melihat perubahan.

### Next
1. Uji prod: tugaskan Tuan Rumah/Koinonia untuk Serving → buka Info Event → Absensi; regenerate jadwal ritual bulanan agar `READER_COACHING` muncul.
2. Kandidat: integrasi agenda Rapat Petugas Ibadah dengan penugasan penatalayan (auto-assign per agenda).


## Current — Penatalayanan Terpadu Fase A–E (25 Sep 2026)

**Skema baru (migrasi `server/_migrate-penatalayan-v2.cjs`, idempotent):**
- `service_roles`: `sub_division`, `service_types` (CSV Serving/Mentoring), `checklist_template` (JSON).
- `service_schedules`: `status_note`, `confirmed_at/by_id`, `done_at/by_id`, `checklist_state` (JSON).
- `EventMeeting`: `attendees`, `agenda` (JSON) — rapat petugas ibadah.

**A. Pembagian role lintas divisi** — `PENATALAYAN_DIVISIONS` → 5 (LITURGIA, DIDASKALIA, KOINONIA, DIAKONIA, MARTURIA). Seed 30 komponen: **Pembaca Firman 1/2 pindah ke DIDASKALIA/Kurikulum**; KOINONIA baru (Koordinator Tuan Rumah, Penerima Tamu/Usher, Absensi Tamu, Dekorasi); DIAKONIA baru (Kebersihan & Penataan Ruang, Konsumsi). Tab **Penatalayan** kini ada di 5 panel (Didaskalia 4 tab, Koinonia 4, Diakonia 3). Bug key fase Didaskalia (`Kurikulum & Pembekalan` → `Kurikulum`) diperbaiki.
**B. Siklus status** — `server/lib/penatalayan-status.mjs`: `SCHEDULED→CONFIRMED→DONE`, revert, batal; **DONE final** (hanya SUPERADMIN bisa buka); **DONE hanya koordinator** + konfirmasi akhir; audit `done_at/by`. Endpoint `POST /api/penatalayan/schedules/bulk-status` + notifikasi. UI: multi-select + action bar (Konfirmasi/Selesai/Batalkan/Kembalikan) di Calendar & Event panel; baris DONE terkunci.
**C. Kontrol** — `GET /api/penatalayan/board?from&to` + komponen `PenatalayanBoard` (Papan Petugas Ibadah lintas divisi: terisi/kosong, status, progress checklist). Checklist Tuan Rumah: template di role + state per penugasan.
**D. Akses pembekalan Pembaca Firman** — `server/lib/penatalayan-access.mjs`: `isAssignedDidaskaliaOfficer` dipakai di RBAC subfolder `01` & `canViewDoc`; `/api/me/penatalayan-access` → `useActiveAccess.canView01`. Saat ditugaskan ke role DIDASKALIA, notifikasi berisi deep link `#/materi/pembekalan/<YM>/<pekan>`.
**E. Rapat Petugas Ibadah** — `EventMeeting` + attendees/agenda; `POST /api/events/:id/meetings` & `PATCH /api/events/meetings/:mid`; UI di Program & Event (checkbox gabungan + agenda `Judul | PIC | deadline` + peserta).

**Verifikasi:** `lint` bersih ✓ **486 test** hijau (baru: `tests/unit/penatalayan-status.test.ts`) ✓ `build` OK ✓ Migrasi+seed **staging & prod** dijalankan ✓ API prod: 30 komponen (16 LITURGIA, 2 DIDASKALIA, 4 KOINONIA, 2 DIAKONIA, 6 MARTURIA) ✓ Browser staging: tabs 3 divisi benar; filter `serviceType` (Koinonia serving=4/mentoring=0); siklus status CONFIRM→DONE→(revert oleh SUPERADMIN)→checklist→hapus; Papan Petugas & Komponen tampil; tanpa page error ✓ Prod & staging = `dc53d41` ✓

### Next
1. Uji UI prod: tugaskan Pembaca Firman (Didaskalia) → cek notifikasi + akses pembekalan; Tuan Rumah/Diakonia/Koinonia untuk Serving Day; tandai selesai (koordinator).
2. Rapat Petugas Ibadah: buat rapat gabungan + agenda ber-PIC di Program & Event.
3. Kandidat lanjutan: akses operator check-in QR untuk grup Tuan Rumah (perluas `isKoinoniaOperator`), dan jadwal ritual pembinaan Pembaca Firman pada Serving Day.


## Current — Persona AI Reformed + Penatalayan Marturia (24 Sep 2026)

### 1. Persona AI Didaskalia berkerangka Reformed
`server/lib/didaskalia-ai.mjs` — konstanta `SYSTEM` (dipakai SEMUA generator: draft, enrich, extras, sermon, refineField) ditambah blok kerangka teologis: GMIM = Protestan Kalvinis (Reformed); Sola Scriptura/Gratia/Fide/Christus/Deo Gloria; kedaulatan Allah, keberdosaan total, pemilihan & panggilan anugerah, penebusan Kristus, ketekunan, teologi perjanjian. Bingkai positif (bukan polemik), tanpa menyebut nama dokumen pengakuan. Prompt gambar & 7 metode homiletik tidak diubah.
- Test baru: `tests/unit/didaskalia-persona.test.ts` (mock provider, assert isi system prompt di 3 generator).

### 2. Penatalayan Marturia + filter jadwal per divisi
**Masalah:** di panel Liturgia, komponen Marturia terlihat (editor) tapi tak bisa ditugaskan (AssignModal hanya divisi aktif); kalender menampilkan jadwal lintas-divisi; panel Marturia tak punya tab Penatalayan.
**Solusi:**
- `DivisionWorkspacePanel.tsx`: tab Marturia kini **5** — `Galeri · Kesaksian & Story · Penatalayan · Ibadah · Anggota`.
- Editor komponen di tab Penatalayan di-scope per divisi: `divisions={[selectedDiv]}` (Liturgia kelola komponennya; Marturia kelola komponennya).
- `PenatalayanCalendar.tsx`: kirim `&division=${division}` ke `/api/penatalayan/schedules`.
- `server/index.mjs` — `GET /api/penatalayan/schedules` terima param opsional `division` (CSV) → `where.serviceRole = { division }`. Backward-compatible (KegiatanCalendar & WartaPublikTab tidak kirim param → tetap lintas-divisi).

**Verifikasi:** `lint` bersih ✓ **480 test** hijau ✓ `build` OK ✓ Data prod: 24 komponen (18 LITURGIA + 6 MARTURIA), semua `division` valid ✓ Browser staging: tab Marturia `[Galeri,Kesaksian & Story,Penatalayan,Ibadah,Anggota]`; AssignModal Marturia hanya komponen Marturia (tanpa Worship Leader), Liturgia hanya Liturgia (tanpa Fotografer) ✓ Uji filter: buat penugasan Marturia 27 Sep → `division=MARTURIA` true, `division=LITURGIA` false, tanpa param true → lalu dihapus (staging bersih) ✓ Prod & staging = `f2f5a6d` ✓

### Next
1. Di UI prod: **Panel Marturia → Penatalayan**, tugaskan komponen Marturia untuk **27 Sep 2026** (AssignModal sekarang memuat 6 komponen Marturia).
2. Uji keluaran AI Didaskalia (Susun draf) untuk memastikan nuansa Reformed muncul & tetap kontekstual.
3. Kandidat berikutnya: rampingkan panel **Diakonia** (6 tab generik).


## Current — Liturgia/Marturia/Koinonia: panel dirampingkan (24 Sep 2026)

**Masalah:** pola duplikasi sama seperti Didaskalia — 6 tab generik identik (Ringkasan/Ibadah/Anggota/Diskusi/Drive/Rencana) di semua divisi; `Ringkasan`-nya "Rapat" ↔ tab `Rencana` (dua sistem rapat: `/events/:id/meetings` vs `/division-meetings`); `Diskusi` ↔ mini-feed di `Ibadah` ↔ "Aktivitas Terakhir"; `Drive` ↔ tombol "Drive Folder"; sebagian juga duplikat sidebar `Program & Event` (EventPenatalayanPanel + EventDivisionPhaseTabs + Rapat & Jadwal).

**Hasil IA:**
- **Liturgia: 7 → 3** — `Penatalayan`, `Ibadah`, `Anggota`
- **Marturia: 9 → 4** — `Galeri`, `Kesaksian & Story`, `Ibadah`, `Anggota` (tab `Penatalayan` dihapus — domainnya Liturgia & endpoint-nya tidak di-scope per divisi)
- **Koinonia: 7 → 3** — `Check-in`, `Ibadah`, `Anggota`
- `Ringkasan`, `Diskusi`, `Drive`, `Rencana` dibuang dari ketiganya; **Rapat/Agenda diserahkan ke sidebar `Program & Event`** — termasuk dihapus dari Didaskalia · Studio › Jadwal & Meet (prop `extraJadwal` dibuang).
- Strip ringkas (status penolakan + "Dari Rencana bulan") kini tampil untuk keempat divisi ber-panel ramping.
- **Diakonia tidak diubah** (6 tab generik) — kandidat berikutnya.

**Verifikasi:** `lint` bersih ✓ `test` 478 hijau ✓ `build` OK ✓ Browser (staging, `tech@gehc.demo` SUPERADMIN): Liturgia `[Penatalayan,Ibadah,Anggota]`, Marturia `[Galeri,Kesaksian & Story,Ibadah,Anggota]`, Koinonia `[Check-in,Ibadah,Anggota]`, Diakonia tetap 6 tab; Studio Didaskalia Jadwal & Meet tanpa "Rapat" (link Meet tetap); tanpa page error ✓ Prod & staging = `7af3fba` ✓

**Catatan / follow-up (pra-ada):** `/api/penatalayan/schedules` tanpa scope divisi (kalender lintas divisi); route `events-checkin` dijaga `requireRole('KOMISI','COMMITTEE')` bukan scope Koinonia; tab editor role Penatalayan tetap ber-scope `[LITURGIA, MARTURIA]` di dalam tab Penatalayan Liturgia.

### Next
1. Uji alur di UI: Penatalayan (bulk assign) Liturgia; Galeri + Kesaksian Marturia; Check-in Koinonia; Ibadah (tugas fase) ketiganya.
2. Kandidat berikutnya: rampingkan **Diakonia** (6 tab generik) dengan pola yang sama.


## Current — Didaskalia: panel dirampingkan jadi 3 sub-tab + Studio 6 sub-tab (24 Sep 2026)

**Masalah:** panel Didaskalia punya 8 sub-tab dengan banyak duplikasi: Materi/Drive muncul di 3 tempat (tab Drive, kartu di tab Ibadah, `EventDidaskaliaMaterials` di Info Event); Diskusi 2 tempat (tab divisi vs Diskusi Internal Studio); Rapat 2 tempat (Ringkasan vs Rencana); Warta 2 tempat (tab divisi vs sidebar). Isi Studio satu scroll panjang (7 kartu).

**Keputusan (pemilik):** pertahankan `EventDidaskaliaMaterials` di Info Event sebagai permukaan konsumsi mentor; riwayat Diskusi generik disembunyikan (data tetap); "Dari Rencana bulan" jadi strip ringkas.

**Hasil IA:**
- Panel divisi Didaskalia: **8 → 3 sub-tab** — `Studio`, `Kurikulum & Materi`, `Anggota`. Default = Studio.
- **Kurikulum & Materi** = gabungan 3 kartu subfolder (Pembekalan/Khotbah/RHB) + browser Drive (Folder Baru/Upload/daftar).
- Strip ringkas di atas konten: status penolakan divisi + "Dari Rencana bulan" (deliverable).
- Studio: **2 → 6 sub-tab** — `Inti` (Persetujuan HOD + Input inti & tombol AI), `7 Path`, `Khotbah`, `Diskusi`, `Terbitkan` (PDF + Presentasi/Caption), `Jadwal & Meet` (ritual + link Meet + **Rapat & Agenda** dipindah dari Ringkasan/Rencana via prop `extraJadwal`).
- Divisi lain **tidak berubah** (diverifikasi: Marturia 9 tab, Koinonia 7 tab).

**Verifikasi:** `lint` bersih ✓ `test` 478 hijau ✓ `build` OK ✓ Browser (staging, `tech@gehc.demo` SUPERADMIN): panel = `["Studio","Kurikulum & Materi","Anggota"]`; Studio = `["Inti","7 Path","Khotbah","Diskusi","Terbitkan","Jadwal & Meet"]`; Materi memuat Kurikulum/Folder/Upload; Anggota memuat "Tambah Anggota"; tanpa page error ✓ Prod & staging = `553c580` ✓

### Next
1. Uji alur di UI: upload materi per subfolder + browse Drive; Rapat/Agenda di Jadwal & Meet; tombol "AI + PDF Pembekalan".
2. (Opsional) Selaraskan `EventDidaskaliaMaterials` (Info Event) agar menautkan ke tab Kurikulum & Materi.

### Commands
```powershell
npm run lint; npm run test; npm run build
npm run staging:sync
```


## Current — Didaskalia: persetujuan HOD untuk AI regenerate + diskusi ber-scope + preview per sel (24 Sep 2026)

**Masalah:** AI langsung menimpa draf 7 Path/khotbah tanpa kontrol; diskusi internal tidak terarah ke bagian tertentu; tidak ada riwayat/undo; tidak ada pratinjau sebelum menimpa sel.

**Solusi:**
- **Semua generate AI (draft & perkaya) kini jadi PENGAJUAN** → disimpan di `studio.pendingRegen` (proposal + ringkasan + `diff`), **belum menimpa** data. Requester dapat notifikasi.
- **Persetujuan HOD**: `GET /api/didaskalia/studio/:ym/:week/approval` → `{ pending, history, canApprove }`; `POST …/approval/approve` (terapkan + `generation++` + catat riwayat) & `POST …/approval/reject` (alasan, requester dapat notifikasi). Approver = **kepala divisi DIDASKALIA (LEAD/CO_LEAD)**, **SUPERADMIN** bebas, **KOMISI** fallback bila tak ada kepala.
- **Riwayat + undo**: `POST …/regen-undo` mengembalikan snapshot versi sebelumnya (maks 20 entri).
- **Struktur dikunci**: `proposalFromDraft` mempertahankan jumlah Path, urutan hari (`dayLabel`), dan key 5 section RHB dari data saat ini — AI hanya mengisi isi.
- **Preview per sel**: tombol **AI** di Perenungan & Ringkasan Khotbah memanggil `/extras` dengan **scope diskusi** → hasil muncul sebagai kotak pratinjau **Terapkan / Batal** (tidak langsung menimpa).
- **Diskusi ber-scope**: dropdown bagian (Umum / Inti Pesan / Ringkasan Khotbah / Path N), chip scope per catatan, filter + dropdown bagian, tombol **+ Catatan** di tiap kartu Path (auto-arahkan ke `#didaskalia-discussion`), dan AI memakai `filterCommentsByScope` (GENERAL selalu ikut).
- **UI**: kartu **Persetujuan Regenerate & Riwayat** di panel Studio (diff before/after per bagian, Setujui/Tolak, daftar versi + Kembalikan).

**Verifikasi:** `lint` bersih ✓ **478 test** hijau (6 test baru: `tests/unit/didaskalia-regen.test.ts`) ✓ `build` OK ✓ smoke endpoint staging: GET approval 200, APPROVE → paths 7 + generation 1 + riwayat 1, REJECT → REJECTED + alasan, UNDO → pulih, pending null. **Prod `youth.gehc.page/api/version` = `c590dad`** ✓ **staging `c590dad`** (sama) ✓ Branch `staging` git = `c590dad` (sinkron) ✓ Residu uji minggu 4 staging dibersihkan (`reset-didaskalia-week --full --apply`).

### Next
1. Uji manual di UI (prod/staging): ajukan draf → HOD menyetujui → terapkan; coba Tolak + alasan lalu ajukan ulang; Kembalikan versi.
2. Uji preview per sel (Perenungan/Khotbah) + diskusi ber-scope (+ Catatan dari kartu Path).
3. Backlog: `ensure-weekly-divisions --apply` (staging 13, prod 4 event), Fase C email (butuh API key), P1-6 react-query, P2-6 split `DivisionWorkspacePanel`.

### Commands
```powershell
npm run lint; npm run test; npm run build
npx dotenv -e .env.staging -- node scripts/reset-didaskalia-week.mjs --ym 2026-09 --week 4 --full --apply
npm run staging:sync
```


## Current — Staging diselaraskan dengan main (23 Sep 2026)

**Masalah:** visual staging ≠ main. Ternyata **staging tertinggal 60 commit**.

| | Commit |
|---|---|
| Main / produksi (`youth.gehc.page`) | `c71ce18` |
| Staging (`staging-gehcpage.vercel.app`) — sebelum | `5423aa0` (commit main lama, 60 di belakang) |
| Branch git `staging` — sebelum | `6799436` (114 di belakang) |

**Penyebab:** `npm run deploy:staging` (`scripts/deploy-staging.mjs`) memakai `vercel deploy` dari **working tree** saat itu (bukan dari git) lalu memasang alias — jadi staging adalah snapshot build manual dan tidak ikut ter-update saat main berubah.

**Dilakukan:**
1. `vercel deploy --yes` (berhasil di percobaan ke-3; 2 percobaan pertama `fetch failed` — jaringan) → alias `staging-gehcpage.vercel.app` dipasang ke deployment itu.
2. Branch `staging` di-fast-forward: `git push origin main:staging` → kini `staging` = `main` (`c71ce18`).
3. Verifikasi: `staging/api/version` = **`c71cE18…` (sama dengan main)**; `/`, `/api/benzar/products`, `/subcategories` (16), `/pic` (Milithya — Bendahara Tim Kerja) semua **200**.

**Catatan operasional:** deploy staging bisa gagal `fetch failed` (jaringan) — cukup ulangi `vercel.cmd deploy --yes` beberapa kali, lalu `vercel alias set <url> staging-gehcpage.vercel.app --scope gehc`.

**Opsional (agar tidak drift lagi):** di dashboard Vercel, arahkan domain `staging-gehcpage.vercel.app` ke **branch `staging`** → setiap `git push origin main:staging` akan otomatis memperbarui staging (tanpa deploy manual).

## Current — BZP: pembayaran kapan pun + “Sudah Bayar” (verifikasi PIC) (23 Sep 2026)

**Masalah:** modal QRIS hanya muncul sekali setelah checkout; begitu ditutup, tidak ada jalan bayar (pesanan menggantung “Menunggu Bayar”).

**Solusi:**
- **Modal pembayaran (`PaymentModal`)** bisa dibuka kapan pun dari tombol **“Bayar sekarang”** di: **Pesanan Saya** (login), **hasil Lacak** (tamu), dan setelah checkout. Isi: kode (+ salin), total, **QRIS**, instruksi, **PIC dari DB**, **Kirim bukti ke WA**, **Unggah bukti (opsional)**, tombol utama **“Sudah Bayar”**.
- **“Sudah Bayar”** → `POST /api/benzar/orders/:id/claim-paid` (publik; verifikasi pemilik akun **atau** kode+HP tamu) → status **PAID (Menunggu Verifikasi)** + **timeline** (siapa/kapan/catatan) + **notifikasi ke PIC BZP**. Idempoten bila sudah diklaim.
- **Ingat pesanan di perangkat** (localStorage, maks 10) → tamu bisa kembali bayar tanpa login (“pesanan di perangkat ini”).
- **Unggah bukti oleh tamu** diizinkan (`payment-proof` menerima `phone` untuk verifikasi; `requireRole()` dihapus dari rute itu) → status naik ke PAID.
- **Portal (Pesanan)**: tombol **Verifikasi** (→ VERIFIED) & **Kembalikan** (ke Menunggu Bayar + **alasan** yang tampil ke pembeli), plus catatan klaim.
- Tanpa migrasi DB (memakai `timeline` JSON + status yang ada).

**Verifikasi:** `lint` bersih · **472 test** hijau · `build` OK · smoke staging: claim HP salah **403**, claim benar **200 PAID**, track menampilkan timeline+catatan, klaim ulang idempoten, admin kembalikan → PENDING + alasan, **upload bukti tamu 200** (status PAID).

### Next
1. Uji di prod: buat pesanan → tutup QRIS → buka **Pesanan Saya** → **Bayar sekarang** → **Sudah Bayar**.
2. PIC menerima notifikasi; verifikasi/kembalikan dari panel Pesanan.

## Current — BZP v4: tab mandiri, jadwal penatalayanan, multi-foto, PIC DB, promo jemaat (23 Sep 2026)

**A. BZP tanpa scaffolding divisi** — `div-benzarpr` tetap di grup **Divisi**, tetapi dirender **`BenzarStoreTab` langsung** (tanpa Program/Event, WhatsApp, kartu divisi, Submit for Review, Riwayat, dan tab Ringkasan·Ibadah·Anggota·Diskusi·Drive·Rencana). Tab `store` dihapus dari `DivisionWorkspacePanel`.

**B. Jadwal Jual pola penatalayanan** — tabel **`BzpSalesRole`** + `sales_role_id`; **10 role** di-seed; `SearchableMultiSelect` mencari **Komisi & Tim Kerja** (`GET /api/benzar/sales-people?q=`); **bulk assign** idempoten + **notifikasi aplikasi**; shift = tanggal + jam.

**C. Multi-foto + nama file** — unggah **banyak foto sekaligus**; tiap gambar menyimpan `name` (nama file asli, juga dipakai sebagai nama di Drive) dan bisa **rename**; **dropdown gambar varian menampilkan nama file**.

**D. PIC dari database** — `bzp_settings.pic_user_ids` (maks 3); **default Bendahara Tim Kerja** (diverifikasi: “Milithya Christy Kerin Wuisan — Bendahara Tim Kerja”); nama & nomor dari `User`/`StrukturMember`; **plus** penanggung jawab dari Jadwal Jual terdekat; API publik `GET /api/benzar/pic` (juga dipakai `/qris` & `/public-info`).

**E. Promo per-produk + jemaat** — `promos.scope` (GLOBAL/CATEGORY/SUBCATEGORY/PRODUCT) + `target_ids` + `auto_apply` + `max_discount`; audiens **MEMBER (jemaat login)**; diskon **per baris item**; jika beberapa cocok → **paling menguntungkan**; seed promo **`JEMAAT25`** = potongan **Rp25.000** untuk **Kaos Eben Haezer** (kode + otomatis saat login).

**F. Bersihkan prod** — skrip `server/cleanup-bzp-prod.mjs` (dry-run default): **2 pesanan dihapus**, **3 produk** (`tes`, `Kaos Benzar`, `Onde-Onde`) dihapus permanen. Sisa: 8 produk seed (draf).

**G. Status produk** — form kini punya toggle **“Aktif (tampil di katalog)”** (`isActive`, default **Aktif** untuk produk baru) terpisah dari “Sedang dijual”; tombol **aktif/nonaktif cepat** di tabel; input stok **disabled** saat memakai varian (stok = Σ varian).

**H. Modal anti-scroll** — footer **sticky** di semua modal BZP (Produk, Promo, Campaign, Shift, Sub-kategori).

**Migrasi & seed** (idempoten, sudah di **staging & prod**):
- `server/_migrate-bzp-v4.cjs`: `bzp_sales_roles`, `sales_shift_assignments.sales_role_id`, `promos.{scope,target_ids,auto_apply,max_discount}`, `bzp_settings.pic_user_ids`.
- `server/seed-bzp-sales.mjs` (`npm run db:seed:bzp-sales`): 10 role + promo `JEMAAT25`.
- `server/cleanup-bzp-prod.mjs` (`npm run db:cleanup:bzp-prod`).

**Verifikasi**: `lint` bersih · **472 test** hijau · `build` OK · uji lokal: BZP tanpa tab divisi (7 sub-tab), form punya toggle Aktif + sticky footer + dropdown sub-kategori, promo punya opsi **Jemaat** + scope **Produk tertentu** + auto-apply, PIC = Bendahara Tim Kerja dari DB, promo jemaat ditolak untuk tamu (400) · 0 error.

catatan: promo otomatis bernilai 0 selama **harga produk masih 0 (draf)** — potongan di-cap ke nilai barang; akan berlaku setelah harga diisi.

### Next
1. Di panel BZP: unggah foto (multi, beri nama), isi harga/stok varian, lalu **aktifkan** produk (toggle “Aktif”).
2. Uji promo jemaat (`JEMAAT25`) setelah harga Kaos diisi.
3. Buat Jadwal Jual: pilih tanggal/jam → tambah petugas per role (cari Komisi/Tim Kerja).

## Current — Seed produk BZP di PROD (draf) (23 Sep 2026)

**Goal:** Mengisi produk nyata ke prod: Kaos Eben Haezer (Putih/Ungu × ukuran), makanan & minuman yang pernah dijual.

**Done:**
- **Skrip** `server/seed-bzp-products.mjs` (idempoten, **dry-run default**, `--apply`; `npm run db:seed:bzp-products`).
- **8 produk dibuat di prod sebagai DRAF** (`isActive:false`, harga 0 → belum tampil, aman dari salah harga):
  - **Kaos Eben Haezer** (MERCHANDISE · `clothing`) — **28 varian** = Warna (Putih, Ungu) × Ukuran (Dewasa XS–5XL + Anak No.2–10).
  - **Rice Bowl (Ayam Rica-rica)**, **Rice Bowl (Ayam Suir)**, **Sate Babi**, **Babi Utang** (FUNDRAISING·PRODUCT · `food`, tanpa varian).
  - **Es Buah** (`beverage`) — varian *Isi*: Es Campur, Es Campur pakai Sirup.
  - **Air Mineral** (`beverage`) — varian *Ukuran*: 330 ml, 600 ml, 1.500 ml.
  - **Puding Sedot** (`dessert`) — varian *Rasa*: Coklat, Matcha, Strawberi, Buah.
  - Total **37 varian**.
- **Dibersihkan**: `Kaos Benzar` & `tes` dinonaktifkan (draf). `Onde-Onde` tetap aktif.
- **Verifikasi prod**: 11 produk total · hanya `Onde-Onde` tampil di storefront (draf tersembunyi) · varian Kaos 28.

**Catatan**: gambar produk **belum ada** (foto dikirim via chat) → unggah via panel; setelah itu isi harga/stok lalu aktifkan.

### Next
1. Di panel BZP: unggah foto kaos (Putih/Ungu) & varian lain, isi **harga jual/modal** + **stok varian**, lalu **aktifkan** produk.
2. Aktifkan `Onde-Onde` bila stok berubah; hapus/nonaktifkan permanen `tes` bila perlu.

## Current — RBAC panel per-divisi + BZP v3 (sub-kategori, varian, size chart) (23 Sep 2026)

### A. Panel divisi hanya untuk divisinya (UI + server)
- **Baru** `server/lib/division-access.mjs`: `headDivisions()` (LEAD/CO_LEAD **per-divisi**), `divisionCodesFor()`, `canAccessDivision()`, `requireDivision()` (403).
- **Guard server** dipasang pada: `/api/events/:eventId/divisions/:div/*` (tulis/kelola), **BZP pengelolaan** (`BENZARPR`), **Didaskalia Studio tulis** (`DIDASKALIA`), **Marturia arsip/galeri** (`MARTURIA`).
  - **Tetap publik/konsumen**: katalog BZP, QRIS, campaign publik, donasi, order buat/track, `/api/didaskalia/presentation` (RBAC 01/02/03), dan GET materi divisi (drive 01/02/03) — agar mentor tetap bisa akses RHB.
- **UI**: `/api/me/divisions` → `{ divisions, headDivisions, isSuperadmin }`; `useMyDivisions()` diperluas + `canSee(tabId)`; `div-*` **dihapus** dari allowlist `KOMISI`/`COMMITTEE`; `PortalLayout` menampilkan tab divisi hanya bila berhak + **kartu "Tidak berhak"** untuk deep link.
- **Konsekuensi**: KOMISI/Tim Kerja tanpa divisi tidak melihat panel divisi apa pun; anggota Tim Kerja event tetap dapat panelnya; kepala divisi hanya divisinya.
- Verifikasi: unit test (`canSeeDivisionTab`, `canAccessDivision`) + smoke API — KOMISI tanpa divisi **403** di BZP & events/divisions, publik **200**.

### B. BZP v3: sub-kategori terkelola + varian + size chart
- **Skema** (migrasi `server/_migrate-bzp-v3.cjs`, sudah di **staging & prod**, idempoten): `bzp_subcategories` (bilingual `nameId`/`nameEn` + `sizeChart` + `optionNames`), `product_options`, `product_variants`; `products.subcategory_id/has_variants`; `order_items.variant_id/variant_label`; **unique `(order_id, product_id)` dihapus** (mendukung multi-varian 1 pesanan).
- **Seed** `server/seed-bzp-catalog.mjs` (`npm run db:seed:bzp-catalog`): 16 sub-kategori bilingual (Fashion/Drinkware/Food/Lain) + **size chart Clothing** (Dewasa XS–5XL, Anak No.2–10, notes) — sudah dijalankan di staging & **prod**.
- **Backend**: CRUD sub-kategori; produk menerima `options[]`+`variants[]` (stok **otomatis = Σ varian**); order menerima `variantId` (validasi stok per varian, harga per varian, label varian); batal → stok varian dikembalikan.
- **Frontend publik**: pemilih **Warna/Ukuran** (chip, stok habis dicoret), **size chart** per sub-kategori, harga & stok per varian, keranjang per varian.
- **Portal**: dropdown sub-kategori, **editor varian** (opsi → "Hasilkan varian" → tabel stok/harga/SKU/gambar per varian), tab **Katalog** (CRUD sub-kategori + editor size chart).
- Verifikasi: smoke API (produk 4 varian → stok 20; order 2 varian → total 290.000; stok jadi 17 & varian 3; order tanpa varian → 400) + render lokal (chip varian, size chart, tab Katalog 7 sub-tab) — 0 error.

**Global**: `lint` bersih · **472 test** hijau · `build` OK.

### Next
1. Uji di prod: buka BZP sebagai BENZARPR, buat produk Clothing dengan varian, cek storefront (chip + size chart).
2. Isi/ganti size chart & sub-kategori lain lewat tab **Katalog** sesuai kebutuhan.

## Current — Benzarpreneurship v2 (analisis PDF "BZP Input" → semua kebutuhan) (23 Sep 2026)

**Sumber kebutuhan:** `Services/Khotbah/BZP Input.pdf` (catatan feedback tim BZP).

**Skema (migrasi `server/_migrate-bzp-v2.cjs`, sudah di staging & **prod**):**
- **Product** + `sub_category, fundraising_type (SERVICE|PRODUCT), is_on_sale, is_preorder, fulfillment_options, cogs, operating_cost, yield_qty, event_id`
- **Order** + `user_id` **nullable (guest)**, `guest_name/guest_phone/guest_email, subtotal, discount_total, delivery_fee, promo_code, fulfillment, cancel_reason, timeline, event_id`
- **Baru:** `product_price_history, promos, campaigns, campaign_donations, bzp_settings, sales_shifts, sales_shift_assignments`

**Backend (`server/index.mjs` + `routes/drive-ownership.mjs`):**
- Produk: simpan **buyPrice** (bug utama diperbaiki) + **modal bulk** otomatis `(cogs+operatingCost)/yieldQty`; filter `q/category/subCategory/onSale/all`; **riwayat harga**; PATCH images (hapus/urut).
- Pesanan: **guest checkout** (nama+HP), `fulfillment` (PICKUP/DELIVERY/DINE_IN/TAKEAWAY)+ongkir, **promo**, `subtotal/discount/total`, **timeline**; `PATCH status` (semua status + **alasan batal** + notifikasi); **track** `GET /orders/track?code=&phone=`; invoice/bukti via `kind=proof|invoice`.
- Baru: **promos CRUD + validate**, **campaigns CRUD + donations + verifikasi**, **settings** (PIC 2–3, ongkir, QRIS, WA), **sales-shifts + assignments**, **caption** (`/api/benzar/caption/:id` → teks + deep link `#/benzarpreneurship?item=<id>`).

**Frontend:**
- **Publik** (`BenzarpreneurshipPage`): search bar, chip **sub-kategori**, pemisah **Sedang dijual / arsip**, **galeri** multi-foto, **checkout tamu** + dialog **"Simpan riwayat pesanan? (Abaikan / Login dulu)"**, pilihan pemenuhan + ongkir, **kode promo**, **Pesanan Saya/lacak**, **Campaign donasi** (progress + grand total + form donasi anonim), **PIC** di footer, tombol **bagikan/salin link** per produk.
- **Portal** (`BenzarStoreTab`): 6 sub-tab — **Produk** (foto multi + preview + hapus, modal manual/bulk, sub-kategori, tipe fundraising, pre-order, on-sale, riwayat harga, caption WA), **Pesanan** (pipeline semua status, alasan batal, timeline, bukti TF/invoice, tampil guest), **Promo**, **Campaign** (+verifikasi donasi), **Jadwal Jual** (shift + role + assignment), **Pengaturan** (PIC/ongkir/QRIS/WA).

**Verifikasi:**
- `lint` bersih · **463 test** hijau · `build` OK.
- **Smoke test API (staging)**: buyPrice tersimpan (55000) · modal bulk (20000) · promo validate (diskon 9000) · **guest order** total 81000 · track OK · campaign+donasi (grandTotal 50000) · shift+assignment · settings+PIC · caption deep link — **semua lolos**; data uji dibersihkan.
- **Render lokal**: publik (search/track/filter/campaign) & portal (6 sub-tab) — 0 error.
- **Migrasi prod** dijalankan & diverifikasi idempoten (30 item sudah ada, 0 perlu dibuat).

### Next
1. Isi **Pengaturan BZP** (PIC, ongkir, QRIS) lalu uji alur: buat produk+foto → promo → checkout tamu → verifikasi → invoice.
2. Seed opsional: `node server/seed-benzar.mjs` (belum masuk `package.json`).

## Current — Full reset pekan 27 Sep + jaring pengaman Bagian A/B + AI image aktif (23 Sep 2026)

**Goal:** Mulai simulasi dari awal untuk 2026-09 pekan 4; pastikan Bagian A/B selalu terisi; aktifkan AI image.

**Done:**
- **Akses model gambar AKTIF** — diverifikasi: `GET /v1/models` → `gpt-4o-mini`, **`gpt-image-1-mini`**.
- **Uji end-to-end (staging)**: `POST …/generate-image` → **201** (32,6 dtk, `gpt-image-1-mini`, kuota 1/3); `POST …/extras` → **200** (deliveryPlan 2 · prepChecklist 6 · discussionFlow 6).
- **Jaring pengaman Bagian A/B**: `generateWeekExtras()` + endpoint `POST /api/didaskalia/studio/:ym/:week/extras`; **Studio otomatis memanggil `/extras`** setelah draf/enrich bila `deliveryPlan`/`prepChecklist`/`discussionFlow` kosong. Prompt dipertegas (WAJIB + contoh) dan `maxTokens` draft/enrich 4096 → **5120**.
- **Skrip reset** `scripts/reset-didaskalia-week.mjs` kini punya flag **`--full`** (paths + sermon + `generation` + `presentation` + `render`).
- **Full reset prod 2026-09 pekan 4 (27 Sep, "The Call to Serve")** — diverifikasi: `paths 0` · `sermon 0` · `generation 0` · `presentation {}` · `render {}`; brief tetap (Chapter `0`, FF `2 Kor 3:7-11`, Kitab Fokus `1 Timotius 3:1-13`, 3 metode, mix, diskusi).
- **Staging** juga dibersihkan (uji tidak tertinggal).
- Verifikasi: `lint` bersih · **463 test** hijau · `build` OK.

### Next
1. Simulasi di prod Studio pekan 4: **Susun draf** (otomatis lanjut `/extras` bila perlu) → diskusi internal → **Perkaya dengan diskusi** → **Generate gambar cover (AI)** (kuota 3) → terbitkan PDF & cek deck.
2. **Backfill divisi** (`scripts/ensure-weekly-divisions.mjs --apply`) masih menunggu izin.

## Current — Persona audiens, kesinambungan minggu, cover background + AI image (23 Sep 2026)

**Goal:** Persona AI lebih tepat (mahasiswa & pekerja), konteks minggu lalu/depan, dan cover bergaya "gambar full-bleed + teks overlay" (opsi AI image).

**Done:**
- **Persona** (`server/lib/didaskalia-ai.mjs` SYSTEM): audiens **mayoritas mahasiswa & pekerja pabrik/kantor** + anak rantau Cikarang; ilustrasi/penerapan menyentuh kuliah (KRS, tugas, skripsi, magang), kerja (shift, lembur, target, gaji pertama), kos/kontrakan, keuangan, relasi.
- **Kesinambungan**: `summarizeWeek()` (baru) → `buildContext` menyertakan blok **MINGGU LALU / MINGGU DEPAN** (tema, FF, Kitab Fokus, 7 judul Path + summary, ringkasan khotbah). Prompt: Path 1 menyambung eksplisit, Path 7 menjembatani. Dipakai di `/draft` dan `/enrich`. **Tanpa perubahan skema.** Referensi pendek cukup via **Diskusi Internal** (jadi `notes`).
- **Cover background + overlay**: `DeckSlide.background` → deck merender cover **full-bleed** + scrim + teks putih; **PDF** `cover()` memakai `coverImage` sebagai **full-page background** + scrim; **RHB PDF** memakai **band background** (gambar + scrim) di atas 5 section.
- **AI image (opsional)**: `generateImageBase64()` (`server/ai-provider.mjs`) + endpoint `POST /api/didaskalia/studio/:ym/:week/generate-image` (gpt-image-1-mini medium, 1024×1536, **tanpa teks** dalam gambar) → unggah ke Drive `04 Presentasi` → set `presentation.cover`; **kuota 3/pekan** (`presentation.aiImages`). Studio: kartu **"Gambar Cover"** (unggah manual + prompt + tombol generate + kuota).
  - **Status akses**: kunci OpenAI saat ini **belum punya akses model gambar** (`gpt-image-1/-mini/-2` ditolak; `dall-e-3` error param) → endpoint mengembalikan pesan jelas (`IMAGE_MODEL_UNAVAILABLE`) dan UI menyarankan unggah manual. Fitur siap begitu akses diaktifkan (atau set `AI_IMAGE_MODEL`).
  - **Biaya** (bila aktif): ditagih **per gambar** — mini medium ≈ **$0.015**; maks 3/pekan ≈ $0.045.
- **Verifikasi**: `lint` bersih · **463 test** hijau · `build` OK · PDF anti-overlap dicek terprogram untuk cover **dengan** dan **tanpa** background (**TIDAK ADA OVERLAP**) · Studio menampilkan kartu cover + tombol AI + kuota, 0 error · endpoint generate-image diuji (auth/validasi/prompt jalan; gagal hanya di akses model).

### Next
1. Aktifkan akses model gambar di project OpenAI (atau set `AI_IMAGE_MODEL`) → uji "Generate gambar cover (AI)".
2. Generate ulang 2026-09 pekan 4 (draf → diskusi → perkaya) lalu cek cover background di PDF & deck.
3. **Backfill divisi** (`scripts/ensure-weekly-divisions.mjs --apply`) masih menunggu izin.

## Current — Pembekalan 2 fokus + PDF anti-overlap + Path mulai Minggu (23 Sep 2026)

**Goal:** Sesuai masukan: Path 1 = Minggu; PDF rapi (tanpa tumpang-tindih); alur diskusi kontekstual; Pembekalan difokuskan ke persiapan/penyampaian khotbah + FGD, Path jadi ringkasan 7 hari.

**Done:**
- **Urutan hari**: `DAY_LABELS` → `['Minggu','Senin',…,'Sabtu']` (client + `didaskalia-ai.mjs`). **Path 1 = Minggu (hari khotbah) → Path 7 = Sabtu**.
- **PDF anti-overlap** (`Writer`, `didaskaliaPdf.ts`): teks digambar dengan offset ascender (`y + size*0.32`) + `label` advance 6 → tidak ada lagi teks menimpa. **Diverifikasi terprogram**: ekstraksi posisi teks dari PDF hasil → **TIDAK ADA OVERLAP** (Pembekalan & RHB).
- **Pembekalan (01) 2 fokus** (judul tetap "Modul Pembekalan Mentor & Co-Mentor"):
  - **Bagian A — untuk deliverer** (label otomatis: `MENTORING_DAY` → "Perwakilan Tim Didaskalia"; `SERVING_DAY` → "Perwakilan yang akan Berkhotbah"): Panduan Deliver per Metode (+%), Ringkasan Khotbah, Kerangka Slide, Checklist Persiapan.
  - **Bagian B — untuk mentor & co-mentor**: Alur FGD Hari Minggu (kontekstual) + **Gambaran 7 Hari (Minggu–Sabtu)** 1 halaman ringkas (hari + judul + 1 kalimat).
  - **Dihapus**: breakdown 1 halaman per Path (PDF) & slide per-Path (deck).
- **Field AI baru**: `sermon.deliveryPlan[]`, `sermon.prepChecklist[]`, `sermon.discussionFlow[]`, `paths[].summary` — diprompt, di-clamp, di-sanitize, dan bisa diedit di Studio.
- **Studio**: field Ringkasan Hari per Path; kartu Bagian A (Panduan Deliver + Checklist) & Bagian B (Alur FGD); label deliverer dari jenis event; `serviceType` diteruskan ke PDF.
- **Deck & PDF** memakai struktur baru (deck: kerangka slide per-slide; PDF: kerangka slide 1 halaman).
- Verifikasi: `lint` bersih · **462 test** hijau · `build` OK · deck lokal: Pembekalan 4 slide (studio kosong → slide opsional difilter), RHB hari-1 7 slide, indeks RHB OK, 0 error.

### Next
1. Deploy `main`; generate ulang **2026-09 pekan 4** (Susun draf → diskusi → Perkaya) lalu cek PDF Pembekalan (Bagian A/B) & deck.
2. **Backfill divisi** (`scripts/ensure-weekly-divisions.mjs --apply`) masih menunggu izin.

## Current — Didaskalia: Bacaan Alkitab + Nats Pembimbing, judul Path EN, alur 2 tahap (23 Sep 2026)

**Goal:** Selaraskan materi dengan dokumen referensi (`Services/Youth/Didaskalia/06.09.26`): tiap hari punya **Bacaan Alkitab** (dari Kitab Fokus) + **Nats Pembimbing**; judul Path Bahasa Inggris; alur tema FF → Khotbah → Kitab Fokus; generasi ke-2 diperkaya diskusi.

**Done (Tahap 1 — deployed `7ce2d4a`):**
- **Model**: `DidaskaliaPath.bacaanRef` (Bacaan Alkitab); `scriptureRef/Text` = Nats Pembimbing; judul section RHB 4/5 → **"Pertanyaan untuk Refleksi Pribadi"** / **"Pertanyaan untuk Diskusi Kelompok"** (sesuai dokumen asli); `DidaskaliaStudio.generation`.
- **Prompt AI** (`didaskalia-ai.mjs`): ALUR PEMIKIRAN (FF = jangkar tema → Ringkasan diturunkan dari FF → diarahkan ke Kitab Fokus; tiap metode sesuai % menajamkan FF); judul 7 Path **Bahasa Inggris** catchy; **Bacaan Alkitab = rentang Kitab Fokus dibagi 7 hari**; **Nats Pembimbing** per hari; kesinambungan tema minggu sebelum/sesudah.
- **Tahap 2**: `POST /api/didaskalia/studio/:ym/:week/enrich` (`generateEnrichedDraft`) — memperkaya draf dengan diskusi internal tanpa membuang struktur; `generation` bertambah tiap draft/enrich.
- **Studio**: field **Bacaan Alkitab** + **Nats Pembimbing**; tombol **"Perkaya dengan diskusi"**; indikator **"Generasi ke-N"** (peringatan bila >3).
- **Deck & PDF** menampilkan Bacaan Alkitab + Nats Pembimbing (cover RHB, slide Path, PDF modul/RHB).
- **Skrip** `scripts/reset-didaskalia-week.mjs` (`--ym --week`, dry-run default, `--apply`).

**Done (Tahap 2 — prod):**
- Hapus hasil AI **2026-09 minggu ke-4 (27 Sep, "The Call to Serve")**: `paths` → `[]`, `sermon` → kosong. Dipertahankan: Chapter `0`, FF `2 Kor 3:7-11`, Kitab Fokus `1 Timotius 3:1-13`, 3 metode, methodMix, diskusi, DRAFT. Verifikasi: paths 0 · sermon 0.

**Verifikasi:** `lint` bersih · **462 test** hijau · `build` OK · prod `7ce2d4a` (`/` 200).

### Next
1. Generate ulang 2026-09 pekan 4 dengan aturan baru: **Susun draf** → diskusi internal → **Perkaya dengan diskusi** (maks 2–3×).
2. Uji deck: `#/materi/pembekalan/2026-09/4`, `#/materi/rhb/2026-09/4`, harian `…/4/1`.
3. **Backfill divisi** (`scripts/ensure-weekly-divisions.mjs --apply`) masih menunggu izin.

## Current — Studio Didaskalia: ayat picker, 7 metode, analisa %, diskusi ber-nama (23 Sep 2026)

**Goal:** Permudah Studio: pilih referensi ayat, Chapter angka, 7 metode kanonik (tooltip), analisa metode %, dan Diskusi Internal ber-nama yang dipakai AI.

**Done:**
- **Ayat picker** (`BibleRefPicker.tsx` + `src/data/bible-books.ts` 66 kitab): **Kitab → Pasal → Ayat** (referensi saja; teks manual opsional). Dipakai di **Fundamental Firman (ayat)**; nilai lama di-parse, bisa "Ketik manual".
- **Chapter** → number picker (`type=number`, min 0).
- **7 metode kanonik** (`src/data/homiletic-methods.ts`): Teologi Sistematika, Teologi Biblika, Pengajaran Tematika, Pengajaran Ekspositori, Apologetika, Teologi Praktika/Pastoral, Teologi Historis — chip + **ikon info tooltip** (deskripsi + analogi). Nilai lama tetap tampil. Disinkron ke `server/lib/didaskalia-ai.mjs` + prompt AI.
- **Analisa Metode (%)** — field baru `methodMix` (client+server whitelist) + AI mengusulkan; baris metode/%/catatan + total.
- **"Teks Fundamental Firman"** → label **"Inti Pesan (Big Idea) & Kerangka"** + hint (bukan teks ayat).
- **Diskusi Internal**: simpan **nama + peran** pemberi usul; toggle **"Pakai diskusi sebagai konteks AI"** → isi diskusi dikirim sebagai `notes` ke AI draf.
- **Visibilitas divisi (Fase 3b)**: `GET /api/me/divisions` + `useMyDivisions()`; `PortalLayout` → staf (KOMISI/SUPERADMIN) + **BOD Tim Kerja** lihat semua; anggota divisi hanya divisinya.
- Verifikasi: `lint` bersih · **449 test** hijau · `build` OK · render Studio (chapter number, picker kitab, 7 metode+tooltip, methodMix, Big Idea, diskusi) 0 error; `/api/me/divisions` 200.

### Susulan Studio (23 Sep 2026)
- **Kitab/Bagian Fokus** kini juga pakai **BibleRefPicker** (2 picker ayat).
- **Chapter** → **dropdown** `Chapter 0…52` (bukan input angka).
- **AI + PDF Pembekalan**: tombol baru → AI menyusun 7 Path lalu **membangun & mengunduh PDF Pembekalan (01)** memakai `buildPembekalanPdf`.
- **Fix error "Unexpected token 'A'… not valid JSON"**: klien kini baca respons aman (`readJson`, non-JSON → `{}`) + pesan `… (server <status>)`; `vercel.json` `maxDuration` 30 → **60** (AI draft bisa lama).

## Current — Presentasi Web Didaskalia per Pekan/Hari (23 Sep 2026)

**Goal:** Materi generated jadi **deck presentasi ber-URL** (bukan hanya PDF): per pekan (Pembekalan/Khutbah) dan **per hari RHB**, template tetap, gambar opsional per section, plus **caption siap-kirim** ke grup.

**Done (4 fase):**
- **Fase 1 — Deck + rute + RBAC.** `src/lib/didaskalia-presentation.ts` (template tetap: `buildPembekalanDeck` cover→panduan→alur→7 Path→penutup; `buildRhbDayDeck` cover→**5 section**→penutup; `buildKhutbahDeck`), `src/components/presentation/DeckShell.tsx` (navigasi slide, fullscreen, keyboard), `src/components/didaskalia/DidaskaliaPresentation.tsx`. Rute **`#/materi/<doc>/<YYYY-MM>/<pekan>[/<hari>]`** via `isMaterialHash` (`host-context.ts` + `main.tsx`, standalone lazy). Endpoint `GET /api/didaskalia/presentation/:ym/:week?doc=` — **401 anon**, **403** bila role tak berhak (aturan 01/02 mentor+staf, 03 beyonders+staf).
- **Fase 2 — Snapshot rilis.** Publish (`didaskalia-studio.mjs`) menyimpan `render[doc].snapshot` (konten beku) → minggu lama tidak berubah walau studio diedit; endpoint menyajikan snapshot bila ada, else live. Studio menandai "snapshot rilis" / "belum ada snapshot".
- **Fase 3 — Gambar + parity PDF.** 5 section RHB (`RHB_SECTIONS` di client+server+AI); `POST /api/didaskalia/studio/:ym/:week/presentation-image` (upload ke Drive event, subfolder `04 Presentasi`) + `GET /api/didaskalia/asset/:fileId` (proxy gambar login-gated, tanpa share publik). `ImageSlot` di Studio (hero hari + gambar per section). PDF RHB kini render 5 section + gambar (`rhbSectionImages`); PDF lain pakai `coverImage`/`pathImages`.
- **Fase 4 — Caption + indeks + cetak.** `src/lib/rhb-caption.ts` (`buildDayCaption`, `buildWeekCaption`, `whatsappShareUrl`, `copyText`); panel Caption di halaman presentasi (Salin/Bagikan/WhatsApp + **kirim notifikasi aplikasi ke kelompok** via `POST /api/announcements` kategori `materi`); indeks RHB `#/materi/rhb/<ym>/<pekan>` (7 hari + "Buka"); tombol Cetak (`window.print` + print CSS); tautan presentasi/caption di **Studio** + **EventDidaskaliaMaterials** (pakai `church-week.ts`).
- **AI**: prompt `generateWeekDraft` menghasilkan `rhbSections` (5 key tetap); `clampDraft`/`sanitizeStudio` menormalkan key+urutan.
- Verifikasi: `lint` bersih · **461 test** hijau (12 test baru) · `build` OK · render lokal: indeks RHB 7 link, deck pembekalan **11 slide**, RHB hari-3 **7 slide**, khutbah **2 slide**, 0 page error; API 200 authed / 401 anon.

### Next
1. Uji di prod: Studio → isi Fundamental via picker, metode+%, Diskusi (nama muncul), AI draf (pakai diskusi).
2. **Backfill divisi** (`scripts/ensure-weekly-divisions.mjs --apply`) masih menunggu izin.
3. Sisa: Fase C email, P1-6 react-query, P2-6 lanjutan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Panel per-divisi (Fase 1 IA) (23 Sep 2026)

**Goal:** Tiap divisi jadi destinasi sendiri di sidebar (bukan tab di dalam satu panel), agar alur lebih fokus dan tanggal/event tak dipilih berulang.

**Done (Fase 1):**
- **Nav** (`portal-nav-config.ts`): `divisions` diganti **6 item** `div-liturgia/didaskalia/koinonia/diakonia/marturia/benzarpr` (grup sidebar **"Divisi"**, roles staf KOMISI/COMMITTEE/SUPERADMIN); `divisions` lama jadi **alias** (redirect ke divisi pertama yang boleh).
- **PortalLayout**: `NAV_ICONS` 6 id; render `div-*` → `<DivisionWorkspacePanel division="…" />`; efek alias `divisions` → `div-liturgia` (dst.).
- **DivisionWorkspacePanel**: prop `division?` → `selectedDiv` tetap & **tab bar 6 divisi disembunyikan**; event selector + toggle arsip tetap.
- **i18n** (ID/EN): label 6 divisi, `navGroups.Divisi`, + 6 guide divisi (unit test "every sidebar nav id has a guide").
- Verifikasi: `lint` bersih · **449 test** hijau · `build` OK · render lokal `#/portal/superadmin/div-didaskalia` (tab Didaskalia: Studio+Warta; tanpa tab 6 divisi; 14 chip event; 0 error); alias `divisions` → `div-liturgia`.

### Next
1. **Fase 3b** — visibilitas anggota divisi (`GET /api/me/divisions` + filter nav `div-*`).
2. **Backfill divisi (menunggu izin `--apply`)**: `scripts/ensure-weekly-divisions.mjs` — dry-run staging **13 event** (semua kurang), prod **4 event** (kurang BENZARPR/DIAKONIA dll). Jalankan `--apply` staging lalu prod.
3. Sisa lain: Fase C email (butuh API key), P1-6 react-query, P2-6 lanjutan.

### Fase 3a (SELESAI) — auto akses mingguan
- Baru `server/lib/event-divisions.mjs` (`ensureEventDivisions` idempoten, `isWeeklyWorshipEvent`).
- `POST /api/events`: event ibadah (UMUM/SERVING_DAY/MENTORING_DAY) otomatis dapat **6 divisi**.
- Baru `POST /api/events/:id/divisions/ensure` (staf) — melengkapi divisi yang kurang.
- `DivisionWorkspacePanel` (per-divisi): auto-panggil `ensure` sekali saat event terpilih belum punya workspace divisi itu, lalu muat ulang.
- Baru `scripts/ensure-weekly-divisions.mjs` (`npm run db:ensure:weekly-divisions`) — backfill dry-run/apply.
3. Sisa lain: Fase C email (butuh API key), P1-6 react-query, P2-6 lanjutan.

### Fase 2 (SELESAI) — Studio ikut event
- Baru `src/lib/church-week.ts` (`sundaysInMonth`, `yearMonthWib`, `weekIndexForDateWib`).
- `DivisionWorkspacePanel` menurunkan `yearMonth`/`weekIndex` dari `selectedEvent.eventDate` (WIB) → prop ke `DidaskaliaStudioPanel`.
- `DidaskaliaStudioPanel` menerima prop; **select Bulan/Minggu dihapus** (diganti konteks *"Event: … · tanggal"*); tetap kompatibel tanpa prop.
- Verifikasi: `lint`/`test`/`build` hijau; render `div-didaskalia` → Studio "Event: …", `selects: 0`, 0 error.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Galeri event mudah untuk Marturia (23 Sep 2026)

**Goal:** Fitur galeri yang tim Marturia pakai untuk update activity & event dibuat semudah alur Album Kelompok (mentor/co-mentor): auto folder Drive, upload foto, preview ≤5.

**Done:**
- **Server** (`server/routes/drive-ownership.mjs`): `POST /api/events/:id/gallery/photos` — Marturia Dokumentasi/Komisi; pastikan folder arsip auto (`ensureEventArchiveFolder` → set `archiveFolderId`), upload JPEG (`publicReader:true`), lalu catat baris **`EventGallery`** (`status APPROVED`, `division`, `driveFileId`, `mediaUrl/thumbUrl`).
- **Klien** (`EventGalleryTab.tsx`, dipakai semua divisi): toolbar **"Galeri Event"** — nama+tanggal **auto** dari event; **multi-upload** file; **pin preview ≤5** (centang + indikator `n/5`, simpan via `POST /api/events/:id/archive`); tombol **Folder Drive**. Form URL manual lama dipindah ke **"Lanjutan (URL)"**.
- **Dipakai ulang** (tanpa ubah): list `/api/gallery?eventId=`, preview `/api/events/:id/archive`, link `/api/events/:id/archive-link`, landing `/api/events/public-archive`.
- **Event arsip bisa digarap lagi** (`DivisionWorkspacePanel.tsx`): toggle **"Tampilkan arsip"** di pemilih event (default off; arsip diurut paling bawah + label `ARSIP`). Sebelumnya `ARCHIVED` difilter keluar sehingga Marturia tak bisa buat galeri untuk event lampau. Pemilihan default kini ke event non-arsip. Tanpa perubahan server (upload auto-buat folder arsip; landing sudah memuat ARCHIVED).
- Verifikasi: `lint` bersih · **449 test** hijau · `build` OK · runtime: anon upload **401**, event tak ada **404** (route aktif).

### Next
1. Uji di prod (Divisi → Marturia → Galeri): pilih event → upload beberapa foto → sematkan ≤5 preview → cek landing "Galeri & Arsip".
2. Sisa: Fase C email (butuh API key), P1-6 react-query, P2-6 lanjutan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — P2-4: satu destinasi Warta (22 Sep 2026)

**Goal:** Satukan 2 editor warta (ManageWeeklyInfo vs WartaPublikTab) jadi satu alur.

**Done:**
- **`WartaWorkspacePanel.tsx`** (baru): sub-tab **Publikasi** (`WartaPublikTab`, editor utama + sync ke publik) dan **Arsip & Umum** (`ManageWeeklyInfo`).
- **`PortalLayout`**: tab `content-weekly` merender `WartaWorkspacePanel`.
- **Nav**: label `content-weekly` → **"Warta"** (ID) / "Bulletin" (EN); roles `['COMMITTEE']` → `['KOMISI','COMMITTEE']`.
- **i18n**: `portal.wartaWorkspace` (tab + hint) di ID/EN.
- Divisi (Didaskalia) tidak diubah; `WartaPublikTab.division` ternyata tidak dipakai → aman di luar divisi.
- **Slide ProPresenter** (artefak episode lalu) di-commit: `public/presenter/*` + `scripts/slides/*` + `scripts/render-slides.mjs`.
- Verifikasi: `lint` bersih · **449 test** hijau · `build` OK · e2e nav lolos (tech, stevania, theodore) · render `#/portal/{committee,komisi}/content-weekly` menampilkan kedua sub-tab tanpa error.

### Next
1. Uji di prod: buka **Warta** (grup Konten) sebagai Komisi/Tim Kerja → isi via tab Publikasi; cek landing.
2. **Task 3 (SELESAI)**: `scripts/sync-mentor-members.mjs` — dry-run staging 0; **apply prod dibuat 1 baris** (`Dunamis 2026-09 MENTOR Jeremia`, grp-9 `memberCount` 11). Dry-run ulang = 0 (idempoten).
3. Sisa: Fase C email (butuh API key), P1-6 react-query, P2-6 lanjutan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Kanal WhatsApp: kepemimpinan Mentor & Koordinator Divisi (22 Sep 2026)

**Goal:** Tambah kanal di tab **Kepemimpinan** (Kanal WhatsApp): "Mentor & Co-Mentor" dan **satu** kanal "Koordinator Panca Tugas" (isi: HOD + BOD).

**Done:**
- **Katalog** (`server/lib/channel-link-access.mjs`): `LEADERSHIP_CATALOG` + `MENTORS` ("Mentor & Co-Mentor") dan `KOORD_PANCA` ("Koordinator Panca Tugas"). Otomatis muncul di panel Kanal WhatsApp → Kepemimpinan (Komisi/Admin mengisi tautan).
- **Visibilitas "Grup WhatsApp Saya"** (`/api/channel-links/scoped?me=1`): `personalChannelScope` menerima `leadershipExtra`; route menambahkan
  - `MENTORS` bila peran aktif/role = MENTOR/CO_MENTOR;
  - `KOORD_PANCA` bila **BOD Tim Kerja** (`isTimKerjaBod`) **atau** **kepala divisi** (`isDivisionHead` = LEAD/CO_LEAD).
- Verifikasi: `lint` bersih · **449 test** hijau · `build` OK · lokal `/api/channel-links` mengembalikan katalog kepemimpinan lengkap.

### Next
1. Isi tautan grup via Kanal WhatsApp → Kepemimpinan: Mentor & Co-Mentor + Koordinator Panca Tugas.
2. Sisa: Fase C email (butuh API key), P1-6 react-query, P2-4 warta, P2-6 lanjutan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Family Tree: MOVED + avatar mentor (22 Sep 2026)

**Goal:** (1) Veylicia Kaempe (MENTEE) muncul di Family Tree **Kairos** padahal sudah pindah ke **Shalom**. (2) Foto mentor di Family Tree (mis. Jeremia/Dunamis) tidak muncul, padahal ada di DB.

**Done:**
- **(1) Verifikasi data (prod, read-only):** baris Kairos berstatus **`MOVED`** (`movedToGroupId=grp-3` = Shalom, period 2026-09), Shalom `ACTIVE`. **DB benar**; roster (ACTIVE-only) juga benar.
  - **Akar:** `src/context/AppContext.tsx` membangun `groupBatches[].mentees` dari **semua** status → anggota pindah tetap muncul di pohon kelompok lama.
  - **Fix:** lewati status **`MOVED`** (ALUMNI/PAST tetap untuk riwayat generasi).
- **(2) Verifikasi data (prod, read-only):** Dunamis **tidak punya baris `GroupMember` ber-role MENTOR**, padahal `GroupBatch.mentorUserId` menunjuk user yang punya avatar. `pickAvatar` (hanya dari anggota) gagal → inisial.
  - **Fix:** `server/index.mjs` — `attachBatchAvatars()` melengkapi `mentorAvatar`/`comentorAvatar` per batch dari `User` (via `mentorUserId`/`comentorUserId`) untuk `/api/db/groups` & `/full`; `AppContext` memakai avatar server bila ada (fallback `pickAvatar`).
- Verifikasi: `lint` bersih · **448 test** hijau · `build` OK · lokal: `/api/db/groups` mengembalikan `mentorAvatar` terisi.

### Next
1. Konfirmasi: Family Tree Kairos (Veylicia hilang) & Dunamis (foto mentor muncul).
2. Sisa: Fase C email (butuh API key), P1-6 react-query, P2-4 warta, P2-6 lanjutan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Kelola akun: lepas Google + ganti email (22 Sep 2026)

**Goal:** User bisa melepas tautan Google; admin/Komisi bisa mengganti email login dengan aman.

**Done:**
- **Fase A — lepas tautan Google (self-service).** `POST /api/me/unlink-google` (`requireRole()`): prasyarat **user punya password** (cegah terkunci) → `googleSub=null`, `linkStatus='UNLINKED'`. UI di `LinkGoogleCard` (tombol "Lepas tautan Google" + konfirmasi). Login Google lagi akan menaut ulang by email (desain).
- **Fase B1 — ganti email lewat admin.** `PATCH /api/admin/users/:id` (`requireKomisiOrPlatformAdmin`) kini menerima `email` dengan guard: format valid; unik (**409**); **blokir** email `SUPERADMIN_EMAILS`/operator platform (**403**); **tolak** bila akun Google-linked (**400**, harus lepas dulu); bila email membawa hak (Grup Akses/Struktur) wajib `confirmRights: true` (**409 + needsConfirmRights**). UI: field **Email (login)** di modal edit `YouthGEHCList` + konfirmasi.
- Verifikasi: `lint` bersih · **448 test** hijau · `build` OK · runtime lokal: anon `/api/me/unlink-google` **401**, auth **200**; `PATCH` invalid **400**, Google-linked **400**, duplikat **409**.
- Ditunda: **Fase C** (layanan email untuk verifikasi email baru & reset password via email) — butuh API key.

### Next
1. Uji: user lepas tautan Google (Akun → Keamanan) lalu login ulang; Komisi ganti email jemaat.
2. Fase C (opsional) bila ikut dijalankan: tambah Resend/SMTP.
3. Sisa audit: P1-6 react-query, P2-4 warta, P2-6 lanjutan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — iOS: SW push-only + layout 100dvh + Logout akun (22 Sep 2026)

**Goal:** iPhone (iOS 18.5) tetap tidak menampilkan Info Event & materi Didaskalia (Android normal), dan tombol "keluar portal" sulit diakses. Akar: service worker iOS + layout tinggi.

**Done:**
- **Penyebab berulang iOS = service worker.** `sw.js` masih meng-*intercept* SEMUA fetch (cache HTML/aset + balas `/api/*` dengan JSON 503 palsu saat gagal). Di iOS Safari (agresif mematikan SW) → bundle basi / API seolah kosong → Info Event & materi Didaskalia "hilang".
  - `public/sw.js` kini **PUSH-ONLY**: handler `fetch` **dihapus**; `activate` **menghapus SEMUA cache**. Browser selalu ambil HTML/aset/API dari jaringan. Push + klik notifikasi + background sync tetap.
- **Layout iOS**: `aside` `h-screen` → `h-[100dvh]`; shell `min-h-screen` → `min-h-[100dvh]`; safe-area bawah `pb-[calc(1rem+env(safe-area-inset-bottom))]`; buang `overflow-y-auto` di `<main>`. Tombol bawah kini terjangkau.
- **Logout akun** (baru, terpisah dari "Keluar portal"): tombol `logoutSso` (hapus sesi) → konfirmasi → **landing publik** (`#/beyonders`). i18n `logoutAccount*` (ID/EN).
- Verifikasi: `lint` bersih · **448 test** hijau · `build` OK · `dist/sw.js` tanpa handler `fetch`, ada handler `push`; render lokal menampilkan "Keluar portal" + "Logout akun" (desktop & mobile), 0 page error.
- Ditahan (permintaan user): lepas/ganti tautan email.

### Next
1. Uji iPhone (iOS 18.5): buka `youth.gehc.page` → Info Event + materi Didaskalia harus muncul; cek tombol "Logout akun".
2. Bila masih: cek data jadwal Marhaen (MENTOR Hesed) — `my-schedule` (read-only).
3. Sisa audit: P1-6 react-query, P2-4 warta, P2-6 lanjutan, lepas/ganti email.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Audit portal P0: RBAC endpoint + cleanup (21 Sep 2026)

**Goal:** Mulai eksekusi [`docs/review/2026-09-20-portal-audit.md`](docs/review/2026-09-20-portal-audit.md) — batch pertama: keamanan P0 + efisiensi kecil + cleanup, lalu uji di staging.

**Done:**
- **Dokumen audit masuk git**: `docs/review/2026-09-20-portal-audit.md` + registrasi di `docs/README.md`.
- **P0-1 — kunci endpoint tulis publik** (`server/index.mjs`): `POST /api/db/sync-batches` (:1501), `POST /api/migrate/events` (:2095), `POST /api/seed/events` (:2250) → `requireRole('SUPERADMIN')`. Ketiganya **0 referensi** di repo (aman).
- **P0-2/P0-3 — guard endpoint baca internal** (`server/index.mjs`): `GET /api/db/groups/:id/batches` (:1430), `/:id/attendance` (:1481), `GET /api/groups/:id/mentor-transitions` (:1534), `GET /api/events/:id/meetings` (:2996) → `requireRole()`.
- **P1-1 — polling notifikasi** `PortalLayout.tsx:153` 30 dtk → 180 dtk (3 menit).
- **Cleanup dead code**: hapus cabang badge "terkunci" + `isAllowed` di `PortalLayout.tsx` dan field `badge?` di `portal-nav-config.ts`. **Catatan:** usulan P0-6 audit (`isAllowed = isTabAllowed(...)`) **tidak berlaku** — `navWithHeaders` sudah difilter per peran, jadi nilainya selalu `true`; badge juga tak pernah diisi. Lock UI sejati butuh model izin tersendiri (belum dikerjakan).
- **P0-7 — peran eksplisit untuk endpoint tulis** (`server/index.mjs`): `POST/PATCH/DELETE /api/warta*`, `POST/PATCH/DELETE /api/gallery*`, `POST/PATCH /api/division-meetings*` + agenda → `requireRole('SUPERADMIN','KOMISI','COMMITTEE')`. Ketiganya hanya dipakai dari `DivisionWorkspacePanel` (nav `divisions` = KOMISI/COMMITTEE).
  - **Ditambah temuan verifikasi**: `PATCH /api/penatalayan/schedules/:id` sudah aman (isSelf/privileged internal); seluruh `/api/pastoral-care/*` dan `/api/service-swap-requests/*` juga **sudah** ber-otorisasi internal (`canSeeNote`, `isMentorOfGroup`, `isServiceApprover`) → `requireRole()` kosong memang tepat, **tidak** diubah.
- **P0-4 — minimisasi PII `/api/db/groups`** (`server/index.mjs` + klien): endpoint publik kini `select` anggota **tanpa** `email`/`telepon`/`catatan` (tetap: nama, familyRole, status, batchPeriod, avatar, alumniDate/Note, attendanceRate, userId). Ditambah **`GET /api/db/groups/full`** (`requireRole()`) yang mengembalikan bentuk lengkap. `AppContext` mencoba `/full` lalu jatuh ke versi publik; 3 konsumen portal (`AnnouncementComposer`, `RegenerationWizard`, `YouthGEHCList`) dipindah ke `/full`. `GET /api/db/groups/:id/members` (publik, dipakai `HeritageSection`) juga dirampingkan.
- **Verifikasi:** `lint` bersih · **442 test** hijau · `build` OK · e2e nav 3 test peran lulus (1 test `unauthorized tab click` **gagal juga di `main`** → pre-existing, bukan regresi).
- **Verifikasi runtime lokal & staging** (`https://staging-gehcpage.vercel.app`): anon → 3 tulis **401** + 4 baca internal **401** + 10 tulis warta/galeri/rapat **401** + `/api/db/groups/full` **401**; publik (`/api/db/struktur`, `/api/church-profile`, `/api/auth/config`, `/api/db/groups`, `/`) **200**; login `tech@gehc.demo` (SUPERADMIN) → baca internal **200**, `POST /api/db/sync-batches` **200** (`{"synced":0}`), tulis warta/galeri/rapat lolos gate (400 validasi/404, bukan 403), `/api/db/groups/full` **200**.
  - **P0-4 lokal (Chromium render `#/beyonders`)**: 10 grup tampil (Agape…Shalom), kunci anggota publik tanpa `email`/`phone`; `/full` auth mengandung `email`/`phone`/`notes`.
  - Catatan: `npm run deploy:staging` sempat gagal `fetch failed` (upload jaringan) — rilis dilakukan via `main` (Vercel build dari git).
- **P0-5 — guard sisa P0** (`server/index.mjs`): `GET /api/events/:id/penatalayan` → `requireRole()` (membocorkan email petugas; konsumen hanya portal); `GET /api/drive/files/:fileId` → policy Drive via `guardDriveFolder` (mirror endpoint konten).
- **P1-2 — lazy-load AppContext**: `/api/db/struktur` & `/api/content/public` tidak lagi dimuat di setiap load; jadi `ensureStruktur()`/`ensureContent()` dipanggil panel terkait (`ManageStruktur`, `EventsTimeline`, `WeeklyInfoSection`, `ManageWeeklyInfo`, `ManageActivities`, `PortalDashboard`). `/api/db/groups` tetap dimuat (dipakai lintas halaman).
- **P2-7 — Dashboard KOMISI & BPMJ**: `dashboard` ditambah ke `roles` (`src/lib/portal-nav-config.ts`).
- **P2-5 tidak berlaku**: `YouthCalendarPanel` **bukan** wrapper tipis (punya UI layer + fetch `/api/portal/calendar` sendiri) → tidak dihapus.
- **P1-4 — N+1**: `POST /api/db/sync-batches` & `POST /api/db/sync-struktur` → upsert dibatch dalam satu `$transaction` (bukan loop `await`).
- **P1-3 — paginasi**: `GET /api/db/users` kini menghormati `?limit` & `?offset` (default tetap semua).
- Verifikasi batch ini: lint bersih · 442 test hijau · build OK · anon `/api/events/:id/penatalayan` **401**, `/api/drive/files/xxx` ditolak guard; render `#/events`, `#/bulletin`, `#/leaders` tanpa error; `/api/db/users` limit/offset bekerja (110 → 5 → 5 offset beda).
- **P1-5 — read-POST → GET**: alias `GET /api/jethro/scan` (handler sama; `POST` tetap ada).
- **P1-7 — BAKU TAU**: sudah satu handler dua alias (`/api/events/baku-tau-4-0` & `/api/events/bakutau`) — tidak perlu diubah.
- **P2-1 — nav bertahap (SELESAI semua peran)**: `buildPortalSidebarItems()` (parent + sub-tab; id anak tetap routable) + `findParentForTab()`; `PortalLayout` merender parent (expanded + flyout collapsed) + bar sub-tab. `PORTAL_NAV_GROUPED_ROLES = ['COMMITTEE','KOMISI','BPMJ','SUPERADMIN']`. KOMISI 21→~10; SUPERADMIN 26→~11 (semua parent). Unit test + e2e `portal-nav-roles` hijau. Rencana: `docs/review/2026-09-21-portal-nav-draft.md`.
- **P2-6 — pecah file**: `GroupPrayerNotes` diekstrak dari `ManageGroupsMonitoring.tsx`; tipe + konstanta + fungsi murni (`displayRoles`, `placementStatusLabel`, `beyonderAssignment`, filter helpers) diekstrak dari `YouthGEHCList.tsx` → `src/components/portal/youth-gehc-helpers.ts` (perilaku sama). Sisa: `DivisionWorkspacePanel` & pemecahan penuh per sub-tab — episode tersendiri.
- **P2-2 — satukan prompt kelengkapan profil**: `ProfileChecklistBanner.tsx` (baru) jadi satu pintu — onboarding/waiting-pool pakai `OnboardingBanner`; pengguna aktif yang belum lengkap melihat **checklist** (tanggal lahir, data diri & kontak, tes karunia) alih-alih pesan generik. `ProfileIncompleteBanner.tsx` dihapus (sudah tidak dipakai).
- **P2-3 — satukan welcome**: `PortalWelcomeModal.tsx` (baru) = 1 modal kontekstual — INVITED (kredensial login) atau role Beyonders berkelompok (ajakan grup WA). `InvitedWelcomeModal.tsx` + `MenteeWelcomeCard.tsx` dihapus; dirender sekali di shell `PortalLayout`.
- Belum dikerjakan: P1-6 react-query, P2-4 warta, P2-6 (lanjutan).

### Next
1. Uji portal dengan akun nyata (Monitoring, Warta/Galeri/Rapat divisi, Dashboard KOMISI/BPMJ).
2. Lanjut P1 efisiensi (paginasi, N+1) lalu P2 UX.

### Commands
```
npm run lint && npm run test && npm run build
npm run deploy:staging
```

---

## Prior — iOS Safari "section hilang": HTML network-only + auto-recovery aset basi (21 Sep 2026)

**Goal:** Portal tampil penuh di Safari iPhone (`youth.gehc.page`) seperti di Android. Teman melaporkan sebagian section (header/nav, konten utama, kartu bantuan, materi Didaskalia) hilang, sementara banner tetap tampil.

**Done:**
- **Akar masalah (service worker):** `sw.js` masih bisa menyajikan `index.html` basi dari cache (network-first + fallback cache, timeout 3s). HTML lama menunjuk aset ber-hash yang sudah dihapus deploy baru → aset 404 → React gagal mount → section "hilang" (paling terasa di iOS/Safari yang agresif cache + jaringan seluler lambat).
  - `public/sw.js`: navigasi/HTML jadi **NETWORK-ONLY** (tanpa fallback HTML basi). Offline → `/offline.html` statis via precache. Aset ber-hash tetap stale-while-revalidate; `/api/*` network-only.
  - `public/offline.html` (baru): halaman offline ringan tanpa aset bundle.
  - `public/pwa-register.js` + `NotificationPermissionBanner.tsx`: registrasi SW pakai **`updateViaCache: 'none'`** → iOS selalu ambil `/sw.js` dari jaringan saat cek update.
  - `vercel.json`: `Cache-Control: no-store` untuk `/` (dokumen sebenarnya — sebelumnya hanya `/index.html` yang cocok) dan `/pwa-register.js`.
- **Jaring pengaman klien** (`src/main.tsx`): listener `vite:preloadError` + `error`/`unhandledrejection` untuk pesan aset basi ("dynamically imported module", "Loading chunk", "MIME type") → `recoverBrokenClientCache()` (unregister SW + hapus cache) lalu reload sekali; dibatasi 1×/60 detik (sessionStorage) agar tidak loop.
- **Verifikasi**: `npm run lint` bersih; **442 test** hijau; `npm run build` OK; `dist/sw.js` ter-stempel build-id & memuat `/offline.html`; `dist/pwa-register.js` ter-stempel + `updateViaCache`; `dist/offline.html` ada; `node --check` sw.js/pwa-register.js lolos; `vercel.json` valid.
- Catatan kompatibilitas: Tailwind v4 memakai `oklch`/`color-mix`/`@property`, tapi sudah menyertakan fallback (`@layer properties` untuk browser tanpa `@property`, `@supports` untuk `color-mix`) → bukan penyebab "section hilang" (diverifikasi dari CSS produksi).

### Next
1. Deploy staging → uji di iPhone teman (Safari tab): muat ulang sekali, tunggu SW baru (`updateViaCache`) → section harus lengkap.
2. Bila masih hilang: minta screenshot + error console (Mac Safari → Develop → Web Inspector) dari iPhone teman.
3. Bila ada device iOS < 16.4: pertimbangkan fallback warna eksplisit (hex) untuk palette Tailwind — belum perlu sampai terbukti.

### Commands
```
npm run lint && npm run test && npm run build
npm run deploy:staging
```

---

## Prior — Slide presentasi ProPresenter (4 PNG 1920×1080) (20 Sep 2026)

**Goal:** 4 gambar slide untuk ProPresenter: depan `gehc.page`, QR `gehc.page` + coming soon, depan `youth.gehc.page`, QR daftar + status jemaat + himbauan install.

**Done:**
- **`public/presenter/`** → `01-hub-depan.png`, `02-hub-qr.png`, `03-youth-depan.png`, `04-youth-qr.png` (semua **1920×1080**, ~1 MB total). Ikut ter-deploy → bisa diakses di `https://youth.gehc.page/presenter/<nama>.png`.
- **Generator**: `scripts/render-slides.mjs` (Playwright + sharp + jsqr) + template `scripts/slides/*.html` + `slide.css` + **`slides-data.json`** (naskah & angka — satu tempat untuk disunting) + `scripts/slides/README.md`.
- **QR** dari `public/media/qr-hub.png` (`https://gehc.page`) & `qr-daftar-youth.png` (`https://youth.gehc.page/#/register`) → diperbesar nearest-neighbor 640→1100px + quiet zone 88px, lalu **diverifikasi ulang dengan `jsqr`** (gagal = render gagal).
- **Screenshot live** `gehc.page` & `youth.gehc.page` (viewport 1440×900 @2x, animasi/scrollbar dimatikan) ditempatkan dalam mockup laptop gelap di latar krem brand.
- **Slide 4 angka nyata (snapshot 20 Sep 2026, prod)**: terdaftar 135 · Bapak 9 · Ibu 3 · Pemuda 123 · terhubung Kolom 22 · menunggu verifikasi 11.
- Verifikasi: lint bersih, build OK, `dist/presenter/` ikut ter-copy, 4 PNG terkonfirmasi 1920×1080, QR valid setelah diperbesar.
- Tanpa dependensi npm baru; tanpa perubahan aplikasi/DB.

### Next
1. (Opsional) Perbarui angka snapshot di `scripts/slides/slides-data.json` lalu `node scripts/render-slides.mjs`.
2. (Opsional) Commit + push bila slide ingin ikut ter-deploy.

### Commands
```
node scripts/render-slides.mjs              # render ulang (pakai screenshot lama)
node scripts/render-slides.mjs --refresh    # ambil ulang screenshot situs live
```

---

## Prior — Audit portal menyeluruh (dokumen review) (20 Sep 2026)

**Goal:** Review menyeluruh seluruh panel portal — mana yang benar-benar dibutuhkan, best practice read/write (GET/POST), dari POV semua peran.

**Done:**
- Dokumen **[`docs/review/2026-09-20-portal-audit.md`](docs/review/2026-09-20-portal-audit.md)** (15 bagian): ringkasan eksekutif, inventaris nav 26 destinasi × 8 peran, penilaian kebutuhan per panel, **usulan nav baru per peran** (KOMISI 21→10, COMMITTEE 16→8, BPMJ 11→8, dst.), pola akses read/write, P0 keamanan, P1 efisiensi, P2 UX, konsolidasi endpoint, roadmap + quick wins dengan snippet, dan 3 lampiran.
- Terdaftar di `docs/README.md` (seksi Review baru); melengkapi `docs/tech/nav-api-parity.md`.
- **Murni analisis** — tidak ada perubahan kode/DB. Semua temuan P0 diverifikasi manual baris kode; 4 kandidat dibuang karena ternyata sudah aman.
- Temuan P0 teratas: 3 endpoint tulis publik tanpa auth (`POST /api/db/sync-batches`, `/api/migrate/events`, `/api/seed/events`; `server/index.mjs:1501/2095/2250`, 0 referensi di `src/`) · endpoint baca publik mengekspos absensi/transisi mentor/notulen rapat · lock UI mati (`PortalLayout.tsx:475`).

### Next
1. Review checklist bagian 11 (P0 → P1 → P2); tandai yang disetujui.
2. Eksekusi P0 (butuh keputusan produk untuk endpoint yang "memang publik").

### Commands
```
# dokumen saja — tidak ada perintah build yang diperlukan
```

---

## Prior — Warta rapi, Galeri gabung Warta, PWA fresh + install dari landing (20 Sep 2026)

**Goal:** (1) Warta: petugas cukup nama+role; (2) Galeri jadi bagian Warta; (3) PWA terinstal tidak lagi terjebak versi lama; (4) tombol install di landing.

**Done:**
- **Warta petugas**: `DutyDayBlock` (`src/components/public/WartaServiceDutySection.tsx`) tidak lagi menampilkan jam; nama di-dedup (1 nama = 1 baris) dan role unik digabung ` · ` sesuai urutan jadwal → `Holly Kalele — Liturgist · Worship Leader`. Berlaku di kartu Warta & modal detail.
- **Galeri → bagian Warta**: item nav `gallery` dihapus (desktop + drawer), `EventArchiveGallery` dirender di bawah `WeeklyInfoSection` pada tab `bulletin` dengan header sub-seksi (`#galeri-arsip`), alias `gallery → bulletin` di `routes.ts`/`hash-routes.ts`/`AppContext` (`#/gallery` lama tetap jalan), shortcut manifest diarahkan ke `/#/bulletin`.
- **PWA fresh (akar masalah)**: `public/sw.js` lama cache-first untuk `/` → PWA terinstal selalu memuat HTML/chunk lama; `CACHE_NAME` tak pernah berubah → `updatefound` tak pernah muncul; prompt `confirm()` tak muncul di standalone.
  - `sw.js` ditulis ulang: navigasi/HTML **network-first** (timeout 3s, fallback offline), aset ber-hash **stale-while-revalidate**, `/api/*` network-only, `CACHE_NAME = gehc-<buildId>` (cache lama dibuang saat activate), pesan `SW_ACTIVATED`.
  - **Build-id stamping** (`vite.config.ts`): `dist/sw.js` + `dist/pwa-register.js` distempel id unik tiap deploy → byte `sw.js` selalu berubah → update selalu terdeteksi. Token `__BUILD_ID__`/`self.__GEHC_BUILD_ID__`.
  - `public/pwa-register.js`: event `pwa-update-available` (bukan `confirm()`), reload sekali saat `controllerchange`, `registration.update()` saat load/fokus/`visibilitychange` + tiap 60 menit, helper `applyUpdate`/`hardReload`/`checkForUpdate`/`canInstall`.
  - `PwaUpdateToast` (global di `App.tsx`): toast “Versi baru tersedia” + tombol Muat ulang; auto-reload hanya saat idle (tidak ada input aktif & 15s tanpa interaksi).
  - `PwaUpdateButton`: “Cek pembaruan” + “Muat ulang paksa” di Footer landing & `PWASettingsPanel` portal.
- **Install dari landing**: `PwaInstallButton` (pill di Navbar desktop + drawer mobile, `variant="footer"` di Footer) memakai `window.deferredPrompt`/`window.PWA`; iOS/Safari → modal instruksi “Tambah ke Layar Utama”; disembunyikan bila standalone. i18n `pwa.*` ditambah di `en.ts` + `id.ts`.
- Verifikasi: lint bersih, **439 test** hijau, build OK; `node --check` pada `dist/sw.js` & `dist/pwa-register.js` lolos; `vite preview` → `/sw.js` 200, `/pwa-register.js` 200 (baris build-id ada), `/manifest.json` 200, index memuat `pwa-register.js`.

### Next
1. Deploy staging → verifikasi → push `main`.
2. Uji update nyata di perangkat: install PWA → deploy ulang → toast “Versi baru tersedia” muncul tanpa hapus cookies (butuh user, Playwright tidak tersedia di sesi ini).

### Commands
```
npm run lint && npm run test && npm run build
node --check dist/sw.js; node --check dist/pwa-register.js
npm run deploy:staging
```

---

## Prior — Backfill jadwal serving + Warta: petugas & anggota tuan rumah (19 Sep 2026)

**Goal:** Baris nyata penanggung/tuan rumah bisa dibuat untuk event yang sudah ada; Warta menampilkan **petugas** di bawah Penanggung Jawab dan **semua nama anggota** di bawah Tuan Rumah.

**Done:**
- **Backfill (B+D)**: `server/lib/serving-backfill.mjs` (`planServingBackfill` idempoten: idx siklus dari anchor 2026-09-06, minggu GABUNGAN/LIBUR/ALIH tidak consume; `applyServingBackfill`), endpoint **`POST /api/serving-assignments/backfill`** (`{dryRun}`; gate KOMISI/SUPERADMIN), skrip **`server/_backfill-serving-assignments.mjs`** (dry-run default, `--apply` untuk menulis), dan tombol **“Lengkapi jadwal serving”** di tab Ibadah Mingguan dengan **pratinjau + konfirmasi**.
  - Staging: 10 minggu layanan, semuanya sudah punya baris → backfill = 0 (idempoten).
  - Prod: event mingguan dibuat manual (tanpa `metadata.generatedAt`) & `serving_assignments` = 0 → backfill akan membuat baris untuk 13/20/27 Sep (menghilangkan label “(perkiraan)”).
- **Warta**: kartu/blok pelayanan dirapikan — **Penanggung Jawab** → daftar **petugas penatalayan**; **Tuan Rumah** → **semua nama anggota grup tuan rumah** (dari `groupMember` ACTIVE, nama saja, diurut alfabetis) yang kini dikirim endpoint publik sebagai `serving[day].hostMembers`.
- Verifikasi: lint bersih, **439 test** hijau (+4 `serving-backfill.test.ts`), build OK; smoke API: anggota tuan rumah tampil (Shalom 9 nama, Metanoia 8 nama), backfill dry-run 0/10, endpoint backfill 401 tanpa login.

### Next
1. Deploy staging → verifikasi → **jalankan backfill prod** (`--apply`) → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
node server/_backfill-serving-assignments.mjs            # dry-run
node server/_backfill-serving-assignments.mjs --apply    # tulis
dotenv -e .env.production -- node server/_backfill-serving-assignments.mjs --apply
```

---

## Prior — Sinkronisasi lanjutan: penanggung/tuan rumah prediksi di Warta + sisa mismatch (19 Sep 2026)

**Goal:** Penanggung jawab & tuan rumah **selalu muncul** di Warta (walau jadwal serving belum di-generate), plus menuntaskan sisa mismatch antar panel.

**Done:**
- **Proyeksi serving di endpoint publik** (`/api/db/service-schedule`): bila belum ada baris nyata, penanggung/tuan rumah dihitung dari **siklus** (`loadCyclePairs` + `assignCycleIndexes`, W1 mentoring & minggu GABUNGAN/LIBUR/ALIH dilewati) dan ditandai **`projected: true`** → UI menampilkan **“(perkiraan)”**. Terverifikasi cocok dengan panel Ibadah Mingguan (Des 2026: Kairos/Ruach, Echad/Shalom, Agape/Metanoia).
- **#9 Absensi**: kartu “Kepatuhan Monitoring” di Dashboard diberi keterangan bahwa **check-in QR/absensi dihitung terpisah** dari laporan monitoring (menghindari kesan “0%” padahal ada check-in).
- **#11 HUT**: `/api/portal/birthdays/upcoming` kini memakai `congregationUserWhere()` — cakupan sama dengan `/api/jemaat/birthdays/upcoming` (akun teknis tidak ikut).
- **#10 Penamaan divisi**: diverifikasi **sudah konsisten** (id `BENZARPR` dengan label “Benzarpreneurship” di `DIVISION_CATALOG`, `PANTATUGAS`, dan `DIVISIONS`) — tidak perlu perubahan kode.
- Verifikasi: lint bersih, **435 test** hijau (+2 `assignCycleIndexes`), build OK; smoke API proyeksi serving + perbandingan dengan panel. **Tanpa migrasi baru.**

### Next
1. Deploy staging → verifikasi → push `main`.
2. Data prod: isi **WA grup default** di Info Gereja, generate jadwal serving, dan **publish Warta** agar edisi muncul.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Sinkronisasi panel: petugas di Warta, default event, normalisasi kind (19 Sep 2026)

**Goal:** Petugas ibadah terlihat di Warta (bukan Beyonders), isian event tidak berulang, dan mismatch antar panel dibereskan.

**Bagian 1 — Petugas di Warta**
- Section **“Petugas Ibadah”** dipindah dari tab **Beyonders** ke tab **Warta** (`WartaServiceDutySection.tsx`): kartu per Minggu (maks 3 ≤21 hari) → tanggal · **Penanggung Jawab** · **Tuan Rumah** · daftar petugas (CONFIRMED/DONE); kartu disembunyikan hanya bila ketiganya kosong. Komponen lama `PublicServiceDutySection.tsx` dihapus.
- **Detail Warta**: blok **“Pelayanan”** (`WartaPelayananBlock`) untuk tanggal warta itu.
- Endpoint publik `/api/db/service-schedule?from&to` kini juga mengembalikan **`serving`** (penanggung/tuan rumah per hari, nama grup saja).

**Bagian 3 — Mismatch yang dibereskan**
1. **Kind event mingguan**: `generate-services` dulu menulis `RECURRING` (UI memetakannya jadi “Rekreasional” & titik abu-abu). Kini menulis **`UMUM`**; `KegiatanCalendar` memakai `canonKind()` (RECURRING→UMUM); migrasi `_migrate-normalize-event-kind.cjs` menormalkan data lama (**staging: 9 baris**; prod menyusul).
2. **Penatalayan dua pintu**: bulk `POST /api/penatalayan/schedules/bulk` **auto-taut ke event** pada tanggal yang sama (`eventId`), dan `GET /api/events/:id/penatalayan` ikut menampilkan penugasan **tanpa eventId pada tanggal event** → tidak ada lagi penugasan “tak terlihat”/dobel. Terverifikasi: penugasan 27 Sep otomatis tertaut ke `evt-ibadah-pemuda-raya-tw4-27-sep-2026`.
3. **Komponen diarsipkan**: panel per-event kini menampilkan blok **“Komponen diarsipkan (n personel)”** sehingga tidak lagi “1 penugasan aktif tapi 0 orang”.
4. **Dua editor Warta**: `ManageWeeklyInfo` (Kelola Warta Pemuda) diberi banner yang mengarahkan warta mingguan resmi ke **Panel Divisi → Didaskalia → Warta**.
5. **WA event**: sudah sinkron — `PATCH /api/events/:id` men-upsert `ChannelLink(kind=EVENT)` (diverifikasi di kode, tidak perlu diubah).

**Bagian 2 — Default otomatis (kurangi isian berulang)**
- **Lib** `server/lib/event-defaults.mjs` (pure, 6 test): `pickDefaultSchedule` (prioritas jadwal Pemuda → Ibadah umum → apa saja), `normalizeTime`, `eventDefaultsFromProfile`, `resolveEventDefaults`.
- **Kolom baru** `church_profile.whatsapp_group_url` (migrasi `_migrate-church-wa-default.cjs`, staging sudah; prod menyusul) + field **“Grup WhatsApp default (event mingguan)”** di **Info Gereja**.
- `generate-services` kini mengisi **`venueName`** (nama gereja) + **`whatsappGroupUrl`** default ke event mingguan baru.
- **Form Event** (`EventWorkspacePanel`) prefill WA default (create & edit) dan tempat (edit) dari Profil Gereja bila masih kosong.
- Verifikasi: lint bersih, **433 test** hijau (+6 `event-defaults.test.ts`), build OK; smoke API: `serving` muncul di endpoint publik, auto-link `eventId` bekerja. Data uji dibersihkan. **2 migrasi aditif/idempotent** (staging selesai, prod menunggu izin).

**Sisa (belum dikerjakan, terdata)**: #9 tiga sumber absensi (AttendanceRecord/EventAttendee/MonitoringRecord), #10 penamaan divisi (BENZARPR vs Benzarpreneurship), #11 dua endpoint HUT.

### Next
1. Migrasi prod: `_migrate-church-wa-default.cjs` + `_migrate-normalize-event-kind.cjs` → push `main`.
2. Isi **WA grup default** di Info Gereja (prod) + generate jadwal serving agar penanggung/tuan rumah muncul di Warta.

### Commands
```
npm run lint && npm run test && npm run build
node server/_migrate-church-wa-default.cjs
node server/_migrate-normalize-event-kind.cjs
```

---

## Prior — Tugas penatalayan terlihat (dashboard, kalender, publik, warta) (19 Sep 2026)

**Goal:** Setelah penugasan penatalayan diisi, petugas & jemaat bisa melihatnya di tempat yang tepat.

**Done:**
- **A. Kartu “Tugas penatalayan saya”** (`MyServiceDutyCard.tsx`) di Dashboard (semua peran; tersembunyi bila tidak ada tugas): daftar tugas mendatang + badge status + tombol **Konfirmasi** / **Tandai selesai**. Endpoint baru **`GET /api/penatalayan/my-schedule`**. `PATCH /api/penatalayan/schedules/:id` kini **mengizinkan petugas bersangkutan** mengubah statusnya sendiri (hanya CONFIRMED/DONE; perubahan lain tetap Komisi/Tim Kerja). i18n `portal.myDuty.*` (ID/EN).
- **B. Lapisan “Petugas” di kalender Kegiatan** (`KegiatanCalendar.tsx`, chip teal): ikon + titik petugas per tanggal, kartu agenda (“Role — Nama · jam · status”), dan panel **“Petugas bulan ini (n)”**.
- **C. Seksi publik “Petugas Ibadah”** di landing (`PublicServiceDutySection.tsx`) — **hanya menampilkan petugas berstatus CONFIRMED/DONE** (privasi: petugas yang sudah menyetujui); endpoint publik baru **`GET /api/db/service-schedule?from=&to=`** (maks rentang 60 hari, tanpa email/telepon).
- **D. Chip jumlah petugas di daftar Warta** (`WartaPublikTab`): “… · n petugas” di samping chip Penanggung ⇄ Tuan Rumah.
- **Lib** `server/lib/service-duty.mjs` (pure, 5 test): `isPublicDuty`/`filterPublicDuties` (CONFIRMED/DONE), `groupDutiesByDay`.
- Verifikasi: lint bersih, **427 test** hijau (+5 `service-duty.test.ts`), build OK; smoke API — `my-schedule` menampilkan tugas, PATCH-diri CONFIRMED berhasil, publik 0 sebelum konfirmasi → 1 sesudahnya (+`byDay`), rentang >60 hari → **400**. Data uji dibersihkan. **Tanpa migrasi DB.**
  - Catatan: smoke **browser** tidak dijalankan (tool Playwright tidak tersedia di sesi ini) — verifikasi UI lewat build + review kode.

### Next
1. Deploy staging → verifikasi → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Penatalayan: penugasan massal (komponen × orang × tanggal) (19 Sep 2026)

**Goal:** Menugaskan penatalayan sekaligus banyak: beberapa komponen × beberapa orang × beberapa tanggal, tanpa memilih satu-satu.

**Done:**
- **Lib** `server/lib/penatalayan-bulk.mjs` (pure, 9 test): `buildAssignments` (cross-product + dedupe + cap `MAX_BULK_ROWS=500`), `rowKey` (normalisasi `Date` Prisma `@db.Date`), `summarizeByUser` (satu pesan per orang), `formatDayID`.
- **Endpoint** `POST /api/penatalayan/schedules/bulk` diperluas: terima **`serviceRoleIds[]`** (+ `serviceRoleId` lama), `userIds[]`, `dates[]`, `eventId`, `timeStart/timeEnd`; **idempoten** (`created`/`skipped`), tolak >500 baris (400), gate diperketat ke **SUPERADMIN/KOMISI/COMMITTEE**, notifikasi **ringkas per orang** (“Anda dijadwalkan: Liturgist (27 Sep), Doa Syafaat (27 Sep), +n lain”).
- **Komponen baru** `src/components/ui/SearchableMultiSelect.tsx`: cari di input, **chip terpilih** (bisa dihapus), tombol **“Tambah semua hasil (n)”**, `exclude` (orang yang sudah ditugaskan), `max`. `SearchableSelect` lama tidak diubah.
- **Modal “Tugaskan Penatalayan”** (`PenatalayanCalendar`) jadi komposer batch: **komponen multi** (chip alfabetis + “Pilih semua”), **personel multi** (cari + tambah semua), **tanggal multi** (chips + tombol **“+ Semua Minggu bulan ini”** & **“+ 4 Minggu ke depan”**), ringkasan “n komponen × n orang × n tanggal = n penugasan”, **konfirmasi bila >20**, dan **modal tetap terbuka** setelah simpan (orang & tanggal direset).
- **Panel per-event** (`EventPenatalayanPanel`): “+ Tambah orang” per komponen jadi multi-select (exclude yang sudah ditugaskan) → kirim `userIds[]` ke bulk.
- Verifikasi: lint bersih, **422 test** hijau (+9 `penatalayan-bulk.test.ts`), build OK; smoke API (12 baris dibuat; **ulang → 0 dibuat / 12 dilewati**; >500 → **400**) & smoke browser (16 komponen × 2 orang = **32 penugasan** tersimpan via konfirmasi, modal tetap terbuka, 2 notifikasi ringkas). Data uji dibersihkan. **Tanpa migrasi DB.**

### Next
1. Deploy staging → verifikasi → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Penatalayan/Liturgi: cari personel langsung + urut alfabetis (19 Sep 2026)

**Goal:** Menugaskan personel penatalayan tidak lagi memilih satu-satu dari daftar panjang.

**Done:**
- **Endpoint baru** `GET /api/penatalayan/people?q=&limit=` (`SUPERADMIN/KOMISI/COMMITTEE/MENTOR/CO_MENTOR`): cari user ACTIVE berdasarkan nama (name/given/middle/family), **urut alfabetis**, min. 2 huruf, maks 30 — pola sama seperti pencarian Portal Doa.
- **`PenatalayanCalendar` (modal “Tugaskan Penatalayan”)**: dropdown Personel 100 orang diganti **SearchableSelect** (ketik langsung di input); daftar **Role/Jabatan** kini **urut alfabetis**; fetch `/api/db/users?limit=100` dihapus (lebih ringan).
- **`EventPenatalayanPanel`**: pemilih “+ Tambah orang” per komponen diganti **SearchableSelect** (cari nama); komponen per divisi diurut **alfabetis**; peringatan bila personel yang dipilih sudah ditugaskan di komponen itu; fetch `/api/db/users?limit=200` dihapus.
- Verifikasi: lint bersih, **413 test** hijau, build OK; smoke API (`q=an` → 12 hasil urut alfabetis; 1 huruf → 0; tanpa login → 401) dan smoke browser (role alfabetis: Doa Persembahan → Worship Leader; ketik “an” → hasil muncul; pilih + Simpan → schedule 30 Sep Liturgist tersimpan, lalu data uji dihapus). **Tanpa migrasi DB.**

### Next
1. Deploy staging → verifikasi → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Warta: penanggung/tuan rumah otomatis + sync ulang saat disunting (19 Sep 2026)

**Goal:** Menutup dua celah Warta: (a) bagian Penanggung Jawab/Tuan Rumah kosong bila tombol “Isi dari jadwal” tak ditekan, (b) suntingan setelah PUBLISHED tidak ikut ke landing.

**Done:**
- **A. Prefill otomatis** (`WartaPublikTab.tsx`): saat modal Edit dibuka, field **Pelayanan** & **Jadwal Minggu Depan** diisi dari `/api/warta/desk?date=<weekDate>&suggestions=0` **hanya bila masih kosong** (tidak menimpa tulisan manual); tombol manual tetap ada.
- **B. Sync ulang** (`server/index.mjs` `PATCH /api/warta/:id`): bila `contentJson` berubah dan status sudah `PUBLISHED`, `syncWartaToContentItem()` dijalankan ulang → teks landing (Warta publik) ikut diperbarui. (Sebelumnya hanya saat transisi ke PUBLISHED.)
- **D. Chip jadwal di daftar Warta**: kartu tiap minggu kini menampilkan `Penanggung: X ⇄ Tuan Rumah: Y` (dari `/api/serving-assignments`, ditandai “(prediksi)” untuk baris virtual).
- Verifikasi: lint bersih, **413 test** hijau, build OK; smoke lokal — prefill tanpa klik (Pelayanan: Echad/Shalom + petugas; Jadwal: Agape/Metanoia 27 Sep), chip tampil di kartu, dan sunting `contentJson` saat PUBLISHED langsung memperbarui body landing. Data uji dibersihkan. **Tanpa migrasi DB.**

### Next
1. Deploy staging → verifikasi → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — WA sesuai peran aktif + album kelompok tampil di publik (18 Sep 2026)

**Goal:** (a) Kartu “Grup WhatsApp saya” mengikuti **chip/peran aktif**, bukan gabungan semua role. (b) Foto kegiatan kelompok bisa tampil di landing/detail grup — **hanya bila ditandai eksplisit** oleh mentor/Komisi.

**Done:**
- **WA per-peran**: `channelRank()` menerima `activeRole` (`server/lib/channel-link-access.mjs`); rute `?me=1` memakai `req.activeRole`. Akun multi-role (mis. SUPERADMIN+MENTOR) kini hanya melihat kluster saat chip = MENTOR; chip SUPERADMIN tetap semua. Panel Kanal WhatsApp (pengurus) tidak berubah. +1 unit test multi-role.
- **Album publik** (aditif, default **privat**): kolom `GroupAlbum.showOnLanding` + `publishedAt` (migrasi `server/_migrate-group-album-public.cjs` — **sudah di staging**, prod belum). Helper `server/lib/public-albums.mjs` (`isAlbumPublic` = SELESAI + ditandai; `serializePublicAlbum` tanpa field Drive internal).
- **API**: `PATCH /api/groups/:id/albums/:albumId/visibility` (mentor rumah itu/Komisi; hanya album SELESAI; menyalakan `publishedAt`); publik **`GET /api/db/groups/:id/albums`** & **`GET /api/db/group-albums?limit=`** (tanpa login, hanya album publik).
- **UI**: tombol **Tampilkan di landing / Sembunyikan** + badge **Publik** di `GroupAlbumsPanel` (konfirmasi izin foto); galeri `GroupDetailPage` menggabungkan album publik (tanpa login) + album privat (bila berhak); seksi baru **`GroupActivitySection`** di landing (`#/beyonders`).
- Verifikasi: lint bersih, **413 test** hijau (+6: multi-role + `public-albums.test.ts`), build OK; smoke lokal — feed publik 200 tanpa login, `RENCANA` ditolak 400, toggle off menghilangkan dari feed (0), kartu tampil di landing & detail grup. Data uji dibersihkan. **Tanpa migrasi DB baru selain kolom album.**

### Next
1. Migrasi prod (`_migrate-group-album-public.cjs`) → push `main`.
2. Uji prod: buka album Echad “Bonding” → **Tampilkan di landing** → cek landing & detail grup.

### Commands
```
npm run lint && npm run test && npm run build
node server/_migrate-group-album-public.cjs   # staging
```

---

## Prior — Pitch “Panduan Mentor & Co-Mentor” di youth.gehc.page (18 Sep 2026)

**Goal:** Materi pembekalan mentor/co-mentor: cara kerja regenerasi + cara orang baru ditempatkan (Jethro Engine) + fitur portal yang perlu diperhatikan, disajikan sebagai pitch deck seperti gehc.page.

**Done:**
- **Deck baru** `src/data/mentorPitchSlides.ts` (21 slide, ID, tanpa data pribadi): dasar (2 Tim 2:2 & Keluaran 18), alur orang baru (flow 8 langkah), Tes Karunia, **4 parameter Jethro 30/25/30/15**, cara membaca rekomendasi, kapasitas & pemicu (ambang 10 · idle 4 minggu · mitosis ≥80%×8 minggu · merger ≤6), alur Review Penempatan, panel + video regenerasi, 5 langkah regenerasi, dampak roster, 3 slide checklist fitur mentor (Monitoring; Pelayanan & Doa; Komunikasi & Kegiatan), ritme mingguan, Do & Don’t, jalur bantuan, QR, closing.
- **Renderer** `PitchDeck.tsx` di-refactor agar menerima prop (`slides/storageKey/label/docTitle/exitHash`) + **kind baru**: `flow`, `weights`, `checklist`, `image` (tipe di `pitchSlides.ts`). Deck hub GEHC.page tidak berubah.
- **Rute host-aware** (`host-context.ts` + `main.tsx`): `youth.gehc.page/#/pitch` → **deck mentor**; `gehc.page/#/pitch` tetap deck hub; alias eksplisit `#/pitch-mentor` & `#/panduan` (bisa dari host mana pun, keluar → `#/portal`).
- **Aset** disalin ke `public/pitch/regenerasi/` (8 PNG + `regeneration.webm`) untuk slide gambar/demo; QR memakai `/media/qr-daftar-youth.png` & `/media/qr-hub.png`.
- Tautan kecil di Dashboard untuk Mentor/Co-Mentor (“Panduan Mentor & Co-Mentor …”).
- Verifikasi: lint bersih, **407 test** hijau (+5 `mentor-pitch.test.ts`: id unik, kind dikenal, kelengkapan isi per kind, bobot total 100%, semua aset ada di `public/`), build OK; smoke browser (deck termuat, label & judul tab benar, bobot 30/25/30/15, gambar, video, checklist, QR; `#/pitch` lokal → deck mentor). **Tanpa migrasi DB.**

### Next
1. Deploy staging → verifikasi → push `main`.
2. Opsional: tombol unduh PDF handout (jspdf/html2canvas sudah tersedia) & meme per-slide.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Kartu WA mengikuti role/kluster (bukan semua grup) (18 Sep 2026)

**Goal:** Kartu “Grup WhatsApp Saya” di Dashboard & Ringkasan hanya menampilkan kanal milik pengguna + kanal kepemimpinannya — bukan seluruh grup Beyonders & divisi.

**Done:**
- **Akar masalah**: `SEE_ALL_RANKS` mencakup `ADMIN, BPMJ, KOMISI, BOD` → akun mentee yang merangkap Komisi (mis. Glenity) melihat semua 10 grup + 6 divisi.
- **Perbaikan** (`server/lib/channel-link-access.mjs`): `SEE_ALL_RANKS` = **`{ADMIN}`** saja; helper baru `leadershipRefsFor(rank)` (BPMJ→BPMJ · KOMISI→KOMISI · BOD→TIMKERJA · ADMIN→ketiganya); `personalChannelScope` kini selalu mengembalikan `refs` kluster (LEADERSHIP sesuai peran + GROUP/DIVISION/BIPRA/KOLOM/RECREATIONAL miliknya).
- `scopedDivisionCodes()` menambah sumber **`eventDivisionMember.division`** agar staf divisi event tetap mendapat kanal divisinya.
- **Verifikasi persona (staging)**: mentee grp-8/REMAJA → `BIPRA/REMAJA + GROUP/grp-8` (0 kebocoran); **Glenity (MENTEE grp-7 + KOMISI)** → `LEADERSHIP/KOMISI + BIPRA/PEMUDA + GROUP/grp-7`; mentor grp-2 → `BIPRA/PEMUDA + GROUP/grp-2`; **BPMJ** → `LEADERSHIP/BPMJ + BIPRA/PEMUDA` (bukan semua grup); Superadmin → semua. Lint bersih, **402 test** hijau (+3), build OK. Data uji staging dibersihkan. Tanpa migrasi DB.

### Next
1. Deploy staging → verifikasi → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Urutan siklus serving dapat diatur admin + tukar Echad ⇄ Kairos (18 Sep 2026)

**Goal:** Admin bisa mengubah urutan 10 pasangan penanggung/tuan rumah tanpa deploy, menukar dua kelompok secara massal (kedua peran) sejak 6 Sep 2026, dan menyelaraskan jadwal nyata.

**Done:**
- **Tabel baru** `serving_cycle_pairs` (model `ServingCyclePair`) + migrasi `server/_migrate-serving-cycle-pairs.cjs` (idempotent, seed dari `SERVING_PAIRS`, kolom FK memakai collation `groups.id`) + step di `scripts/db-migrate-local.mjs`. **Sudah dijalankan di staging**, prod belum.
- **Lib** `server/lib/serving-cycle.mjs`: `loadCyclePairs` (cache 30s, fallback ke konstanta bila tabel kosong), `resolvePairIdsDb`, `pairFromList`, `swapGroupsInPairs(pairs,a,b,groups)`, `validateCyclePairs` (10 baris, tanpa grup dobel per peran), `diffAssignments` (hormati `from`, lewati `isSwapped` & minggu override). Konsumen diarahkan ke resolver DB: `serving-assignments.mjs` (proyeksi virtual) & `ministry-plans.mjs` (generate-services).
- **API** `server/routes/serving-cycle.mjs`: `GET /api/serving-cycle`, `PUT /api/serving-cycle`, `POST /swap-groups` (dry-run/pratinjau + eksekusi; idempoten — 2× = kembali semula), `POST /apply` (dry-run + tulis ulang baris). Gate: **SUPERADMIN, KOMISI, COMMITTEE BOD Tim Kerja** (`isTimKerjaBod`). `writeFrom = 2026-09-06` (riwayat sebelum itu tidak diubah).
- **UI** `ServicePlanPanel.tsx` (Program & Event → tab **Ibadah Mingguan**): tombol **“Urutan Siklus”** → modal berisi 10 baris (dropdown penanggung & tuan rumah + naik/turun), panel **Tukar dua kelompok** (+ tanggal mulai, Pratinjau, Tukar via `ConfirmDialog`), pratinjau perubahan jadwal, tombol **Terapkan ke jadwal** (dry-run dulu).
- **Opsi A diterapkan di staging**: tukar **Echad ⇄ Kairos** → 13 Sep **Kairos/Ruach**, 20 Sep **Echad/Shalom**, 25 Okt Ruach/**Kairos**, 8 Nov Shalom/**Echad** (4 baris, `swapReason: "[urutan] tukar Echad ⇄ Kairos"`); urutan siklus & prediksi (mis. Des 2026) ikut berubah; “Terapkan” → 0 baris (idempoten).
- Verifikasi: lint bersih, **399 test** hijau (+12 `serving-cycle.test.ts`), build OK; smoke API + browser.

### Next
1. **Migrasi prod** (`_migrate-serving-cycle-pairs.cjs`) — butuh izin; prod saat ini 0 baris `serving_assignments` (efek langsung dari tabel siklus).
2. Terapkan Opsi A di prod (tukar Echad ⇄ Kairos dari 2026-09-06) lewat tombol **Urutan Siklus** di tab Ibadah Mingguan.

### Commands
```
npm run lint && npm run test && npm run build
node server/_migrate-serving-cycle-pairs.cjs   # staging
```

---

## Prior — Warta: petugas penatalayan, tuan rumah, pokok doa, jadwal (18 Sep 2026)

**Goal:** Warta Publik bisa diisi otomatis dari jadwal pelayanan: petugas penatalayan (grup + komponen + nama), penanggung/tuan rumah, pokok doa pekan & bulan, plus jadwal minggu depan.

**Done:**
- **Lib** `server/lib/warta-desk.mjs` (pure, 17 unit test): `groupOfficers` (per divisi LITURGIA→MARTURIA, urut `ServiceRole.sortOrder`, multi-orang `, `), `pickServingForDate` (tepat → else terdekat ≤21 hari bertanda `projected`), `pickWeekTheme`, `maskPrayerSuggestions` (nama depan + jenis, tanpa isi catatan), `buildWartaPelayanan/Doa/Jadwal`, `buildWartaDesk`, `toDayISO` (aman untuk Date Prisma `@db.Date`).
- **Endpoint** `GET /api/warta/desk?date=YYYY-MM-DD&suggestions=1` (`SUPERADMIN/KOMISI/COMMITTEE/BPMJ`) → `{ responsibleGroup, hostGroup, projected, officers[], themes{monthTheme,weekTheme,verse,servingVerse}, suggestions[], suggestionsPrivate, next{...}, texts{pelayanan,doa,jadwal} }`. Sumber: `servingAssignment` · `serviceSchedule`+`ServiceRole`+`User` · `ministryMonthPlan` · `pastoral_care_notes` OPEN (saran doa; hanya Komisi/Liturgia Doa).
- **UI** `WartaPublikTab.tsx` (Panel Divisi → **Didaskalia** → tab **Warta**): panel "Isi otomatis dari jadwal pelayanan" dengan tombol **Isi dari jadwal** dan **Isi + saran doa (privat)** (lewat `ConfirmDialog` + peringatan bahwa warta publik), pratinjau (penanggung/tuan rumah, tema, jumlah komponen terisi, jumlah saran privat), dan field baru **`jadwal`** ("Jadwal Minggu Depan"). Field `pelayanan/doa/jadwal` langsung ikut ke **export PNG/PDF** (`server/export.mjs` sudah merender ketiganya) dan ke body landing (`server/lib/content-map.mjs` `WARTA_FIELDS` += `jadwal`).
- **Pengingat Kamis** (`server/routes/notif-cron.mjs`): `runPenatalayanReminder()` — hanya Kamis WIB, menghitung komponen Minggu depan yang belum ada petugas, kirim kategori `penatalayan` ke Komisi/COMMITTEE/BPMJ/Admin; dipanggil dari `/api/cron/notif-daily` (tanpa cron baru).
- Verifikasi: lint bersih, **387 test** hijau (+17 `warta-desk.test.ts`), build OK; smoke API + browser (Warta 20 Sep: penanggung **Kairos**, tuan rumah **Shalom**, 3 komponen terisi, tema TW3/TB1, jadwal 27 Sep Agape/Metanoia; `suggestions=0` tanpa data privat, `suggestions=1` menampilkan "Putri (Sakit)"). Data uji staging dibersihkan (3 schedule, 1 warta, 1 catatan doa). **Tanpa migrasi DB.**

### Next
1. Deploy staging → verifikasi → push `main`.
2. Isi jadwal petugas di **Panel Divisi → Liturgia/Marturia → Penatalayan** agar auto-isi tidak menampilkan "belum ada petugas terjadwal".

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Kartu “Grup WhatsApp Saya” berjenjang (18 Sep 2026)

**Goal:** Kanal WhatsApp yang baru diisi pengurus muncul ke anggota yang tepat — anggota hanya klusternya, pengurus melihat ke bawah.

**Done:**
- **Peringkat** (`server/lib/channel-link-access.mjs`): `channelRank()` = **ADMIN > BPMJ > KOMISI > BOD Tim Kerja > MEMBER**; `personalChannelScope()` (pure, diuji) menerapkan anggota hanya `GROUP`(grupnya) + `DIVISION`(divisinya) + `BIPRA`(`user.bipra`) + `KOLOM`(`user.kolomId`) + `RECREATIONAL`(minat dipilih); ADMIN/BPMJ/KOMISI/BOD → **semua** kanal di bawahnya.
- **Penting**: BOD ditentukan `isTimKerjaBod()` baru (COMMITTEE **dengan** `RoleAssignment` divisi TIMKERJA/kosong). `isBodTimkerja()` lama terlalu longgar (baris `struktur_members` tak memuat email → semua COMMITTEE dianggap BOD/`isBroadChannelViewer`) dan **tetap dipakai** untuk perilaku lama.
- **Endpoint**: `GET /api/channel-links/scoped?me=1` → `{ channels:[{kind,refId,label,url}], scope }` (label fallback dari katalog). **Tanpa `?me=1` tidak berubah** → Monitoring Kelompok, Panel Divisi, MenteeWelcomeCard aman.
- **UI**: hook `useMyChannels()`; komponen baru `MyChannelsCard.tsx` (badge jenis + tombol Gabung) dirender di Dashboard untuk semua **kecuali Alumni**; tombol **Gabung WA** per minat terpilih di Profil → Minat (`ProfileRecreationalSection` + `MyProfilePanel`). i18n ID/EN `portal.myChannels.*`.
- **Verifikasi**: lint bersih, **370 test** hijau (5 baru di `channel-link-access.test.ts`), build OK; smoke API staging dengan persona nyata — SUPERADMIN/BPMJ/KOMISI → 7 kanal, MENTEE grp-8 + COMMITTEE → **hanya** BIPRA/REMAJA + GRUP Ruach, MENTOR grp-2 → hanya BIPRA/PEMUDA + GRUP Agape, +RA TIMKERJA → BOD (semua). Smoke browser: kartu Dashboard (3 kanal untuk mentee) & tombol WA di Profil → Minat. Semua data uji staging (3 link, 1 membership, 1 RA) sudah dihapus. Tanpa migrasi DB.

### Next
1. Deploy staging → verifikasi → push `main`.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Kanal WhatsApp: Kepemimpinan, BIPRA, Wilayah & Kolom, Rekreasi dropdown (18 Sep 2026)

**Goal:** Rapikan layer Kanal WhatsApp: kepemimpinan (Komisi/Tim Kerja BOD/BPMJ) terpisah, BIPRA ada, Kolom tidak lagi disebut “pemuda”, dan rekreasi tidak menampilkan semua grup sekaligus.

**Done:**
- **Jenis kanal baru**: `LEADERSHIP`, `BIPRA` (kolom `channel_links.kind` = VARCHAR → **tanpa migrasi DB**). `KINDS` di `server/routes/channel-links.mjs` + `catalog.leadership`/`catalog.bipra`.
- **Katalog** (`server/lib/channel-link-access.mjs`): `LEADERSHIP_CATALOG` = Komisi · Tim Kerja (BOD) · BPMJ; `BIPRA_CATALOG` = P/KB · W/KI · Pemuda · Pra Remaja · Anak. `DIVISION_CATALOG` (6 divisi pelayanan) **tetap** agar tautan divisi di DivisionWorkspacePanel tidak hilang.
- **Hak tulis**: `LEADERSHIP` & `BIPRA` masuk `KOMISI_ONLY_KINDS` (hanya Komisi/Superadmin — BPMJ & BOD tidak boleh). `EVENT`/`KOLOM` tetap Komisi-only; GROUP/DIVISION/RECREATIONAL tidak berubah.
- **UI** `WhatsAppChannelsPanel.tsx`: tab permanen kini **Beyonders · Divisi pelayanan · Kepemimpinan · BIPRA · Wilayah & Kolom · Rekreasi**; label `kindKolom` → “Wilayah & Kolom (permanen)”, `kindDivision` → “Divisi pelayanan (permanen)”; **Rekreasi pakai dropdown** (default = minat yang sudah punya tautan, opsi bertanda ✓) sehingga hanya satu kanal tampil.
- i18n ID/EN (`wa.kindLeadership`, `wa.kindBipra`, purpose/steps), `portal-feature-catalog.mjs` langkah panel, `portal-search-index.ts` kata kunci (bipra, kepemimpinan, komisi, tim kerja, bpmj, kolom, rekreasi).
- **Verifikasi**: lint bersih, **365 test** hijau (3 baru di `channel-link-access.test.ts`), build OK; smoke API + browser lokal (tab Kepemimpinan = 3 baris, BIPRA = 5 baris, dropdown Rekreasi 37 minat → hanya 1 tampil, PUT/DELETE `BIPRA/PEMUDA` sukses, URL invalid ditolak 400). Tidak ada perubahan skema, jadi tidak ada migrasi prod.

### Next
1. Deploy staging → verifikasi → push `main`.
2. Isi tautan WA Komisi, Tim Kerja (BOD), BPMJ, dan BIPRA di prod (hanya Komisi/Superadmin).

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Portal Doa: konteks bertanggal, Doa Minggu, riwayat doa, mode privasi (17 Sep 2026)

**Goal:** Catat konteks doa lengkap dengan **tanggal kejadian** (boleh mundur bila baru diketahui), tampilkan **kapan & terakhir didoakan**, sediakan **daftar Doa Minggu** untuk pendoa, dan mode **sembunyi detail + salin/cetak** (juga untuk HUT).

**Done:**
- **Schema** (`prisma/schema.prisma`): `PastoralCareNote` + `occurredOn` (Date, default hari ini), `contextEventId`, `prayedAt`, `prayedCount`; model baru **`PastoralPrayerLog`** (`pastoral_prayer_logs`: unik `note_id+prayed_on`). Migrasi idempotent `server/_migrate-pastoral-prayer.cjs` (+ step `db-migrate-local.mjs`) — **sudah dijalankan di staging**, prod belum.
- **API** (`server/routes/pastoral-care.mjs`): `kind` baru **UMUM** (subjek opsional); `GET /api/pastoral-care` + `status=ALL|OPEN|RESOLVED`, `expired=include|exclude|only`, `month=YYYY-MM`, field baru (`occurredOn`, `prayedAt/Count`, `isExpired`, `isGeneral`, `lateRecordedDays`, `contextEvent`); `POST /:id/pray` (idempoten per tanggal, gate = pelapor/subjek/liturgia-doa/diakonia/mentor grup/Komisi), `DELETE /:id/pray?on=`, `POST /pray-bulk`, `GET /:id/prayer-log`, `GET /prayer-list?sunday=` (default Minggu terdekat **WIB**), `GET /events?q=` (tautan kegiatan).
- **Lib** `server/lib/prayer-week.mjs` (`wibDayKey`, `upcomingSunday`, `mondayOf`, `weekRange`, `decoratePrayerWeek`, `lateRecordedDays`) + `src/lib/mask.ts` (`firstNameOnly`, `formatPrayerList`, `formatBirthdayList`, `copyText`, `printText`).
- **UI** `PastoralCareBoard.tsx` → 3 tab: **Laporan baru** (tanggal kejadian, tautkan kegiatan, jenis Umum, **ConfirmDialog** sebelum kirim), **Daftar konteks** (badge kedaluwarsa/“baru dicatat H+n”, terakhir didoakan n×, riwayat, tandai selesai), **Doa Minggu** (Ibadah Minggu + event, “Tandai semua”, tanggal doa untuk backdate, Salin/Cetak, sembunyi detail). `ManageGroupsMonitoring` menampilkan “Terakhir didoakan” + badge kedaluwarsa.
- **Kalender Kegiatan** (`KegiatanCalendar.tsx`): chip **Doa** (indigo, default aktif, isi tersaring izin server) + kartu “Konteks doa aktif: n → Buka Doa Minggu” pada event **Ibadah Minggu (UMUM)**; panel HUT dapat **Sembunyikan detail / Salin / Cetak**.
- **Pengingat Sabtu** (`notif-cron.mjs`): `runPrayerReminder()` — hanya Sabtu WIB, audiens Liturgia Doa + Diakonia + Komisi/SA + mentor, tanpa detail sensitif; dipanggil dari `/api/cron/notif-daily` (tanpa cron baru).
- Verifikasi: lint bersih, **362 test** hijau (18 baru: `mask.test.ts`, `pastoral-prayer.test.ts`), build OK; smoke API + browser lokal (konfirmasi kirim, backdate H+10, tandai/riwayat/prayer-log idempoten, Doa Minggu, chip Doa & kartu Ibadah Minggu, HUT sembunyi detail). Staging sudah deploy & diuji live.

### Next
1. **Migrasi prod** (`npm run db:migrate:local:prod`) → push `main` (Vercel prod) — **butuh izin eksplisit**.
2. Uji prod: tab Doa Minggu, tandai didoakan (backdate), chip Doa di kalender, HUT sembunyi detail/salin.

### Commands
```
npm run lint && npm run test && npm run build
npm run db:migrate:local:prod   # hanya dengan izin
```

---

## Prior — Tab “Ulang Tahun” di kalender Kegiatan (17 Sep 2026)

**Goal:** Kalender Kegiatan bisa menampilkan ulang tahun jemaat dengan warna/ikon khusus.

**Done:**
- **Helper** `server/lib/birthday-week.mjs`: `birthdaysInMonth(users, year, month)` — filter bulan, aturan 29 Feb → 28 Feb non-kabisat, `age` = umur genap pada tahun tsb, urut tanggal lalu nama, output `{ id, name, avatar, birthDate, date, day, age }`.
- **Endpoint** `GET /api/portal/birthdays?month=YYYY-MM` (`server/routes/drive-ownership.mjs`, `requireRole()`) — semua user ACTIVE ber‑`birthDate` (take 400), konsisten dengan `/api/portal/birthdays/upcoming`; `400` bila format bulan salah, `401` tanpa auth. Portal‑only (tanpa nomor/alamat).
- **UI** (`src/components/portal/KegiatanCalendar.tsx`): chip **“Ulang Tahun”** (ikon `Cake`, warna **pink** — beda dari `KHUSUS`/rose) default **aktif**; sel grid dapat ikon 🎂 + dot pink; **agenda hari terpilih** menampilkan kartu “🎂 {nama} · {umur} th” (avatar via `displayAvatar`); panel **“Ulang tahun bulan ini (n)”** di bawah kalender. Komponen hanya dipakai di portal (`IbadahMingguanPanel.tsx:126`).
- Verifikasi: lint bersih, **344 test** hijau (5 baru `tests/unit/birthday-week.test.ts`), build OK; uji browser di localhost:8787 (chip, ikon tanggal 3 Sep, agenda, panel bulanan, toggle off).

### Next
1. Deploy; uji di prod: buka **Kegiatan** → cek chip Ulang Tahun, ikon di tanggal HUT, agenda hari, panel “Ulang tahun bulan ini”; toggle off menyembunyikan.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Sapaan baru + kartu selamat datang & join WA kelompok (17 Sep 2026)

**Goal:** Sapaan seragam “Shalom, Damai Di Hati (nama)”; anggota yang baru masuk kelompok diarahkan gabung grup WhatsApp-nya.

**Done:**
- **Sapaan** (`PortalDashboard.tsx`): ganti “Selamat Melayani, {nama}!” → i18n `portal.dashboard.greeting` — ID `Shalom, Damai Di Hati ({name})`, EN `Shalom, peace in your heart ({name})` (nama lengkap).
- **Kartu** baru `src/components/portal/MenteeWelcomeCard.tsx` di atas Dashboard: sapaan + “Selamat datang di kelompok {Grup}” + nama Mentor/Co-Mentor + tombol **Gabung Grup WhatsApp {Grup}** (link `kind GROUP` via `/api/channel-links/scoped`; fallback bila belum ada) + **Lihat kelompok saya**. Tampil untuk **MENTEE/CO_MENTOR/MENTOR** yang punya grup; **dismiss per user+grup** (localStorage) → pindah grup muncul lagi. Helper `src/lib/welcome.ts`.
- **Notifikasi penugasan** (`server/role-assign.mjs`): bila role Beyonders + grup → judul `Selamat datang di kelompok {Grup}` + pesan arahkan gabung WA (bila link ada); payload membawa `groupName`/`waUrl`.
- i18n `portal.welcome.*` (ID+EN). Verifikasi: lint bersih, **339 test** hijau (4 baru `tests/unit/welcome.test.ts`), build OK.

### Next
1. Deploy; uji: assign mentee ke grup → notifikasi menyebut grup; Dashboard mentee menampilkan kartu + tombol WA; ganti grup → kartu muncul lagi.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — WA mentee + Portal Doa per kelompok (17 Sep 2026)

**Goal:** Mentor bisa chat WhatsApp ke mentee dari portal; catatan Portal Doa yang di‑tag ke roster grup muncul di portal kelompok itu.

**Done:**
- **Helper** `src/lib/wa.ts` (`waDigits`, `waMeHref`) — normalisasi `0→62`.
- **Endpoint** `GET /api/portal/groups/:id/roster` (`server/index.mjs`): roster ACTIVE + `phone` (GroupMember/User), gate **mentor grup/Komisi/SA**; endpoint publik `/api/db/groups*` tetap tanpa nomor (privasi).
- **UI Monitoring** (`ManageGroupsMonitoring.tsx`): tombol **WhatsApp** per anggota di tab **Roster** & **Absensi** (via prop `waHrefFor` di `AttendancePanel`), pesan otomatis; **Broadcast WA** (modal: salin semua nomor, unduh CSV, buka `wa.me` per orang). Nomor hanya tampil untuk mentor grup/Komisi/SA.
- **Portal Doa per kelompok** (`server/routes/pastoral-care.mjs`): `GET /api/pastoral-care?groupId=` (filter subjek anggota grup; gate mentor/Komisi/Liturgia/Diakonia) & `/api/pastoral-care/people?q=&groupId=` (cari dari roster); POST mengirim **notifikasi privat ke mentor grup** (kategori `pengingat`, tanpa detail).
- **UI Doa Kelompok**: tab **“Doa Kelompok”** + **section di Dashboard kelompok** (`GroupPrayerNotes`), semua jenis catatan + tombol Selesai. `PastoralCareBoard` dapat **filter grup** (juga memfilter pencarian subjek).
- **Kejelasan & discoverability** (17 Sep): tombol **“Broadcast WA (nomor)”** + catatan “bukan notifikasi”; panel **Pengumuman** kini juga untuk **MENTOR/CO_MENTOR** (kategori `announcement` untuk mentor ditambah; audiens GROUP/USER tetap dibatasi ke kelompoknya) + tautan silang ke Broadcast WA; aksi pencarian **“Kirim pengumuman (notifikasi)”** & **“Broadcast WhatsApp mentee”** (i18n ID/EN + katalog asisten AI).
- Verifikasi: lint bersih, **335 test** hijau (5 baru `tests/unit/wa.test.ts`), build OK.

### Next
1. Deploy; uji: Monitoring → Roster → tombol WA/Broadcast; buat catatan doa untuk mentee → muncul di “Doa Kelompok” + notifikasi ke mentor.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Regenerasi: guard + konfirmasi + wizard 5 langkah + demo SS/video (17 Sep 2026)

**Goal:** Cegah kesalahan urutan (mis. tetapkan pemimpin tanpa batch), wajib konfirmasi sebelum eksekusi, dan sediakan demo alur.

**Done:**
- **Revert** aksi “Tetapkan Mentor” Jurry (Agape @2026-09): hapus RoleAssignment/UserRole/GroupMember/MentorTransition-nya + pulihkan flag → Agape hanya **Prichel** MENTOR; 80 anggota @2026-06; `mentor_transitions=0`. Skrip `server/_revert-jurry-mentor.cjs` (backup dulu).
- **Server guard** (`server/routes/beyonders-leaders.mjs`): `assign-leader`/`carry-members`/`assign-members` balas **409** bila batch periode belum ada; **idempoten** (pemimpin sama → no-op); **pemimpin lama otomatis turun jadi MENTEE** (perbaiki bug dua mentor aktif); dukungan `dryRun` (pratinjau dampak) di assign-leader.
- **UI** (`RegenerationWizard.tsx`): **urutan 5 langkah** — `1 Alumni → 2 Buka generasi → 3 Pemimpin → 4 Bawa anggota → 5 Assign baru`; langkah 3–5 **disabled** sampai batch periode ada (banner guard); **ConfirmDialog** (`src/components/ui/ConfirmDialog.tsx`) untuk semua aksi + **type‑to‑confirm** (`REGENERASI`/`ALUMNI`/`BAWA`). Kartu “Buka generasi” lama dihapus (kini Langkah 2).
- **Demo** (SS + video) di `docs/demo/regenerasi/` (8 PNG + `regeneration.webm`) via `playwright.demo-desktop.config.ts` + `tests/demo/regeneration.spec.ts` (localhost:8787, DB staging).
- **Undo aksi terakhir**: tabel `regen_scope_snapshots` + `server/lib/regen-undo.mjs` (snapshot scope 10 rumah sebelum aksi; `REGENERATE/ASSIGN_LEADER/ASSIGN_MEMBERS/CARRY/ALUMNI`; restore = replace scope). Endpoint `GET /api/regen/undo/status` & `POST /api/regen/undo` (Komisi/SA). Tombol **“Batalkan aksi terakhir”** + konfirmasi ketik `UNDO` di wizard. Migrasi `server/_migrate-regen-snapshot.cjs` (staging+prod).
- **Riwayat generasi & alumni** (17 Sep): `AppContext` tak lagi membuang baris non‑ACTIVE untuk timeline — mentee ditempelkan ke batch dengan `status` (roster Anggota tetap ACTIVE‑only). `GroupDetailPage` “Sejarah Generasi” menampilkan chip **Aktif / Alumni / Gen lalu / Pindah** (warna). `HeritageSection` Hall of Alumni kini menampilkan **asal generasi** (`batchPeriod`). `GroupsCarousel` menghitung mentee **ACTIVE** saja. Normalisasi `batch_label` keliru: `server/_migrate-normalize-batch-label.cjs` (prod: 8 diperbaiki) + `db-migrate-local.mjs`.
- Verifikasi: lint bersih, **330 test** hijau (3 baru `tests/unit/regen-undo.test.ts`), build OK. Staging direset ke Gen0 setelah rekaman.

### Next
1. Deploy `main`; uji di prod: set **Periode generasi** ke periode baru → dialog buka generasi muncul otomatis (Opsi B) → konfirmasi → tetapkan pemimpin → bawa anggota (pratinjau) → assign; lalu coba **Batalkan aksi terakhir**.
2. Urutan tab wizard final: **1 Alumni · 2 Buka generasi · 3 Pemimpin · 4 Bawa anggota · 5 Assign baru**.
3. Undo membatalkan aksi regenerasi terakhir (scope 10 rumah). Hindari perubahan lain tak terkait tepat sebelum menekan Undo.

### Commands
```
npx dotenv -e .env.production -- node server/_revert-jurry-mentor.cjs
npx playwright test --config=playwright.demo-desktop.config.ts
npm run lint && npm run test && npm run build
```

---

## Prior — Restore prod ke generasi awal Juni 2026 (16 Sep 2026)

**Goal:** Kembalikan 10 rumah ke Gen0 `2026-06` setelah uji coba regenerasi membuat gen1 `2026-09` & gen2 `2026-10` (gen2 aktif).

**Done:**
- Skrip `server/_restore-gen0-2026-06.cjs` (non-destruktif, idempotent): backup `group_batches`+`group_members` → `backups/` lalu `is_current` hanya untuk `2026-06`; `group_members.batch_period` non-2026-06 → `2026-06`.
- Hasil prod: 2026-06 current (10), 2026-09 & 2026-10 non-current; 80 anggota ACTIVE @2026-06. Backup: `backups/restore-gen0-2026-09-16/`.
- `.gitignore`: `/backups/` (dump berisi PII — jangan commit).

### Cara ganti Mentor/Co-Mentor
- **Koreksi nama saja** (tanpa ubah akses): panel Pemimpin 10 Rumah → kartu rumah → isi Mentor/Co-Mentor → **Simpan**.
- **Ganti orang + sinkron peran** (rekomendasi): panel yang sama → **wizard Regenerasi → Langkah 1 “Pemimpin”** → set **Periode generasi** = batch berjalan (sekarang `2026-06`) → cari orang dari direktori → **Tetapkan Mentor/Co-Mentor**. Efek: peran portal pindah (tanpa peran ganda), pemimpin lama yang turun jadi MENTEE tetap di grup, riwayat `MentorTransition` tercatat.
- Untuk membuka generasi baru lagi dengan benar: **Buka generasi berikutnya** (periode baru) → Langkah 1 tetapkan pemimpin (period baru) → Langkah 3 **Pratinjau** lalu **Bawa anggota aktif** → Langkah 4 assign orang baru.

### Next
1. Sudah dibersihkan total: batch `2026-09`/`2026-10` **dihapus** (prod kini hanya 10 batch `2026-06` current; 80 anggota @2026-06). Backup: `backups/cleanup-extra-batches-2026-09-16/`.
2. Wizard ada di panel **Pemimpin 10 Rumah** (peran Komisi/Tim Kerja).

### Commands
```
npx dotenv -e .env.production -- node server/_restore-gen0-2026-06.cjs
npx dotenv -e .env.production -- node server/_cleanup-extra-batches.cjs
```

---

## Prior — Regenerasi menyeluruh: roster per generasi, sinkron peran, wizard 4 langkah (16 Sep 2026)

**Goal:** Regenerasi pemimpin + alumni per generasi + bawa anggota aktif + assign orang baru, dengan peran (RoleAssignment) selalu sinkron dan tanpa peran ganda.

**Done:**
- **Skema**: `MemberStatus` diperluas → `ACTIVE|ALUMNI|PAST|MOVED`; `GroupMember.movedToGroupId`; unique `[groupId, userId, batchPeriod]`. Migrasi idempotent `server/_migrate-member-generations.cjs` (dedupe aman) + daftar di `db-migrate-local.mjs`. **Sudah dijalankan staging & prod** + `prisma generate`.
- **Service** `server/lib/member-role-sync.mjs`: `placePerson` (pindah penuh: nonaktifkan assignment grup lain, tulis RoleAssignment+UserRole+GroupMember(period)+GroupBatch, set user flags; tanpa peran ganda), `markAlumniBulk` (roster ALUMNI + cabut akses grup + `User.memberStatus`), `carryActiveMembers` (ACTIVE→period baru, alumni & MOVED dilewati, baris lama → PAST, dry-run), `syncRosterRole` (dipakai shuffle/mitosis/merge agar `GroupMember`↔`RoleAssignment` sinkron).
- **Endpoint baru** (`server/routes/beyonders-leaders.mjs`): `POST /api/beyonders/leaders/:groupId/assign-leader` (+ catat `MentorTransition`), `POST /api/beyonders/leaders/carry-members` (+dryRun), `POST /api/beyonders/leaders/assign-members`. `POST /api/jemaat/member-status/bulk` kini ikut menyinkron roster grup saat ALUMNI.
- **Perbaikan**: `/api/regeneration/apply` (field `role` → `familyRole` + `status`).
- **UI**: komponen baru `RegenerationWizard.tsx` (4 langkah: Pemimpin · Alumni · Bawa anggota · Assign baru) dengan pratinjau/dry-run, `DirectoryPicker`, dan **badge warna status** (Aktif/Alumni/Generasi lalu/Pindah); dipasang di panel **Pemimpin 10 Rumah**.
- Verifikasi: lint bersih, **327 test** hijau (1 baru `tests/unit/member-role-sync.test.ts`), build OK.

### Next
1. Deploy; uji: Langkah 1 tetapkan pemimpin rumah (mis. mentee dari rumah lain) → cek akses portal pindah & peran lama nonaktif; Langkah 3 pratinjau lalu bawa anggota; Langkah 4 assign orang baru.
2. Perilaku: Mentor/Co-Mentor lama yang turun tetap di grup sebagai MENTEE (otomatis).
3. Warna status tampil di wizard; opsional: bawa ke family tree publik.

### Commands
```
npx dotenv -e .env.staging -- node server/_migrate-member-generations.cjs
npx dotenv -e .env.production -- node server/_migrate-member-generations.cjs
npx prisma generate
npm run lint && npm run test && npm run build
```

---

## Prior — Fix "Buka generasi berikutnya" (PRIMARY constraint batch id) (16 Sep 2026)

**Goal:** Tombol Pemimpin 10 Rumah gagal `INVALID prisma.groupBatch.createMany() … UNIQUE constraint failed: PRIMARY` saat membuka generasi.

**Akar masalah:** `GroupBatch.id` berpolа `batch-<groupId>-<periode>`, tetapi `period` bisa diedit (PATCH) dan migrasi generation mengubah `period`→`2026-06` tanpa memperbarui `id` → **8/10 rumah** punya id basi (`…-2026-09`, period `2026-06`). Regenerate menghasilkan id dari `nextPeriod` dan hanya memeriksa bentrok **period**, bukan **id** → PK bentrok.

**Done:**
- `server/lib/beyonders-generation.mjs`: `newBatchId()` — id bersufiks acak (≤64 char, tahan bentrok).
- Dipakai di: `server/routes/beyonders-leaders.mjs` (create PATCH + regenerate) & `server/role-assign.mjs` `ensureCurrentBatch`. Regenerate kini membalas **409 ramah** untuk `P2002`.
- Migrasi normalisasi `server/_migrate-normalize-batch-ids.cjs` (idempotent; hanya menyentuh id berakhiran `-YYYY-MM` yang tak cocok) + daftar di `db-migrate-local.mjs`. **Sudah dijalankan staging (0) & prod (8 id diperbaiki)**; run kedua = 0.
- Test `tests/unit/beyonders-batch-id.test.ts`. Verifikasi: lint bersih, **326 test** hijau, build OK.

### Next
1. Deploy; coba **Buka generasi berikutnya** (pilih periode yang belum dipakai, mis. `2026-07`).
2. Catatan pakai: nama di panel = **landing**; akses login mentor lewat Jemaat → Assign Role. Mitosis/merge anggota ada di **Regenerasi Kelompok**, bukan tombol ini.

### Commands
```
npx dotenv -e .env.staging -- node server/_migrate-normalize-batch-ids.cjs
npx dotenv -e .env.production -- node server/_migrate-normalize-batch-ids.cjs
npm run lint && npm run test && npm run build
```

---

## Prior — Notifikasi & Pengumuman: push berfungsi, broadcast per peran/divisi/kelompok (15 Sep 2026)

**Goal:** Push sungguhan saat ada update, plus pengumuman dari role tertentu (sampai level divisi/mentor) ke audiens tertentu; preferensi granular.

**Done:**
- **Diagnosis:** push hanya jalan di 3 trigger (Warta/Galeri/catalog); `/api/paw/send` tak kirim push & RBAC longgar; langganan disimpan nakal di baris `notifications`.
- **Skema** `prisma/schema.prisma`: `PushSubscription`, `NotificationPreference`, `Announcement`; kolom `notifications.category/announcement_id/sender_role`; enum `NotificationType` + `ANNOUNCEMENT/SWAP_REQUEST/ALBUM_USULAN` (fix drift). Migrasi idempotent `server/_migrate-notifications.cjs` (daftar di `db-migrate-local.mjs`) — **sudah dijalankan staging & prod** (prod: 11 langganan lama dimigrasikan, 11 baris hack dihapus) + `prisma generate`.
- **Layanan pusat** `server/lib/notify.mjs`: `sendNotification()` (inbox + push, hormati preferensi), `pushToUsers()`, `resolveAudience()` (PUBLIC=pelanggan, ROLE/DIVISION/GROUP/USER), `senderCapabilities()` (matriks izin + whitelist kategori + scope divisi/grup).
- **Endpoint**: refactor `/api/push/subscribe` + `/api/push/unsubscribe` (tabel baru), `/api/notifications/preferences` (GET/PUT), `/api/paw/send` RBAC + push. Baru `server/routes/announcements.mjs` (capabilities/list/create/send/archive dengan validasi audiens & scope) dan `server/routes/notif-cron.mjs` (`/api/cron/notif-dispatch`, `/api/cron/reminders`).
- **Push transactional** disambung: penugasan role, **penatalayan**, approval item, mention.
- **UI**: panel **Pengumuman** (nav baru; compose + riwayat + sender role), preferensi kategori granular di Akun → Notifikasi, lonceng menampilkan **asalan peran**. i18n nav+guide.
- **Cron** `vercel.json` (batas Hobby: **maks 2 cron/hari**): `/api/cron/event-lifecycle` (01:00 UTC) + `/api/cron/notif-daily` (12:00 UTC = 19:00 WIB → dispatch pengumuman terjadwal + pengingat H-1). Dispatch juga dipicu opportunistik saat lonceng polling. **Perlu set `CRON_SECRET` di Vercel** (Production & Preview).
- Verifikasi: lint bersih, **323 test** hijau (4 baru `tests/unit/notify.test.ts`), build OK.

### Next
1. Deploy `main`; set `CRON_SECRET` di Vercel (Production & Preview).
2. Uji: aktifkan push (Akun → Notifikasi) → kirim pengumuman Komisi ke publik; komisi ke peran; mentor ke kelompoknya (batas scope); cek lonceng + push.
3. Opsional lanjutan: push untuk Warta/Galeri lewat `sendNotification` terpusat; digest harian ke Komisi; langganan anonim publik.

### Commands
```
npx dotenv -e .env.staging -- node server/_migrate-notifications.cjs
npx dotenv -e .env.production -- node server/_migrate-notifications.cjs
npx prisma generate
npm run lint && npm run test && npm run build
```

---

## Prior — Status keaktifan pemuda (Alumni/Nonaktif) + Perlu Penempatan + Rekomendasi Grup + CSV Jemaat (15 Sep 2026)

**Goal:** Bedakan "Community legacy" vs "Belum ditempatkan" vs aktif; dukung penempatan kelompok binaan tanpa auto-apply; export CSV sesuai filter Jemaat.

**Done:**
- **Diagnosis prod:** Pemuda 107 → 66 sudah di grup, **38 "Community legacy"** (`UserRole` lama tanpa `RoleAssignment`/grup), 2 "Belum ditempatkan". Kapasitas 10 grup: aktif 66, sisa 34 @ambang 10 (kurang ~6 untuk 40 orang).
- **Skema** `prisma/schema.prisma`: `enum MemberActivityStatus { ACTIVE ALUMNI NONAKTIF }` + `User.memberStatus` (default ACTIVE, terpisah dari `membershipKind`) + index. Migrasi idempotent `server/_migrate-member-status.cjs` (daftar di `scripts/db-migrate-local.mjs`). **Sudah dijalankan ke staging & prod** + `prisma generate`.
- **Server** (`server/index.mjs`): `queryJemaat` filter `memberStatus`; `PATCH /api/jemaat/:id` & `PATCH /api/admin/users/:id` terima `memberStatus`; baru `POST /api/jemaat/member-status/bulk` (tandai massal) & `POST /api/jemaat/placement/recommend` (**read-only**, pakai `recommendPlacementAdvanced` + kapasitas grup `GROUP_THRESHOLD`).
- **Filter** `src/lib/jemaat-filter.ts`: `MainFilter` + `ALUMNI`/`NONAKTIF`; `needsPlacement()` (Pemuda aktif, bukan individu, tanpa grup); Alumni/Nonaktif dikecualikan dari Individu.
- **UI Jemaat** `YouthGEHCList.tsx`: badge **Alumni/Nonaktif** (tetap tampil), chip filter baru, toggle **"Perlu penempatan"**, aksi status per baris + bulk + modal Edit, **"Rekomendasi grup"** (bulk → tampilkan usulan + alasan, tanpa auto-apply), tombol **"Unduh CSV"**.
- **CSV** `src/lib/csv.ts` (`toCsv`/`downloadCsv`) — export `displayed` (hormati semua filter) dengan kolom `member_status` & `status_penempatan`. `WaitingPoolPanel.exportCsv` kini ikut filter (domisili/origin/profil).
- Verifikasi: lint bersih, **319 test** hijau (4 baru `tests/unit/jemaat-csv.test.ts`), build OK; migrasi staging+prod sukses.

### Next
1. Deploy `main`; di Jemaat: filter **Perlu penempatan** (≈40), pilih banyak → **Rekomendasi grup** → assign manual lewat wizard/bulk; **Unduh CSV**.
2. Rapikan penempatan: 38 legacy perlu masuk kelompok (kapasitas kurang ~6 → pertimbangkan ambang/mitosis/grup baru).
3. i18n label baru (Alumni/Nonaktif/Perlu penempatan/dll) bila perlu EN.

### Commands
```
npx dotenv -e .env.staging -- node server/_migrate-member-status.cjs
npx dotenv -e .env.production -- node server/_migrate-member-status.cjs
npx prisma generate
npm run lint && npm run test && npm run build
```

---

## Prior — "Portal Cari & Panduan": command palette + pratinjau langkah + Tanya AI (15 Sep 2026)

**Goal:** Satu pintu untuk menemukan semua fitur & panduan tanpa menghafal menu/role — cari, lihat langkah, langsung buka; fitur terkunci dijelaskan + bisa ganti peran.

**Done:**
- **Indeks** `src/lib/portal-search-index.ts`: gabungan semua menu (`getAllPortalNavDefs`, termasuk yang terkunci untuk transparansi), **seluruh 42 guide i18n** (title/purpose/steps/when/notFor), dan aksi terkurasi; `searchPortal()` deterministik (token + bobot posisi, tanpa dependency). `guideIdToPage()` memetakan sub-guide → halaman induk.
- **Aksi lintas-panel** `src/lib/portal-actions.ts` (penatalayan, tambah divisi, buat event, upload RHB, provision akun, WA channels, warta, kesaksian, doa, Info Event).
- **UI** `PortalSearchPalette.tsx` (dialog: input + daftar + **pratinjau langkah**), `PortalGuidePreview.tsx` (reusable). Shortcut **Ctrl/Cmd+K**, tombol cari di sidebar (mode collapse & expand) dan topbar mobile; navigasi via `handleNavClick`.
- **RBAC tetap server-side**: item yang tak diizinkan tampil redup + "Perlu peran: X"; bila user memiliki peran itu → **"Buka sebagai <ROLE>"** (`setActiveUserRole` lalu navigasi). SUPERADMIN bebas.
- **Help drawer** diperluas: kotak cari + daftar **semua guide** (termasuk sub-guide) memakai `PortalGuidePreview`.
- **Tanya AI** (opsional): `POST /api/portal/ask` (`server/routes/portal-assist.mjs`) memakai `jethroGenerateText`; katalog **server-side difilter per peran** (`server/lib/portal-feature-catalog.mjs`), `page` divalidasi ke allowlist peran; tanpa `OPENAI_API_KEY`/`GROQ_API_KEY` → 503 (toggle menampilkan pesan). AI tidak mengeksekusi aksi.
- `src/lib/portal-routes.ts`: tambah `church-info` ke union `PortalPage`.
- i18n `portal.search.*` (ID+EN). Verifikasi: `npm run lint` bersih, **315 test hijau** (7 test baru `tests/unit/portal-search.test.ts`), `npm run build` OK.

### Next
1. Deploy `main`; coba `Ctrl/Cmd+K` di portal, cari "penatalayan"/"QR"/"tambah divisi"; uji item terkunci sebagai MENTEE lalu ganti peran.
2. Tanya AI hanya aktif bila env `OPENAI_API_KEY` (atau `GROQ_API_KEY`) terpasang di Vercel — jika belum, toggle tetap aman (pesan 503).
3. Opsional lanjutan: quick-actions per peran di dashboard + analytics pencarian.

### Commands
```
npm run lint && npm run test && npm run build
```

---

## Prior — Panel event hanya menampilkan divisi yang aktif (15 Sep 2026)

**Goal:** Di detail Program & Event, kartu "Rincian per Divisi" tidak lagi menampilkan keenam divisi sekaligus — cukup divisi yang memang terlibat di event itu.

**Done:**
- `src/components/portal/EventWorkspacePanel.tsx`: derivasi `eventDivisions` dari `selected.divisions` (urutan kanonik tetap) + `missingDivisions`; loop kartu memakai `eventDivisions`.
- Badge header jadi `{n} divisi aktif` (bukan "6 divisi · 20 sub · 3 fase"); catatan statis diganti kalimat dinamis.
- **Empty state**: bila 0 divisi → kartu "Belum ada divisi diaktifkan untuk event ini" (tanpa fallback 6 divisi).
- **Tambah divisi** (staf SUPERADMIN/KOMISI/COMMITTEE): chip `missingDivisions` di header & empty state → `POST /api/events/:id/divisions` (endpoint lama), lalu append ke `selected.divisions` + toast. Non-staf tanpa tombol.
- Verifikasi: `npm run lint` bersih, 308 test hijau.

### Next
1. Cek 20 Sep (LITURGIA+DIDASKALIA), 27 Sep (4 divisi), BAKU (KOINONIA) → kartu sesuai; coba tombol Tambah divisi.

### Commands
```
npm run lint && npm run test
```

---

## Prior — Penatalayan per-event: komponen Liturgia/Marturia + multi-personel (15 Sep 2026)

**Goal:** Jadwal penatalayan per event (bukan hanya kalender tanggal) dengan komponen baku yang bisa diedit, penugasan banyak orang per komponen, dan salin dari event sebelumnya.

**Done:**
- **Temuan:** modul penatalayan lama (`ServiceRole`/`ServiceSchedule` + `PenatalayanCalendar`) ada tapi kosong di prod (0 role/0 schedule), berbasis tanggal (tak pakai `eventId`), tanpa komponen baku, dan tanpa UI kelola role.
- **Seed** `server/seed-service-roles.mjs` (idempoten): 22 komponen baku LITURGIA (Liturgist, WL, Singer, pemusik, pembaca firman, doa, kolektor, MC, dll) + MARTURIA (sound, multimedia, kamera, foto, editor, desain). Skrip: `db:seed:service-roles[:staging|:prod]`. **Sudah dijalankan ke staging & prod (22 dibuat di masing-masing).**
- **API** (`server/index.mjs`): roles GET (filter `division` CSV + `includeInactive`), POST (dengan reactivate nama sama), **PATCH** & **DELETE** (hapus bila tak terpakai, jika tidak arsip); schedules POST kini terima `userIds[]` (multi-orang) + PATCH time; `GET /api/events/:id/penatalayan` (event + roles + assignments + referensi event sebelumnya); `POST /api/events/:id/penatalayan/copy` (salin penugasan event sebelumnya, idempoten).
- **UI per-event** `src/components/portal/EventPenatalayanPanel.tsx`: grup per Liturgia/Marturia, assign multi-orang per komponen, hapus, siklus status (Dijadwalkan→Dikonfirmasi→Selesai), tombol salin dari event sebelumnya, panel collapsible kelola komponen. Dipasang di detail `EventWorkspacePanel` (canEdit = SUPERADMIN/KOMISI/COMMITTEE).
- **UI divisi** `PenatalayanRolesEditor.tsx` (editor komponen: tambah/edit/urutan/arsip) dipakai di tab Penatalayan Panel Divisi & per-event. Tab Penatalayan kini juga tampil untuk **MARTURIA** (sebelumnya hanya LITURGIA).
- **Fix deep-link** push penatalayan `/#/penatalayan` (tak ada route) → `/#/portal`; `public/sw.js` pakai `data.url`.
- Verifikasi: `npm run lint` bersih, 308 test hijau, `node --check` OK.

### Next
1. Deploy `main`; cek portal → Program & Event → pilih event → panel **Penatalayan & Liturgi** (assign beberapa orang per komponen) dan Panel Divisi → Liturgia/Marturia → Penatalayan.
2. Sesuaikan daftar komponen via "Kelola komponen" bila nama jabatan lokal berbeda — perubahan langsung berlaku untuk semua event.

### Commands
```
npm run db:seed:service-roles:staging
npm run db:seed:service-roles:prod
npm run lint && npm run test
```

---

## Prior — Info Event & landing mengikuti event terdekat, bukan BAKU TAU arsip (15 Sep 2026)

**Goal:** Semua "info event" di prod mengikuti event yang masih berjalan/akan datang; sisa hardcode BAKU TAU dibersihkan.

**Done:**
- **Diagnosis prod (read-only):** `evt-baku-tau-4-0` = ARCHIVED (12 Sep); event terdekat `Ibadah Pemuda: Follow the True Voice — 20 Sep 2026` (ACTIVE); `/api/events/landing` menempatkan `cnt-bakutau` (featured, arsip) di depan sehingga kartu unggulan salah.
- `src/components/public/HeroSection.tsx`: hero "Pertemuan Terdekat" tak lagi `fetch('/api/events/bakutau')`; pakai `pickNextEvent()` dari `/api/events/landing` (full + compact), lewati ARCHIVED/DONE.
- `src/components/public/EventsTimeline.tsx`: kartu unggulan = event non-arsip terdekat, bukan `full.find(is_featured_event)` yang memilih BAKU arsip.
- `src/components/portal/EventInfoPanel.tsx`: `pickNearest` + dropdown "Tanggal" mengabaikan event ARCHIVED (default jadi 20 Sep).
- `src/components/portal/BakuTauWelcomeCard.tsx`: default venue/tanggal/peta BAKU dihapus → kartu generik per event.
- Teks: subtitle nav `portal-nav-config.ts`, guide `i18n/portal-{id,en}.ts`, fallback hero `i18n/{id,en}.ts` tak lagi menyebut BAKU TAU.
- Verifikasi: `npm run lint` bersih, 308 test hijau.

### Next
1. Deploy `main` → refresh prod (youth.gehc.page): hero, kartu Kegiatan, dan portal Info Event harus menunjuk 20 Sep.
2. Event berikutnya cukup diubah status/tanggal di Program & Event — tampilan ikut menyesuaikan tanpa deploy.

### Commands
```
npm run lint && npm run test
```

---

## Prior — Nama bergelar tidak lagi tertimpa nama akun Google/username (13 Sep 2026)

**Goal:** `User.name` (nama resmi + gelar) tidak ditimpa nama profil Google/akun saat login; undangan ikut menyimpan field gelar terstruktur.

**Done:**
- **Akar masalah:** semua UI membaca `User.name` mentah, tapi jalur Google OAuth menulis `name: p.name` tanpa merangkai ulang `givenName/familyName/churchTitle/academicTitles` → gelar hilang tiap login. Username sendiri tidak pernah jadi sumber nama.
- `server/lib/person-name.mjs`: helper baru `partsFromUser`, `hasStructuredName`, `resolveDisplayName(user, fallback)` (prioritaskan field terstruktur, fallback nama provider/`name`).
- `server/auth.mjs`: 5 titik Google (login sub, login email, create, claim, link) pakai `resolveDisplayName`.
- `server/index.mjs`: jalur Google join/invite-code (`:3795`), register Google (`:3970`), dan `upsertGoogleUser` (`:4294`) juga pakai `resolveDisplayName`.
- `server/invite-provision.mjs`: terima `nameParts`; bila nama polos, `parseDisplayName` membongkar gelar (mis. `Pdt Meyke Poluan S.Th., M.Pd.,`) lalu simpan field terstruktur sehingga tak hilang saat Google login. Username tetap diturunkan dari nama pribadi tanpa gelar.
- `server/index.mjs`: endpoint `invite-provision` + `-bulk` teruskan `nameParts`.
- `src/components/portal/ProvisionInviteWizard.tsx`: mode single pakai `PersonNameFields` (gelar gereja/akademis + preview nama tercetak); bulk tetap input nama polos (server mem-parse gelar).
- Test: `tests/unit/person-name-server.test.ts` (3 kasus). Verifikasi: `npm run lint` bersih, 308 test hijau.

### Next
1. Uji staging: undang user bergelar → login Google → pastikan nama tetap `Pdt …`; dan user lama yang namanya sudah tertimpa perlu dikoreksi via permintaan admin / edit profil onboarding.
2. Pertimbangkan opsi 2 (display dihitung dari field terstruktur saat read) agar `name` murni cache.
3. Commit + deploy.

### Commands
```
npm run lint && npm run test
```

---

## Prior — Kegiatan ikut tanggal + bonding privat per grup (13 Sep 2026)

**Goal:** Klik tanggal di Kegiatan menampilkan folder event tanggal itu; album bonding hanya untuk grup terkait + SUPERADMIN/KOMISI/BOD COMMITTEE.

**Done:**
- **Kegiatan** `src/components/portal/KegiatanCalendar.tsx`: klik sel tanggal → `selectDay(day)` (set `daySel` + `onSelect` event hari itu, utamakan kind `UMUM`); klik baris agenda → `onSelect` (detail di bawah ikut berganti), link "Info →" tetap navigasi. `IbadahMingguanPanel` tak diubah (sudah fetch 01/02/03 per `selectedId`).
- **Bonding privat** `server/lib/drive-ownership.mjs`: helper `isBondingStaff` (SUPERADMIN/KOMISI/COMMITTEE; BPMJ tidak) + `isBondingViewer` (staf bonding ATAU role punya `groupId`).
- `server/routes/drive-ownership.mjs`: `GET /api/groups/:id/albums` kini `requireRole()` + gate `isBondingViewer` (403 untuk non-anggota; `includeDrive=true` untuk yang lolos); `GET /api/groups/albums` + `GET /api/portal/calendar` pakai `isBondingStaff` (BPMJ keluar); `.../files`, upload & hapus foto pakai `isBondingViewer`.
- `src/hooks/useActiveAccess.ts`: `canViewBonding` keluarkan BPMJ.
- `src/components/public/GroupDetailPage.tsx`: 401 juga diperlakukan `restricted` (anonim → tab Docs terkunci, bukan "kosong").
- Verifikasi: `npm run lint` bersih, 305 test hijau, `node --check` OK.

### Next
1. Uji staging sebagai mentee grup non-Echad (album Echad → restricted) & anggota Echad (bisa), lalu sebagai Komisi/Committee (semua grup), BPMJ (tidak).
2. Uji Kegiatan: klik 06 Sep → kartu folder 06 Sep muncul.

### Commands
```
npm run lint && npm run test
```

---

## Prior — Drive per tanggal ibadah + paritas data September prod (13 Sep 2026)

**Goal:** Tiap tanggal ibadah punya folder Drive DIDASKALIA sendiri + 3 subfolder; Info Event bisa pilih tanggal; produksi sejajar perilaku staging tanpa mengubah nama event.

**Done:**
- **Diagnosis:** staging vs prod jalan di commit sama (`6799436`) tapi **DB berbeda** (`server/db.mjs`: produksi → `DATABASE_URL_PRODUCTION`, preview → `DATABASE_URL_STAGING`). Prod punya 5 event manual (`serviceType`/`metadata` null), hanya 13 Sep punya folder DIDASKALIA; folder lain dibuat lazy (`server/gdrive-events.mjs`, `server/index.mjs:1961/2454/2528`).
- **Skrip** `server/_provision-september-events.cjs` — idempoten, mode `--dry`, `--apply`, `--list=<folderId>`, `--move`, `--year-month=YYYY-MM`. Menjalankan: set `serviceType`+`metadata{weekIndex,yearMonth}`, pastikan `EventDivision(DIDASKALIA)`, `createEventFolder` → folder `"<nama> [EV:<slug>:DIDASKALIA]"` + `01 Pembekalan / 02 Ringkasan Khotbah / 03 RHB 7 Hari`.
- **Apply prod September:** 06/13/20/27 Sep punya folder + 3 subfolder sendiri; 20 & 27 dapat divisi DIDASKALIA baru; `serviceType` metadata terisi.
- **Pindah file:** RHB Week 1 Path 1–7 + `THE CHURCH BEGINS HERE.pdf` dari folder 13 Sep → folder 06 Sep. Sisa di 13 Sep: `DOC-20260905-WA0011.pdf` (01) + `RHB - Week 2 Path 1` (03).
- **Kode:** `server/routes/didaskalia-rhb.mjs` — POST `/api/didaskalia/rhb/upload` kini utamakan folder per-event `03 RHB 7 Hari` (fallback pillar legacy). `src/components/portal/EventInfoPanel.tsx` — penjelajah tanggal (dropdown dari `/api/events`), deep-link `?event=` tetap.
- Verifikasi: `npm run lint` bersih, 305 test hijau, `node --check` OK; inspeksi prod Drive/DB sesuai.

### Next
1. Commit + deploy agar UI penjelajah tanggal & fix RHB live (Fase 3/4 masih lokal).
2. Bulan berikutnya: `--year-month=2026-10` (event sudah ada) atau buat event via Rencana Layanan lalu jalankan skrip.
3. Isi materi 20/27 Sep via Panel Divisi → Didaskalia → Studio (terbit per event).

### Commands
```
dotenv -e .env.production -- node server/_provision-september-events.cjs --dry
dotenv -e .env.production -- node server/_provision-september-events.cjs --apply
dotenv -e .env.production -- node server/_provision-september-events.cjs --year-month=2026-10 --apply
dotenv -e .env.production -- node server/_provision-september-events.cjs --list=<folderId>
dotenv -e .env.production -- node server/_provision-september-events.cjs --move --apply
npm run lint && npm run test
```

---

## Prior — Galeri hub live dari Drive + logo (GMIM/Pemuda) + optimasi (13 Sep 2026)

**Goal:** Foto galeri & logo tampil di web tanpa publish; logo Pemuda GMIM di hub & Pemuda; hero hub pakai dinding foto berotasi.

**Done:**
- **Loader merge** (`server/routes/content-public.mjs`): grup dinamis **`hub`** & **`brand`** kini selalu dibaca dari Drive walau manifest statis aktif (`mergeDriveDynamic`). Akar bug sebelumnya: `source: static` membuat Drive tak pernah dibaca → galeri/logo tak muncul. Kini `source: drive`, `hub` = 7 foto.
- **Slot baru** `brand.logoYouthGmim` (`brand/logo-youth-gmim.png`).
- **Optimasi logo** `server/optimize-brand-logos.mjs` + `drive:optimize-logos[:prod]`: `logo-youth-gmim` 1.13 MB → 52 KB; `logo-gmim` 173 KB → 69 KB (staging & prod).
- **Publish** `.github/workflows/publish-visuals.yml`: tambah ops `hub`, `panca`; label di `visuals-publish.mjs`.
- **Hero hub** `ChurchHub.tsx`: 2 kolom + **`HeroPhotoWall`** (collage tile berotasi ~5 dtk dari `slots.hub`, watermark wordmark GEHC + logo GMIM & Pemuda GMIM). Section marquee galeri bawah dihapus.
- **Logo Pemuda GMIM** dipasang di: Navbar Pemuda, Hero landing Pemuda (`HeroSection`), Footer, dan hero hub.
- Verifikasi: lint bersih, 305 test hijau, build OK; `/api/media/slots` → `hub` 7, `brand` = logoGehc/logoGmim/logoYouthGmim; screenshot hub & youth sesuai.

### Next
1. Isi/tambah foto galeri kapan saja via panel Info Gereja → Galeri (atau Drive `hub/`) → muncul ≤60 dtk.

### Commands
```
npm run drive:optimize-logos:prod
npm run lint && npm run test && npm run build
```

---

## Prior — Pitch deck: demo PWA (video) + slide URL/QR + copy awam (13 Sep 2026)

**Goal:** Dorong jemaat mendaftar: peragakan cara daftar → pasang di HP → aktifkan notifikasi di pitch, plus slide URL + QR yang bisa langsung discan.

**Done:**
- **Perekam demo Playwright** (`playwright.demo.config.ts` + `tests/demo/record.spec.ts`, emulasi Pixel 5, `video: 'on'`): menghasilkan 3 klip webm dengan efek zoom/caption per langkah — `01-daftar`, `02-pasang`, `03-notifikasi` di `public/media/demo/`.
- **QR statis offline**: `public/media/qr-daftar-youth.png` (→ `https://youth.gehc.page/#/register`) & `public/media/qr-hub.png` (→ `https://gehc.page`).
- **PitchDeck**: jenis slide baru `demo` (bingkai ponsel + video autoPlay/loop, klik per langkah memutar klip) dan `qr` (kartu QR per langkah). `stepsFor` diperbarui.
- **pitchSlides.ts**: tambah slide "Cara mulai" (3 langkah) & "Scan untuk mulai"; copy distilisasi jadi bahasa awam (hindari istilah teknis); closing mengarah ke `youth.gehc.page`.
- **playwright.config.ts**: `testIgnore` menyertakan `**/demo/**` agar perekam tidak ikut `npx playwright test`.
- Verifikasi: lint bersih, 305 test hijau, build OK; 3 klip terekam (739/796/595 KB).

### Next
1. Pratinjau `#/pitch` di `gehc.page` (slide demo & QR), lalu uji scan QR dari HP.
2. Bila perlu mp4 untuk TV tertentu: tambahkan tooling konversi (ffmpeg) lalu generate versi mp4.
3. Bersihkan akun demo hasil rekaman lokal bila perlu (email `demo.pwa.*@gehc.page`).

### Commands
```
npx playwright test --config=playwright.demo.config.ts   # rekam ulang klip
npm run lint && npm run test && npm run build
```

---

## Prior — Kelola Galeri Hub dari panel Info Gereja + folder Drive (13 Sep 2026)

**Goal:** Buat folder galeri hub otomatis dan kelola foto langsung dari panel (unggah/hapus), tanpa buka Drive manual.

**Done:**
- **Script** `server/_ensure-hub-gallery-folder.cjs` + npm `drive:ensure-hub[:prod]` — memastikan `Website Visual [PUBLIK]/hub/`. Dijalankan: staging (hub `1Ppa8OiS…`) & production (hub `1M-Ut3jr…`).
- **API** `server/routes/hub-gallery.mjs` (akses SUPERADMIN/BPMJ/KOMISI): `GET /api/hub/gallery` (baca via SA), `POST /api/hub/gallery` (unggah, OAuth pemilik, public reader), `DELETE /api/hub/gallery/:fileId` (ke sampah), `POST /api/hub/gallery/ensure-folder`. Mutasi memanggil `bustSlotsCache()` (`content-public.mjs`) agar carousel langsung ikut.
- **Panel**: tab/section **Galeri** di `ManageChurchInfo.tsx` — grid thumbnail, unggah multi-foto (kompres klien → JPEG ≤1600px), hapus, tombol "Buat folder", link "Buka di Drive".
- Verifikasi: lint bersih, 305 test hijau, build OK; deploy prod; `GET/POST /api/hub/gallery` = **401 tanpa sesi** (rute terdaftar); `slots.hub` ada.
- Folder Drive: **prod** `Website Visual [PUBLIK]/hub/` = ID `1M-Ut3jreOSxbRLzsy_TycyhHI3LEuEav`.

### Next
1. Isi ≥4 foto publik ke folder `hub` (via panel atau Drive) → carousel hub muncul.
2. Unggah `brand/logo-gmim.png` (watermark + footer hub).

### Commands
```
npm run drive:ensure-hub:prod
npm run lint && npm run test && npm run build
```

---

## Prior — Info Gereja tampil di landing Pemuda + salin staging→prod (13 Sep 2026)

**Goal:** Data Info Gereja yang diisi di staging dipakai di prod, dan tampil di landing `youth.gehc.page` (footer) — bukan hanya hub `gehc.page`.

**Done:**
- **Script salin** `server/_copy-church-profile-to-prod.cjs`: church_profile singleton + profil unit (`tenants.tagline/contact_email/socials`) dari `DATABASE_URL_STAGING` → `DATABASE_URL_PRODUCTION`. Dry-run default, tulis dengan `--apply`; `--skip-empty` agar kolom prod terisi tidak dikosongkan; `--only=church|tenants`. Sudah dijalankan (`--apply --skip-empty`): prod kini punya email, sosial (IG/FB/TikTok), 4 jadwal, alamat baru; tenant `youth` = IG pemuda.
- **Footer landing Pemuda** (`src/components/public/Footer.tsx`) kini membaca `/api/church-profile` + `/api/tenants/youth/profile`: jadwal, alamat/peta, email, WhatsApp, telepon, dan ikon sosial dinamis (fallback i18n lama bila kosong).
- Script npm: `npm run db:copy:church-profile:prod`.
- Verifikasi: lint bersih, 305 test hijau, build OK; `/api/church-profile` prod 200 (kedua host) & `/api/tenants` youth terisi.

### Next
1. Cek visual landing `youth.gehc.page` (footer) + hub `gehc.page` (cache 30s).
2. Bila ada perubahan Info Gereja lagi: isi di staging → `node server/_copy-church-profile-to-prod.cjs --apply --skip-empty` (atau langsung lewat portal prod).

### Commands
```
npm run db:copy:church-profile:prod
npm run lint && npm run test
```

---

## Prior — Hub rapi + Pitch deck + portal di gehc.page + galeri (13 Sep 2026)

**Goal:** Rapikan direktori unit hub, tambah presentasi publik, aktifkan portal di host hub, dan galeri jemaat dari Drive.

**Done:**
- **Urutan unit hub**: BIPRA dulu (Pria/P-KB, Wanita/W-KI, Pemuda, Pra Remaja, Anak) → Teritorial (Kolom) → Lainnya; header grup. `src/data/churchUnits.ts` + `ChurchHub.tsx`.
- **Pembeda jelas**: kartu aktif (Pemuda) putih + bar aksen gradien + badge hijau; coming soon abu + ikon grayscale + border putus-putus.
- **Root reaktif-hash** (`src/main.tsx` + `src/lib/host-context.ts`): di host hub, `#/portal`/`#/admin`/`#/claim`/`#/forgot-password`/`#/reset-password` render portal; `#/pitch` render presentasi; hash lain = hub.
- **PitchDeck** (`src/components/hub/PitchDeck.tsx` + `src/data/pitchSlides.ts`): 8 slide publik di `gehc.page/#/pitch`; navigasi keyboard (Spasi/↓/→/Enter maju, ↑/← mundur, Home/End, F fullscreen, Esc keluar), progress + dots + tombol sentuh.
- **Galeri hub** (`HubGalleryCarousel.tsx`): foto dari Drive `Website Visual [PUBLIK]/hub/` (loader dinamis `content-public.mjs`), carousel geser `useSteerableMarquee`; tampil bila ≥4 foto. Folder `hub` ditambah ke `WEBSITE_VISUAL_SUBFOLDERS`.
- Verifikasi: lint bersih, 305 test hijau, build OK (chunk terpisah); deploy prod; smoke `gehc.page`, `#/pitch`, `#/portal`, `youth.gehc.page`.

### Next
1. Buat folder **`Website Visual [PUBLIK]/hub/`** di Drive, unggah ≥4 foto publik → galeri muncul.
2. Unggah `brand/logo-gmim.png` (watermark + footer hub).
3. Klaim Google Business Profile + isi Info Gereja (kontak/sosial).

### Commands
```
npm run lint && npm run test && npm run build
npm run dns:list
```

---

## Prior — Info Event generik + terima kasih pasca-event + fix push iOS (13 Sep 2026)

**Goal:** Info Event menampilkan event yang dipilih (redirect dari Kegiatan) atau event terdekat; ucapan terima kasih personal untuk peserta BAKU TAU yang sudah hadir (bisa unduh kartu); iOS Safari tidak lagi salah bilang "browser tidak dukung".

**Done:**
- **iOS push** (`src/lib/push-capability.ts`): deteksi iOS didahulukan sebelum cek `PushManager`. Safari tab (iOS 16.4+) kini dapat arahan "Install dulu di iPhone", bukan "browser tidak dukung". +8 unit test; banner menampilkan hint kemampuan.
- **Info Event generik** (`EventInfoPanel.tsx`): baca `?event=`, tanpa param → event terdekat (event ibadah diprioritaskan bila tanggalnya sama); QR daftar ulang disembunyikan saat status DONE/ARCHIVED; materi Didaskalia 01/02/03 per event (`EventDidaskaliaMaterials.tsx`).
- **Kegiatan → Info Event**: klik baris event (kalender & linimasa) redirect ke `event-info?event=<slug|id>` (`KegiatanCalendar` + `IbadahMingguanPanel`).
- **Terima kasih pasca-event** (`EventThankYouCard.tsx`): personal (nama depan), tombol unduh PNG, tanpa daftar hadir publik; yang hadir dapat ucapan, terdaftar-tanpa-hadir dapat varian lembut. `server/routes/baku-tau.mjs` mengirim `attended/checkedInAt/eventStatus/givenName`.
- **Sinkron Didaskalia**: `resolveEventId` prioritaskan `MENTORING_DAY/SERVING_DAY`; copy Monitoring diselaraskan ke "7 Path harian".
- **Salvage**: `.cursor/rules/context-handoff.mdc`; E2E alamat di `tests/e2e/` (profil cascade, filter direktori, modal admin) + helper SearchableSelect di `tests/helpers/portal.ts`.
- Verifikasi: lint bersih, 54 file / 305 test hijau, build OK, E2E alamat 3/3 lulus.

### Next
1. Uji di staging: Info Event BAKU TAU dengan akun yang `eventCheckedInAt` terisi → kartu terima kasih + unduh PNG.
2. Uji iOS: Safari tab → arahan install; setelah Add to Home Screen → Aktifkan push.
3. Sambungkan gambar tema (slot Drive) ke cover PDF Didaskalia bila aset siap.

### Commands
```
npm run lint && npm run test
npx playwright test tests/e2e/address-flow.spec.ts tests/e2e/admin-address.spec.ts
```

---

## Prior — Info Gereja editable + hub (kontak, BPMJ, logo/watermark) (12 Sep 2026)

**Goal:** Info gereja (alamat, maps, email, sosial, jadwal) editable dari portal; hub menampilkan kontak, struktur BPMJ, dan identitas visual.

**Done:**
- **Skema** (`_migrate-church-profile.cjs`, lokal+staging+prod): tabel `church_profile` (singleton `church-profile`) + `tenants.tagline/contact_email/socials`; seed default (INSERT IGNORE). `db:schema:check` hijau.
- **API** (`server/routes/church-profile.mjs`): `GET /api/church-profile` (publik, fallback env), `PUT` (SUPERADMIN/BPMJ/KOMISI), `GET /api/tenants` (publik), `GET/PUT /api/tenants/:slug/profile`.
- **Panel "Info Gereja"** (`ManageChurchInfo.tsx`, nav grup Sistem; BPMJ/KOMISI/SUPERADMIN): tab profil gereja (nama, tagline, deskripsi, alamat, maps share + query, email/telepon/WA), sosial (IG/FB/TikTok/YouTube), jadwal dinamis; serta kontak/sosial per unit.
- **Hub** (`ChurchHub.tsx`): kontak/jadwal/sosial dari profil, blok **BPMJ** dari `/api/org/public-tree` (nama+jabatan, slot kosong "terbuka"), map dari profil, GMIM+GEHC di header/footer.
- **Media slot** `brand.logoGmim` (`brand/logo-gmim.png`, transparan) untuk watermark hub; fallback aman bila belum diunggah.
- Verifikasi: lint bersih, 297 test hijau, build OK; `GET /api/church-profile` & `/api/tenants` prod 200; hub tampil BPMJ.
- **Manual:** unggah `brand/logo-gmim.png` ke Drive (izin GMIM); klaim Google Business Profile agar nama di Maps bagus; isi sosial/email lewat panel.

### Next
1. Isi kontak/sosial gereja & unit lewat panel Info Gereja.
2. Unggah logo GMIM transparan ke slot `brand/logo-gmim`.
3. Klaim/rapikan Google Business Profile gereja; isi `mapEmbedQuery`.

### Commands
```
npm run db:seed:tenants:staging
npm run db:schema:check:prod
npm run lint && npm run test
```

---

## Prior — Hub gehc.page + multi-unit (pool) subdomain + registrasi sadar-asal (12 Sep 2026)

**Goal:** `gehc.page` jadi hub gereja (bukan redirect), unit disajikan per-subdomain English dari satu repo/DB, registrasi mengikuti host.

**Done:**
- **Hub `gehc.page`** (`src/components/hub/ChurchHub.tsx`): direktori unit (Pemuda aktif → `youth.gehc.page`; lain coming soon), info ibadah/lokasi, tombol Masuk Portal. `src/lib/host-context.ts` allowlist hub; `src/main.tsx` memilih hub / app Pemuda / coming soon via `React.lazy`.
- **Coming soon** (`UnitComingSoon.tsx`) untuk `teen/kids/men/women/districts/community.gehc.page`.
- **Redirect Vercel:** apex `gehc.page` di-clear (serve hub), `www.gehc.page` → 308 `gehc.page`. `gehcpage.vercel.app` & staging tetap portal Pemuda (fallback).
- **Subdomain baru:** `teen/kids/men/women/districts/community.gehc.page` → CNAME Cloudflare (DNS-only) + `vercel domains add`; semua 200.
- **Skema (migrasi `_migrate-host-tenancy.cjs`, lokal+staging+prod):** `users.bipra` nullable, `users.registration_origin`, `tenants.default_bipra`, `tenants.registration_open`; backfill `registration_origin='youth'` (108 staging / 101 prod).
- **Registrasi sadar-host** (`server/lib/host-context.mjs`): `register/{google,local}`, `loginWithGoogleCredential`, `upsertGoogleUser` memakai konteks host — hub → `bipra=null` + tanpa role unit; unit → `bipra` unit + role unit.
- **Tenant English** (`INITIAL_TENANTS`, `seed-tenants.ts` + `db:seed:tenants[:staging|:prod]`): `tenant-youth/teen/kids/men/women/community/districts`; legacy `tenant-bapak/ibu/rekreasi/teritorial` dihapus (tak terpakai).
- **Trust proxy** sudah aktif dari episode sebelumnya → OAuth `redirect_uri` https.
- Verifikasi: lint bersih, 297 test hijau (7 baru `host-context`), build OK, `db:schema:check` staging+prod hijau.
- **Sisa (Fase 3b/3c):** threading `'tenant-youth'` → tenant per-host di konten/nav masih bertahap (belum ada pembaca aktif karena hanya `youth` yang aktif); login terpadu dari hub masih tombol → `youth.gehc.page`.

### Next
1. Google Cloud Console: tambah origin `https://youth.gehc.page` + redirect `.../api/auth/google/callback`; tambahkan bila unit lain diaktifkan.
2. Daftar ulang passkey `#/admin` di `youth.gehc.page`.
3. Saat mengaktifkan unit (mis. Teen): set `Tenant.isActive`/`registrationOpen`, bangun panel unit, lalu threading tenantId.

### Commands
```
npm run db:seed:tenants:staging   # atau :prod
npm run db:schema:check:prod
npm run lint && npm run test
```

---

## Prior — Migrasi domain resmi: gehc.page / youth.gehc.page (12 Sep 2026)

**Goal:** Domain resmi `gehc.page` (Cloudflare) + portal pindah ke `youth.gehc.page`; apex/www redirect; siap Workspace.

**Done:**
- Beli `gehc.page` via Cloudflare Registrar (zone aktif; NS coleman/serenity). DNS dikelola via helper baru `scripts/cloudflare-dns.mjs` (`npm run dns:list` / `dns:upsert` / `dns:zones`); `CF_API_TOKEN` + `CF_ZONE_NAME` di `.env`, zone id `0b8e679f2669dcc7097256dd4a700665`.
- Vercel project `gehc.page`: `youth.gehc.page` (Production), `gehc.page`, `www.gehc.page` terpasang & `configured-correctly`.
- Cloudflare DNS (DNS-only, TTL 300): CNAME `youth`/`@`/`www` → `8e88b9e05f2e1e25.vercel-dns-017.com`.
- Redirect domain Vercel: `gehc.page` + `www.gehc.page` → **308** `https://youth.gehc.page` (via `vercel api PATCH`). Terverifikasi `curl -I` 308; `youth.gehc.page` 200.
- Env Vercel Production: `APP_URL=https://youth.gehc.page`, `CORS_ORIGIN=https://youth.gehc.page,https://gehcpage.vercel.app`, `WEBAUTHN_ORIGIN=https://youth.gehc.page`, `WEBAUTHN_RP_ID=gehc.page`. Redeploy Production OK.
- Fix: `app.set('trust proxy', 1)` (`server/createApp.mjs`) — sebelumnya `req.protocol` selalu `http` di Vercel sehingga redirect_uri OAuth salah; kini `https://youth.gehc.page/api/auth/google/callback`.
- Pesan kamera di `EventCheckInTab.tsx` → `youth.gehc.page`. Smoke API prod (`/api/auth/config`, `/api/version`, `/api/config`, `/api/content/public`) semua 200, DB production.
- Verifikasi: lint bersih, 290 test hijau, build OK.
- `gehcpage.vercel.app` sengaja tetap hidup (QR/landing lama) — tidak bisa di-redirect (domain Vercel).

### Next (manual, di luar CLI)
1. Google Cloud Console → OAuth Web client: tambah origin `https://youth.gehc.page` + redirect `https://youth.gehc.page/api/auth/google/callback` (jangan hapus yang lama selama transisi).
2. Daftar ulang passkey `#/admin` di `https://youth.gehc.page` (passkey lama terikat `gehcpage.vercel.app`).
3. Uji login Google + QR check-in di domain baru.
4. Google Workspace jalur Nonprofit + Shared Drive (fase berikut).

### Commands
```
npm run dns:list
npm run lint && npm run test
vercel domains verify youth.gehc.page --format=json
```

---

## Prior — Didaskalia Studio: AI 7 Path + PDF (Modul/RHB/Khotbah) + Jadwal & Meet (12 Sep 2026)

**Goal:** Panel Didaskalia untuk menyusun materi mingguan dengan bantuan AI, diskusi internal, lalu generate PDF (Modul Pembekalan 01, Ringkasan Khotbah 02, RHB 7 hari 03) langsung ke Drive, plus jadwal ritual mingguan dengan link Google Meet tetap.

**Done:**
- Server AI `server/lib/didaskalia-ai.mjs` (reuse `ai-provider.mjs` = OpenAI + Groq): draf 7 Path, ringkasan khotbah + kerangka slide, refine. Katalog metode homiletika (ekspositori, tematik/sistematik, naratif, historis-redemptif, analisis kata, komparatif, problem-solution, induktif) meniru pola Ringkasan W1 "The Church Begins Here".
- Route `server/routes/didaskalia-studio.mjs` (terdaftar di `server/index.mjs`): GET/PATCH studio per (bulan, minggu); AI `draft`/`sermon`/`refine`; `publish` (versi + hash + file Drive); `ritual-links` (ChannelLink `DIDASKALIA_RITUAL`); `schedule` generate/read; ICS per ritual. RBAC: baca semua auth, tulis SUPERADMIN/KOMISI/COMMITTEE.
- Penyimpanan MVP tanpa migrasi: field `studio` di dalam `MinistryMonthPlan.weeks[]` (chapter, fundamentalFirman, kitabFokus, 7 path + pertanyaan bertingkat, sermon + slide, diskusi, ritual, render per-dokumen).
- UI `src/components/portal/DidaskaliaStudioPanel.tsx` + tab **Studio** di Panel Divisi Didaskalia (`DivisionWorkspacePanel`): editor 7 Path, editor ringkasan + slide, diskusi internal, tombol AI, generate/unduh/unggah PDF, tab **Jadwal & Meet**.
- PDF `src/lib/didaskaliaPdf.ts` (jsPDF, brand GEHC): Modul Pembekalan, Ringkasan Khotbah slide-style, dan **RHB 7 file harian terpisah**; unggah ke subfolder 01/02/03 via endpoint upload yang sudah ada; versi + `contentHash` untuk badge "belum rilis ulang".
- Jadwal ritual sesuai pola hari: Internal Sync (Senin/Selasa), Serving Group Briefing (Rabu/Kamis, hanya minggu Serving), General Equipping (Jumat/Sabtu); tombol Join/Salin Meet + `.ics`.
- Verifikasi: `npm run lint` bersih, 285 + 5 test baru hijau, `vite build` OK, smoke route 401 (terdaftar & RBAC aktif).

**Next:**
- Uji di staging: susun draf AI, sunting, generate 3 PDF, cek Drive 01/02/03; isi 3 link Meet; generate jadwal.
- Sambungkan gambar tema (slot Drive `panca/didaskalia/...`) ke cover/Path begitu aset siap.
- Opsional: tambah `RHB`/`SERMON` ke `KINDS` deliverable; upgrade Meet ke persisten/Calendar.

**Commands:**
```
npm run dev:all
npm run lint
npm run test
```

---

## Prior — Hotfix prod 500 + sinkron DB/Drive + push VAPID (11 Sep 2026)

**Done:**
- **Prod 500 FUNCTION_INVOCATION_FAILED** (semua `/api/*` mati, login/portal tidak muncul): akar = `server/lib/service-events.mjs` kehilangan export `formatServiceNameByType`/`servicePrefixByType`/`sundayWIBInstant` akibat merge paralel, sedangkan `server/routes/ministry-plans.mjs` mengimpornya → serverless crash saat import. Export dipulihkan; prod sehat (`/api/config`, `/api/auth/*`, `/api/content/public`, `/api/db/struktur` → 200).
- `/api/push/config` + alias `/api/push/subscribe` dipulihkan (clobbered oleh merge).
- **VAPID**: generate keypair valid + set `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` di `.env*` + Vercel Production & Preview. `/api/push/config` prod mengembalikan key 65-byte valid (sebelumnya fallback SPKI invalid → push selalu gagal).
- **TiDB**: `db:migrate:local:prod` — perbaikan collation `serving_assignments` (`event_id` ikut `EventProgram.id` = utf8mb4_bin + FK best-effort) → tabel + FKs dibuat; `monitoring_records.{event_id,week_index,year_month,season}`, `group_albums.status`, `service_week_overrides`, `service_swap_requests`. Staging + prod `db:schema:check` hijau.
- **Data**: `struktur_members`/`role_assignments` DIDASKALIA → `Kurikulum`.
- **Drive**: Didaskalia prod & staging = `Kurikulum` + trashed legacy (`Kurikulum Pemuridan`, `Pembekalan Tim`, `Main Speaker`, `Modul & Kurikulum`); `drive:provision` staging/prod 0 gagal.
- **Jemaat**: filter Beyonders strict (assignment aktif + grup) + sub-tab grup memfilter (`src/lib/jemaat-filter.ts`).
- **Upload Drive RHB/Pembekalan/Ringkasan**: gate tulis kini sadar-token (`driveWriteEnabled()` = `GDRIVE_WRITE=1` **atau** token OAuth pemilik) di `server/index.mjs` (upload/delete/auto-provision) + `server/routes/didaskalia-rhb.mjs`. `GDRIVE_WRITE=1` di-set di `.env.staging`/`.env.production` + Vercel Production/Preview.
- **Drive token**: service account tidak punya kuota upload (root bukan Shared Drive) → re-consent pemilik via `npm run drive:auth`, token valid disimpan, di-sync ke Vercel Production+Preview (`GDRIVE_USER_REFRESH_TOKEN`).
- Verifikasi: lint bersih, 285 test hijau, build OK.

### Next
- Uji upload nyata di Panel Divisi → Didaskalia (01/02/03) setelah deploy terbaru.
- Uji push di Android/iOS dari PWA terinstal.

---

## Prior — Registrasi netral + BIPRA gate + pipeline & Beyonders murni (10 Sep 2026)

**Done:**
- Registrasi akun baru tidak lagi auto-cap BAKU TAU (`sourceEvent=null`); `claimWaitingPoolByPhone` tidak menimpa `sourceEvent` bila sudah terisi (memperbaiki bias Undangan→BAKU).
- BIPRA gate BAKU TAU (403 untuk non-PEMUDA kecuali `forceBipra` Komisi) + statistik pecah `pemudaRegistered/withAccount/nonPemudaRegistered` + seluruh pipeline tetap biarkan BAKU sebagai satu-satunya penulis `sourceEvent='BAKU TAU 4.0'`.
- Onboarding Pipeline: filter `originKind` (Undangan/Daftar sendiri/Event/Counter/Manual) + badge "Peran, profil belum lengkap" (role+!profileCompleted) + chip warna.
- Youth Jemaat: `isIndividuExplicit` (flag eksplisit KOMISI) + label Legacy→"Belum ditempatkan" + angka Beyonders murni (hanya `PEMUDA` + `isBeyonders||BeyonderRole` tanpa explicit, abaikan legacy) + wizard toggle Individu + enforcement `bipra!=PEMUDA → isBeyonders=false` + catatan arsitektur multi-domain.
- Repair 1 baris lokal BAKU TAU yang tercap salah (null) — dry-run 1→0, executed.
- Verifikasi: `lint` bersih, `273` test hijau, `db:migrate:local` + `db:schema:check` hijau (is_individu_explicit termigrasi).

### Next
- Komisi coba: toggle Individu di Jemaat (PEMUDA), generate Beyonders → pastikan tidak masuk; filter pipeline OriginKind; daftar non-Pemuda ke BAKU → 403; stats BAKU pecah.
- Repair prod (reuse `_repair-baku-source.cjs` dengan `--dry-run` dulu).

---

## Prior — Ultah Senin–Minggu WIB + ucapan HUT (9 Sep 2026)

**Jawaban batasan minggu:** sebelumnya jendela geser 7 hari dihitung UTC (bisa salah sehari 00–07 WIB). Kini Senin–Minggu berjalan dalam WIB; label jujur di dashboard; 29 Feb → 28 Feb non-kabisat.
**Notifikasi:** cron harian kirim `BIRTHDAY_WISH` ke user + digest Komisi (dedupe harian); bell existing.
**Panel caption (Jemaat → Ucapan HUT, Komisi):** teks `{nama}`/`{umur}` + foto URL + pratinjau; tabel `birthday_settings`.
**Tampilan:** kartu ucapan hari-H di dashboard + banner Akun Saya ("dari GMIM Eben Haezer Cikarang"); landing tak disentuh.
**Verifikasi:** lint bersih, 273 test hijau (9 baru), migrasi + schema check hijau. Tanpa sisa manual selain QA.
**Deploy 9 Sep:** staging `cf9bfdc` → merge main `eeb9dbc` → push dua-duanya; enum + tabel prod termigrasi; smoke prod (BAKU TAU ACTIVE, 45 pendaftar utuh).

---

## Prior — Cover wajib publik + perbaiki langsung Echad (9 Sep 2026)

**Akar (fakta prod):** file cover ada & tidak di-trash, tapi permission hanya owner/writer — thumbnail lh3 butuh publik. Ukuran bukan masalah (maks 8MB, dikompres server).
**Fix kode:** upload/sync mempublikkan file saat jadi cover (`setPublicReader`).
**Fix langsung:** file cover Bonding Echad dipublikkan manual (verified HTTP 200 image/jpeg).
**Verifikasi:** lint bersih, 264 test hijau. Tanpa migrasi DB.

---

## Prior — Auto-cover album + UI jujur (9 Sep 2026)

**Sebab cover kosong:** thumbnail lh3 hanya hidup bila file ada + publik; hapus file di Drive = penunjuk mati (sync membersihkan dengan benar).
**Fix:** sync/upload jadikan foto pertama cover bila kosong; onError fallback + status "belum ada foto" vs "cover rusak"; preview mati disembunyikan.
**Timing:** tombol Sinkron sinkron detik-an; thumbnail file BARU Google buat menit-an; landing instan (DB-driven).
**Verifikasi:** lint bersih, 264 test hijau. Tanpa migrasi DB.

---

## Prior — Album refresh + hapus folder/foto (9 Sep 2026, staging)

**Masalah:** hapus file di Drive tak mengubah portal/landing (portal baca baris DB + thumbnail file-ID).
**Fix:** `POST .../albums/sync` (cek folder, hitung foto, bersihkan preview mati), `DELETE .../albums/:id` (DB + folder ke sampah, mentor/komisi), `DELETE .../photos/:fileId` (anggota rumah, validasi milik album). UI: tombol Sinkronkan Drive, sampah per album, X per foto, badge folder-hilang.
**Verifikasi:** lint bersih, 264 test hijau. Tanpa migrasi DB.

---

## Prior — Token fail-safe + kartu deploy; staging & main sinkron (9 Sep 2026)

**Temuan:** probe `Gagal probe EROFS` ternyata BUKAN token mati — token env valid, tapi listener refresh mencoba tulis file di FS read-only Vercel. `saveTokens`/`loadSavedTokens` kini fail-safe (token tetap dipakai dari memori/env).
**Commit staging `fca84fd` → merge main `991ddfc`:** kartu Sinkronisasi & Deploy (banding commit GitHub + redeploy via hook + penjelasan env-butuh-redeploy), `GET /api/version`, `POST /api/admin/redeploy`.
**Smoke:** staging `/api/version` = fca84fd; prod = 991ddfc. Tanpa migrasi DB (hanya kode).
**Sisa manual:** buat Deploy Hook di Vercel (Settings → Git → Deploy Hooks, branch main) + pasang `VERCEL_DEPLOY_HOOK_URL` sebagai env Production agar tombol redeploy aktif; pantau BAKU TAU 12 Sep.

---

## Prior — Monitoring persist + kunci grup + album ramah (9 Sep 2026, prod)

## Prior — MERGED putaran 3 + staging & prod hijau (9 Sep 2026)

**Merge:** staging (3 commit: monitoring / drive / notif) → main, konflik HANDOFF digabung. Push main OK → Production + Preview Ready.
**DB:** enum `APPROVAL_ITEM` + `DRIVE_DRIFT` termigrasi lokal+staging+prod; schema check hijau semua.
**Smoke prod:** BAKU TAU ACTIVE + 36 pendaftar (tumbuh, utuh); cron digest terjaga (403); staging 3 commit live.
**Sisa:** passkey prod; re-auth Drive + sync token (manual); pantau BAKU TAU 12 Sep; cron pertama 01:00 UTC.

---

## Prior — Merge putaran 3: monitoring persist, album ramah, approval instan, drift (9 Sep 2026)

### Done (staging, ikut merge ini — 3 commit)

- **Monitoring persist** (`a8c885a`): `GET/POST/DELETE /api/monitoring` + sinkron context + `roleMissing` gate + kunci grup (tanpa default grup pertama) + hapus assignment yatim Holly.
- **Drive** (`f402b2d`): album ramah (`drivePending`), kartu status token + `/api/drive/token-status`, audit extract `lib/drive-audit.mjs`, cron `/api/cron/digest`, kartu Peringatan admin, runbook §7b.
- **Notif** (`a61a1a0`): enum `APPROVAL_ITEM` + `DRIVE_DRIFT`, helper dedupe, 8 hook antrean, bell.
- **Verifikasi:** lint bersih, 49 file / 264 test hijau; enum termigrasi lokal+staging.

---

## Prior — QR multi-event per (user, event) (8 Sep 2026)

## Prior — MERGED putaran 1 + prod hijau (8 Sep 2026)

- DB prod termigrasi (`subject_name`, `deliverable event_id` + FK, `request show_if`, `content event_id`); schema check hijau; tanpa `prisma migrate deploy`/seed.
- Env prod terverifikasi; smoke prod hijau (35 pendaftar utuh).
- Rollback putaran 1: `git revert -m 1 9566a71` + push main.

## Prior — MERGED putaran 2 + staging & prod hijau (9 Sep 2026)

**Merge:** staging `d250efa` → main `e91dd22` (konflik HANDOFF saja, digabung). Push main OK → Production Ready.
**DB:** enum `EVENT_ARCHIVED` termigrasi lokal+staging+prod; schema check hijau semua.
**Smoke staging:** landing 3 lapis jalan (BAKU TAU full + W2 full + W1/W3/W4 kompak).
**Smoke prod:** BAKU TAU ACTIVE + 35 pendaftar utuh; landing full BAKU TAU; cron 403 tanpa secret (terjaga).
**⚠️ Temuan staging:** konten W2 ikut centang `is_featured_event` → bisa menggeser BAKU TAU dari hero (find pertama). Uncheck unggulan W2 di Konten publik.
**Sisa:** `npx prisma generate` lokal (terkunci saat dev jalan); passkey prod; pantau BAKU TAU 12 Sep; cron jalan otomatis 01:00 UTC.

---

## Prior — Merge putaran 2: generate ibadah, landing 3 lapis, hapus event, daftar generik, QR multi-event, cron (8 Sep 2026)

### Done (staging `d250efa`, ikut merge ini)

- **Generate ibadah:** `POST /api/ministry-plans/:ym/generate-services` + UI Rencana bulan + 7 unit test.
- **Auto-draft konten:** `POST /api/events` buat draf; backfill yatim; banner pengingat; banner wajib hanya saat Terbit.
- **Landing 3 lapis:** `GET /api/events/landing` + `EventsTimeline` + badge hari-H WIB.
- **Hapus event:** `DELETE /api/events/:id` blokir-bila-ada-data + tombol UI.
- **Daftar generik:** `register`/`claim`/`my-registration` + `EventSignupPage` + stats gabungan + walk-in per event.
- **QR multi-event:** `GEHC-EA` attendee + scanner fallback + `registrationCodeFor`; BAKU TAU frozen.
- **Cron lifecycle:** DONE H+1 / ARCHIVED H+7 + notifikasi `EVENT_ARCHIVED`; `CRON_SECRET` di Vercel Production.
- **Verifikasi:** lint bersih, 47 file / 252 test hijau; enum `EVENT_ARCHIVED` termigrasi lokal.

---

## Prior — Konten agenda by-event di Program & Event (8 Sep 2026)

### Done

- **Satu pola:** `content_items.event_id` (migrasi 33 + backfill `cnt-bakutau` → `evt-baku-tau-4-0`); Kelola Agenda Kegiatan kini hanya menampilkan agenda lepas + banner penunjuk ke event.
- **Blok Konten publik** di detail event (`EventPublicContentBlock`): judul, tagline, kategori (dropdown tetap 7 opsi), banner (dropdown slot Drive + URL kustom + pratinjau), deskripsi opsional, unggulan, terbit. Tanggal & tempat read-only dari event (sumber tunggal, tanpa duplikat isian). Tulis: Komisi/Superadmin atau anggota divisi MARTURIA event itu (`GET/PUT /api/events/:id/content` + `canEdit`).
- **Sinkron state:** `upsertContentItem` di context — simpan dari event langsung menyegarkan landing + panel agenda.

### Next

1. Restart API + `npx prisma generate` (kolom baru), refresh, cek: buka BAKU TAU → Konten publik terisi dari `cnt-bakutau`; Kelola Agenda tidak lagi menampilkan BAKU TAU.
2. ~~Staging: `db:migrate:staging` + deploy~~ — **done 8 Sep**: commit `843d9cc` push ke `origin/staging`; `.env.staging` = DB yang sama dengan lokal → `db:migrate:local:staging` + `db:schema:check:staging` hijau. Tanpa `prisma migrate deploy` (riwayat CJS sumber tunggal).

### Commands

```
npm run db:migrate:local
npx prisma generate
npm run lint
npm run test
```

---

## Prior — Guard syarat-vs-API-lama + auto-sembunyi arsip (8 Sep 2026)

### Done

- **Bukti DB lokal:** `eqb-berapa_baik.show_if = NULL` — syarat tak pernah tersimpan karena API `:8787` masih kode lama (tanpa watch, PATCH lama buang `showIf` tapi tetap 200). Evaluasi showIf-nya sendiri benar.
- **Guard anti-diam:** `saveEdit`/`submitRequest` membandingkan syarat terkirim vs tersimpan; bila beda → toast merah "Syarat TIDAK tersimpan (API lama)" + perintah restart. Berlaku untuk semua field showIf ke depan.
- **Arsip default sembunyi:** list bank hanya soal aktif + toggle "Tampilkan N soal arsip"; Simpan soal membuang ID arsip basi dari payload; picker syarat hanya berisi soal aktif.

### Next

1. WAJIB restart API lokal: stop `dev:all` → `npx prisma generate` → `npm run dev:all` → refresh. Lalu pasang ulang syarat "Berapa baik?" (A atau B = B).
2. Staging: deploy + migrasi seperti biasa.

### Commands

```
npx prisma generate
npm run dev:all
npm run lint
npm run test
```

---

## Prior — Fix soal arsip "undead" + hapus permanen (8 Sep 2026)

### Done

- **Akar error `Soal eqb-… tidak ditemukan`:** soal ARCHIVED masih punya assignment di event → form operator tetap menampilkannya → submit jawaban 400. Kini `GET /api/events/:id/questions` menyembunyikan soal ARCHIVED untuk semua peran; arsip via DELETE ikut menonaktifkan assignment-nya.
- **Hapus permanen:** `DELETE /api/event-questions/bank/:id?force=1` (Komisi) menghapus soal + assignment + jawaban; UI baris arsip dapat tombol **Aktifkan** (PATCH ACTIVE) dan sampah force-delete (ketik HAPUS). Checkbox baris arsip disabled.
- **Pesan error jelas:** submit jawaban soal arsip menyebut labelnya ("…sudah diarsip — aktifkan lagi atau lepas dari event dulu"); Simpan soal menyebut label + status soal bermasalah.

### Next

1. Di lokal: revive (`Aktifkan`) atau hapus permanen baris arsip "Bekerja atau Kuliah", lalu Simpan soal ulang.
2. Staging: deploy kode saja (tanpa migrasi baru).

### Commands

```
npm run lint
npm run test
```

---

## Prior — Gelar inti bisa edit/hapus + testimoni foto & kutipan penuh (8 Sep 2026)

### Done

- **Katalog gelar:** singkatan gelar inti (Pdt/Pnt/Dkn/Kr) bisa diubah via PATCH (profil aman — tersimpan sebagai kode PDT/…); hapus gelar inti dibuka dengan konfirmasi ketik singkatan persis; tiap chip gelar (pelayanan + akademis) kini ada pensil (singkatan + nama ID/EN) dan sampah.
- **Kesaksian:** publish membuat foto inbox Drive publik (thumbnail tampil di landing); `userId` testimoni divalidasi harus `usr-…` (400 jelas, bukan gagal diam-diam); modal sunting ada pratinjau foto + toast sukses/gagal; bubble landing ada fallback foto rusak + tombol Selengkapnya/Tutup (jeda rotasi saat dibaca).

### Next

1. Cek lokal: Katalog → Gelar (ubah Pdt, hapus dengan ketik); Kesaksian → terbitkan ulang item berfoto; landing kolase foto + Selengkapnya.
2. Staging: migrasi tidak perlu (tanpa perubahan schema); deploy kode saja.

### Commands

```
npm run lint
npm run test
```

---

## Prior — Portal nine fixes (8 Sep 2026)

**Goal:** 9 perbaikan portal: Drive resilient + kesaksian, Portal Doa search + nama manual, roster nyata, hapus katalog, CRUD soal event, editor Warta, Rencana → Event, search event divisi.

### Done

- **Drive + Kesaksian:** `isDriveAuthError()` + pesan ID (`gdrive-user-oauth.mjs`); `wrap()` hormati `err.status`; `DriveUploadButton` prop `onClear` + tombol X; kesaksian POST/PATCH tetap simpan draf bila Drive gagal (`photoPending` + toast).
- **Portal Doa:** `SearchableSelect` + chip (ganti pill inline); `/api/pastoral-care/people` tidak exclude diri + cari `given/middle/familyName`; `subjectUserId` nullable + `subjectName` (migrasi 31 `_migrate-pastoral-subject-name.cjs`); toast bila nama/catatan kosong.
- **Roster kelompok:** AppContext stop baris sintetis `${batch}-mentor/comentor/m{n}`; roster = `group_members` ACTIVE, dedupe `userId` lalu nama+peran; Tambah/Ubah/Hapus lewat API baru `POST/PATCH/DELETE /api/groups/:id/members[/:memberId]` (mentor rumah/komisi, revoke peran ikut bersih); badge hero = jumlah terdaftar; tab pakai `ScrollTabBar`; baris tanpa akun disembunyikan (superadmin toggle + hapus orphan ketik nama via `ConfirmationModal`).
- **Katalog:** `DELETE /api/recreational/:id` (blokir bila dipakai/ada anak) + `PATCH/DELETE /api/institutions/:id`; chip minat = klik arsip + pensil rename + sampah hapus; kampus di hasil cari ada pensil + sampah.
- **Soal event:** `PATCH/DELETE /api/event-questions/bank/:id` (soft `ARCHIVED` bila sudah ada jawaban/assignment, hard delete bila belum); tipe baru `SHORT_TEXT/LONG_TEXT/BOOLEAN/DROPDOWN/SINGLE/MULTI/DATE/NUMBER` (alias `TEXT`/`SELECT` dinormalisasi); kolom `type` → VARCHAR(24); renderer + form request + edit/hapus bank di `EventQuestionsBlock`.
- **Warta:** hapus duplikat `PATCH /api/warta/:id` (dead code); `syncWartaToContentItem` susun body dari `ayat/khotbah/pengumuman/pelayanan/sharing/doa`; editor field terstruktur + pratinjau kartu; tombol export/Share2 mengaktifkan `WartaExportModal`; status APPROVED/PUBLISHED + skip langkah hanya Komisi/Superadmin.
- **Rencana → Event:** `MinistryWeekDeliverable.eventId` (migrasi 32 `_migrate-deliverable-event.cjs`, FK SET NULL); `POST .../deliverables/:id/share` (buat `EventProgram` PLANNING baru atau tautkan + aktifkan divisi pemilik); badge "dari Rencana bulan" di Event Tim Kerja + ringkasan read-only di Panel Divisi; `GET /api/events/:id/deliverables`.
- **Panel divisi:** `<select>` → input cari + chip (tanpa `ARCHIVED`, urut ACTIVE/PLANNING/DONE); `GET /api/events?status=` opsional.
- **Tes:** `drive-auth-error`, `event-question-types`, `warta-body` (13 test baru). Total: 44 file / 226 test hijau; `lint` bersih; `db:schema:check` hijau (lokal termigrasi penuh + Prisma client baru).

### Next

1. `npm run dev:all` → cek browser: Doa cari+manual, kesaksian tanpa/dengan foto, cover Agape, minat hapus, soal edit/hapus, simpan warta field biasa, bagikan modul Didaskalia, cari event tanpa arsip, tab kelompok mobile.
2. Staging: `npm run db:migrate:local:staging` (atau `db:migrate:staging`) + `db:schema:check:staging` — kolom `subject_name`, `event_id` (+FK), `type` VARCHAR(24).
3. `INVALID_GRANT` di staging/prod: `npm run drive:auth` + `npm run env:sync-gdrive-token` (kode sekarang graceful, tapi token tetap perlu diperbarui).

### Commands

```
npm run db:migrate:local
npm run db:schema:check
npm run lint
npm run test
```

---

## Prior — Katalog gelar + Edit Profil admin (7 Sep 2026)

**Goal:** Admin mengedit nama+gelar di Jemaat, dan Katalog punya tab Gelar (pelayanan + akademis) yang bisa ditambah/arsip/hapus plus antrian saran manual.

### Done

- Edit Profil / Tambah Jemaat memakai `PersonNameFields`.
- Katalog tab **Gelar**: antrian, tambah, arsip, hapus (Pdt/Pnt/Dkn/Kr terkunci).
- Gelar manual di form langsung dipakai; saran masuk antrian katalog.
- Tabel `title_catalog` + `title_suggestions`; seed dari daftar bawaan.

### Next

1. Staging: Katalog → Gelar; Jemaat → Edit Profil (Pdt Meyke Poluan S.Th., M.Pd.,).
2. Katalog lain (mis. hobi di luar Sports/Arts) nanti, jangan dicampur ke gelar.

### Commands

```
npm run db:migrate:local
npm run lint
npm run test
```

---

## Prior — Nama terstruktur + gelar (7 Sep 2026)

**Goal:** Form lengkapi profil memakai nama depan/tengah/belakang (Title Case), gelar jabatan gereja, dan gelar akademis searchable (ID/EN + manual).

### Done

- `users.given_name / middle_name / family_name / church_title / academic_titles`
- Preview: `Pdt Meyke Poluan S.Th., M.Pd.,`
- Form: onboarding, **Ajukan perubahan** (setelah ACTIVE, Komisi setujui), daftar email.
- API menambah kolom otomatis di request pertama jika belum ada (idempotent).
- CJS: `server/_migrate-person-name.cjs` (juga lewat `npm run db:migrate:local`).

### Next

1. Cek staging/prod: Akun Saya → Ajukan perubahan → isi Pdt + nama + S.Th./M.Pd. → Komisi setujui di Jemaat.
2. Onboarding WAITING_POOL: Identitas & data gereja (langsung simpan, tanpa antrean Komisi).

### Commands

```
npm run db:migrate:local
npm run db:migrate:local:staging
npm run db:schema:check:staging
```

---

## Prior — Hapus dummy Quick Register (7 Sep 2026)

**Goal:** Komisi bisa menghapus baris counter dummy di Onboarding → Quick Register, dengan konfirmasi ketik nama/WA seperti hapus akun di Orang.

### Done

- Counter panitia tetap ada (hari H tanpa Google).
- `DELETE /api/waiting-pool/:id` hanya untuk status `REGISTERED` tanpa `userId`.
- Modal konfirmasi di tab Quick Register.

### Next

1. Login Komisi → Onboarding → Quick Register → Hapus (ketik nama atau nomor WA).
2. Akun Google / undangan tetap dihapus di Orang → Semua Akun.

### Commands

```
npm run lint
npm run test
```

---

## Prior — Daftar pendaftar BAKU TAU 4.0 (7 Sep 2026)

**Goal:** Panitia Tim Kerja melihat list lengkap pendaftar BAKU TAU (angka QR “peserta terdaftar”), bukan hanya 9 akun Google di “Kehadiran Event”.

### Done

- QR publik menghitung **waiting pool** `sourceEvent = BAKU TAU 4.0` (counter + akun).
- Program & Event → BAKU TAU sekarang **Pendaftar Event** dari waiting pool, dengan filter Semua / Punya akun / Counter + CSV.
- `GET /api/events/:slug/registrations` (+ `/export`) untuk KOMISI, COMMITTEE, BPMJ.

### Next

1. Login Tim Kerja Koinonia → Program & Event → BAKU TAU 4.0: angka harus sama dengan halaman QR.
2. Komisi tetap bisa lihat split pipeline di Onboarding (Quick Register / menunggu profil / role).

### Commands

```
npm run lint
npm run test
```

---

## Prior — WhatsApp view-only + Kesaksian mentee (5 Sep 2026)

**Goal:** Tautan grup WA hanya ditulis Admin/BPMJ/Komisi/Tim Kerja BOD di Kanal WhatsApp; mentor/mentee/staf divisi hanya membuka tautan di panel mereka. Kesaksian ditulis mentee; Marturia mengkurasi.

### Done

- Nav `wa-channels` hanya penulis (`isBodTimkerja` dari `GET /api/auth/me`). PUT/DELETE tidak lagi untuk mentor.
- `GET /api/channel-links/scoped` + kartu buka grup di Monitoring dan Panel Divisi.
- Panel mentee **Kesaksian**; Profil hanya tautan. Tab Marturia **Kesaksian & Story** = kurasi (tanpa Testimoni Baru). Kelola Testimoni Komisi-only.

### Next

1. Cek demo: Komisi/BOD isi tautan di Kanal → muncul di monitoring + ringkasan divisi; mentor/mentee hanya tombol buka.
2. Mentee kirim draf → tab Marturia review / Pakai posting → Komisi terbitkan.

### Commands

```
npm run lint
npm run test
```

---

## Prior — Production group_batches schema catch-up (5 Sep 2026)

**Goal:** Undangan mentor di People tidak error Prisma `group_batches.mentor_user_id`.

### Done

- Production TiDB: `group_batches.generation`, `mentor_user_id`, `comentor_user_id`, `regen_ready` + tabel `user_avatars`.
- Backfill Generasi 0 (`2026-06`) untuk 10 rumah Beyonders.
- Staging sudah sinkron sebelumnya; kode sudah di `staging`/`main` — tidak ada perubahan aplikasi.

### Next

1. Refresh `#/portal/superadmin/people` di `gehcpage.vercel.app` — undangan Mentor Dunamis tidak boleh alert Prisma.
2. Panel Pemimpin 10 Rumah: nama landing vs `user_roles` tidak mismatch setelah assign.

### Commands

```
npm run db:schema:check:prod
npx dotenv -e .env.production -- node server/_migrate-beyonders-generation.cjs
npx dotenv -e .env.production -- node server/_migrate-user-avatar-blobs.cjs
```

---

## Prior — SUPERADMIN sees all portal panels (5 Sep 2026)

**Goal:** Akun superadmin (`tech@gehc.demo`) bisa membuka setiap panel gereja di sidebar portal untuk inspeksi — bukan hanya menu Komisi.

### Done

- `buildPortalNavItems('SUPERADMIN')` tidak lagi dipetakan ke KOMISI; seluruh `BASE_NAV` tampil (warta, agenda, struktur, dashboard, Pemimpin 10 Rumah, …).
- `#/admin` tetap shell platform (passkey, grant, audit).

### Next

1. Login `tech@gehc.demo` → sidebar harus berisi Warta, Struktur, Pemimpin 10 Rumah.
2. Deploy `staging` / `main` jika mau live.

---

## Prior — Info Event production (5 Sep 2026)

**Goal:** Halaman Info Event (`#/portal/mentee/event-info`) tidak error Prisma `archive_folder_id`.

### Done

- Production: `archive_folder_id` + kolom Drive ownership lain ditambahkan (CJS idempotent).
- Info Event / API publik BAKU TAU memakai `findEventProgramPublic` (select kolom venue/WA saja, catch jika schema lag).
- SQL `27_drive_ownership` dilengkapi `ALTER` EventProgram/testimonials/orders.

### Next

1. Deploy Vercel `main` agar query select ikut ke production (DB sudah cukup untuk error sekarang).
2. `npm run db:migrate:local:prod` untuk sisa: `user_avatars` + generasi Beyonders (butuh persetujuan).
3. Refresh Info Event di `gehcpage.vercel.app` — QR/WA harus tampil.

### Commands

```
npx dotenv -e .env.production -- node scripts/check-db-schema.mjs
npm run test
```

---

## Prior — Pemimpin 10 Rumah / generasi Retreat (5 Sep 2026)

**Goal:** Nama Mentor/Co di landing Beyonders dikelola di panel sendiri. Generasi 0 = kohort Retreat `2026-06` (bukan bulan daftar akun). Cabut peran mengosongkan nama landing.

### Done

- Panel **Pemimpin 10 Rumah** (`#/portal/.../beyonders-leaders`): Komisi sunting nama/periode; Tim Kerja tandai siap; Komisi buka generasi berikutnya untuk 10 rumah sekaligus (`updateMany` + `createMany`, tanpa loop Prisma).
- `group_batches`: `generation`, `mentor_user_id`, `comentor_user_id`, `regen_ready`. Backfill periode `2026-06`.
- `revokeRoleAssignment` membersihkan nama batch berjalan. `ensureCurrentBatch` tidak lagi memakai bulan hari ini.
- Panduan panel: monitoring, Jethro, media, dashboard, struktur, Jemaat, Review Penempatan — dipisahkan dari generasi Retreat.

### Next

1. `npm run db:migrate:local` (lalu `:staging` / `:prod` dengan persetujuan) agar kolom generasi ada.
2. Deploy Vercel `staging` + `main`.
3. Cek: cabut mentor simulasi → landing tidak menyimpan nama lama; panel Pemimpin 10 Rumah.

### Commands

```
npm run db:migrate:local
npm run db:schema:check
npm run lint
npm run test
```

---

## Prior — Drive ownership: portal GET/POST (5 Sep 2026)

**Goal:** Drive = lemari; TiDB = indeks. Portal menulis stem publik (dual-write) + folder operasional dengan ACL per aset.

### Done

- Registry ACL `server/lib/drive-ownership.mjs` + `POST /api/media/slots/:folder/:stem`, cover kelompok, album `Foto Kegiatan`, arsip acara, BZP produk/bukti TF, draf kesaksian, Portal Doa.
- Slot `panca/` di landing + ganti cover dari Panel Divisi. Event Gallery deprecated → Marturia Arsip Acara (`#/gallery`).
- Kalender pemuda berlapis; strip HUT (nama + avatar, bukan tanggal lengkap); mentor GET kalender gereja.
- Migrasi `27_drive_ownership`; `npm run env:sync-gdrive-token` (token OAuth sama staging/prod).

### Next

1. Redeploy Vercel Production agar token Drive pemilik dipakai unggah.
2. `npx prisma generate` setelah stop `npm run dev` (DLL terkunci saat server jalan).
3. Cek: cover rumah (mentor), `#/gallery`, dashboard HUT+kalender, Portal Doa, bukti TF BZP.

### Commands

```
npm run env:sync-gdrive-token
npm run db:migrate:local
npm run db:schema:check
npm run drive:provision
npm run lint
npm run test
```

---

## Prior — Profile photo without Drive token (4 Sep 2026)

**Goal:** Jemaat bisa ganti foto profil di production meski `GDRIVE_USER_REFRESH_TOKEN` kosong.

### Done

- Unggah foto tidak lagi gagal jika token Drive pemilik tidak ada.
- Foto kustom disimpan di tabel `user_avatars` dan dilayani `GET /api/media/user-avatar/:userId`.
- Cadangan: data URL di kolom `users.avatar` jika tabel belum dimigrasi.
- Drive tetap opsional (sync folder visual) bila token tersedia.

### Next

1. `npm run db:migrate:local` (staging/local) lalu `npm run db:migrate:local:prod` dengan persetujuan — buat tabel `user_avatars`.
2. Deploy Vercel `staging` + `main`.
3. Cek Portal → Profil → ganti foto (tanpa error token Drive).

---

## Prior — Invite provision + temp-password gate (4 Sep 2026)

**Goal:** Bulk undangan per-orang (dropdown seperti individu) + password sementara tidak bisa dikosongkan.

### Done

- Wizard bulk: baris per orang (role/grup/slot + nama), copy-all mengingatkan salin hanya blok nama sendiri.
- `POST /api/me/password` wajib password sementara jika akun sudah punya hash. Modal ganti password tidak lagi menampilkan taut Google.
- Password seragam default `GEHCikarang`.

### Next

1. Deploy Vercel `staging` + `main`.
2. Cek provision bulk: tambah baris, password seragam GEHCikarang, gerbang ganti password menolak field kosong.

---

## Prior — Katalog Minat & Kampus + reminder (4 Sep 2026)

**Goal:** Komisi kelola katalog default minat + PT Indonesia. Request “Lainnya” dipetakan ke 1 opsi lalu reminder — jemaat memilih sendiri.

### Done

- Panel **Katalog Minat & Kampus** (nav Komunitas). Setujui tidak auto-centang; map + reminder (`CATALOG_REMINDER`).
- `GET /api/institutions` wajib `q` (min 2 huruf) atau `id` — tidak dump seluruh tabel.
- Seed katalog PT Indonesia (PDDIKTI: Universitas/Institut/Politeknik/Sekolah Tinggi) + minat recreational.
- Kampus luar negeri hanya lewat request.

### Next

1. Deploy Vercel `staging` + `main` (schema + seed TiDB sudah dijalankan).
2. `npx prisma generate` jika client lokal masih terkunci (dev server).
3. Cek panel Katalog: minat 43+ chip, kampus searchable; profil Lainnya + reminder.

---

## Prior — Church org domains + hide system users (4 Sep 2026)

**Goal:** Domain jabatan = Jemaat (BPMJ) → BIPRA → Kolom. `@platform.ops` bukan jemaat.

### Done

- Seed: BPMJ pindah `YOUTH` → `CHURCH`; domain `BIPRA` (Penatua per kategorial; Pemuda menyarang pohon Komisi).
- Picker Assign Role / provision: Jemaat → BIPRA → Kolom (default Jemaat). BPMJ tidak lagi cabang Pemuda.
- `accountKind: SYSTEM_LEGACY` untuk `usr-platform-ops`. `/api/jemaat` dan `/api/db/users` mengecualikan akun sistem.
- Seed org-tree sudah dijalankan di **staging** dan **prod** TiDB (CHURCH=7 · BIPRA=10 · YOUTH=59 · KOLOM=21).

### Next

1. Tunggu deploy Vercel `staging` + `main` (kode sudah di-push).
2. Cek picker Assign Role: Jemaat → BIPRA → Kolom; BPMJ di Jemaat; Komisi di BIPRA → Pemuda.

---

## Prior — Delete duplicate portal accounts (4 Sep 2026)

**Goal:** Orang & Undangan bisa menghapus akun duplikat (provision berulang) dengan form konfirmasi.

### Done

- `DELETE /api/people/:id` (Komisi / Superadmin / platform admin): ketik username/email/nama; akun Google tertaut wajib ketik `HAPUS`.
- Blokir hapus diri sendiri, `usr-platform-ops`, dan `SYSTEM_LEGACY`.
- Tab Semua Akun menampilkan `@username` + status taut Google + tombol Hapus.

### Next

1. Deploy `staging` + `main`.
2. Di prod: hapus baris Alvandi **tanpa** Google tertaut; sisakan akun LINKED (`usr-81dcba…`).

---

## Prior — Platform Admin opens portal Superadmin picker (4 Sep 2026)

**Goal:** Grant di `#/admin` Platform Admins ikut membuka picker **Pilih ruang kerja** (Superadmin + peran jemaat yang sudah ada), bukan hanya `#/admin`.

### Done

- Grant `platform_admin_grants` dual-write `UserRole.SUPERADMIN` (note `platform_admin_grant`), tanpa mengubah onboarding.
- Sesi Google/lokal + `attachPlatformContext` menghidrasi SUPERADMIN untuk grant yang sudah ada (tidak perlu revoke-regrant).
- Cabut grant hanya melepas Superadmin bertanda grant, bukan slot Komisi/Tim Kerja terpisah.
- Navbar HP: tombol Admin tidak lagi `hidden sm:block`; ada di drawer.
- Copy panel Platform Admins menjelaskan picker portal.

### Next

1. Deploy `staging` + `main`.
2. Akun yang sudah di-grant (mis. aisaerang): refresh / login Google ulang → `#/portal` harus menampilkan Superadmin + Mentee.
3. Slot Komisi / Tim Kerja tetap di Jemaat → Assign Role jika memang jabatan gereja.

---

## Prior — Admin provision parity staging/prod (4 Sep 2026)

**Goal:** `#/admin` Orang & Provision jalan di production seperti staging: schema `users` lengkap, 10 rumah Beyonders, operator boleh baca pohon jabatan.

### Done

- CJS `_migrate-user-prisma-parity.cjs` — kolom User Prisma (`onboarding_status`, `is_beyonders`, emergency, `account_kind`, …).
- `GET /api/org/nodes` + assignments untuk platform operator/admin (`#/admin`).
- `resolveAssignedByUserId` — FK `assignedBy` memakai `usr-platform-ops`, bukan id operator.
- Seed `db:seed:beyonders-houses` (cangkang `grp-1`…`grp-10`, tanpa nama anggota).
- **Staging TiDB:** schema hijau; rumah `grp-1`…`grp-10` plus grup retreat lama; org YOUTH=66 · KOLOM=21.
- **Prod TiDB:** 9 kolom User ditambah termasuk `onboarding_status`; 10 rumah kosong; org YOUTH=66 · KOLOM=21; 0 user jemaat; schema hijau.
- Migrasi `platform_operators` CJS tidak lagi `DROP TABLE` (akun break-glass tetap). `npm run operator:ensure:prod` hanya membuat email yang hilang.
- Prod cluster ketinggalan `role_assignments` + `user_roles.assignment_id`; CJS `_migrate-role-assignments.cjs` sudah dijalankan di prod (staging sudah punya). Koneksi Vercel Production = cluster prod, Preview = branch staging.
- Schema prod diselaraskan ke branch staging (`npm run db:schema:sync-from-staging:apply`): 12 tabel + kolom `role_assignments.familyRole` (Prisma camelCase) dan waitlist/waiting_pool. Tidak ada DROP.
- `#/admin` Platform Admins: picker jemaat (nama/username/email), bukan ketik `usr-...`.

### Next

1. Deploy kode ke `staging` + `main` (Vercel) — tanpa itu picker slot tetap 401 di prod.
2. `#/admin` → Orang & Provision → Beyonders (pilih `grp-1`…`grp-10`) atau staf (pilih slot).
3. Daftar passkey prod.

---

## Prior — Org tree prod + schema catch-up (4 Sep 2026)

**Goal:** Slot Assign Role / undangan Komisi-Tim Kerja hidup di production. Pohon `org_nodes` di-seed ke TiDB prod (bukan akun demo). Kolom `struktur_members.role` yang bikin `/api/db/struktur` gagal ikut di-migrate.

### Done

- CJS `_migrate-struktur-multirole.cjs` + `db:seed:org-tree` / `:staging` / `:prod`.
- Prod TiDB `gehc`: schema check hijau; `struktur_members.role` ditambah; `org_nodes` YOUTH=66 · KOLOM=21.
- Go-live: seed pohon jabatan setelah migrate; jangan seed `@gehc.demo`.

### Next

1. Login `#/admin` → Orang & Provision → undang Ketua Komisi / Tim Kerja (username + password, pilih slot).
2. Assign Role di portal setelah orang login — dropdown cabang/posisi harus terisi.
3. Login `#/admin` break-glass → daftar passkey di `https://gehcpage.vercel.app`.
4. Google Cloud Console: origin + redirect `https://gehcpage.vercel.app`.

---

## Prior — Production go-live (4 Sep 2026)

**Goal:** Vercel Production (`main` → `https://gehcpage.vercel.app`) hidup dengan TiDB/Drive/operator terpisah dari staging.

### Done

- Merge `staging` → `main` (`a8297bf`); Vercel Production Ready.
- Env Production: APP_URL/CORS `gehcpage.vercel.app`, `GEHC_ENV=production`, Drive root YOUTH GEHC (bukan staging), `DATABASE_URL_PRODUCTION`, operator/WebAuthn secrets; `SUPERADMIN_EMAILS` & `WEBAUTHN_MOCK` tidak di-set.
- TiDB `gehc`: schema check hijau, 46 entri kalender gerejawi, BAKU TAU 4.0 ACTIVE + venue + WA, 0 user `@gehc.demo`.
- 2 Platform Operator (`#/admin`): `superadmin@gehc.page`, `admin@gehc.page` — tabel sempat kosong di TiDB prod (bukan reset oleh git push); di-bootstrap ulang 4 Sep sore. Passkey belum. Password vault lokal `.env.operator-breakglass.local` (gitignore).
- Drive prod di-provision; `Website Visual [PUBLIK]` di-replace dari staging (`npm run drive:copy-visuals:staging-to-prod` — 28 file, 0 gagal). Seed Unsplash di prod tertimpa.
- Publish visual: workflow pilih Drive menurut branch. Secret GitHub `GDRIVE_ROOT_FOLDER_ID_PRODUCTION` sudah di-set; `GDRIVE_ROOT_FOLDER_ID` staging tidak diubah. Portal prod default ke `main`. `GITHUB_PUBLISH_*` sudah ada di Vercel Preview + Production.

### Next (BAKU TAU — 12 Sep)

1. Login `#/admin` break-glass → daftar passkey (Windows Hello / Face ID / YubiKey) di `https://gehcpage.vercel.app` — passkey staging tidak berlaku.
2. Google Cloud Console: origin + redirect `https://gehcpage.vercel.app` (dan `/api/auth/google/callback`) — env client ID sudah di Vercel.
3. Komisi: centang paket soal BAKU TAU 4.0 di Program & Event.
4. Portal → Review Penempatan → generate ulang batch (skor Gift Diversity lama masih salah).
5. Dry-run scanner + QR asli: scan, walk-in, void, export CSV.
6. Setelah BPMJ konfirmasi tanggal: isi Pengucapan Syukur (Cikarang) & HUT WKI di Kalender gerejawi.

### Deferred

- Folder Drive lain (Warta Publik, Event Gallery, `[GROUP:…]`) belum disalin staging → prod.
- STG-05 portal foto kelompok (setelah desain + ACL) — Drive `[GROUP:…]` + gallery publik sudah ada.
- Broadcast lintas role — jangan panel paralel Warta; extend tipe `Notification` hanya jika Warta + WA tidak cukup.
- Auto-upload CSV check-in ke Drive & auto-seri folder ibadah (setelah Liturgia minta).
- Migrasi scoping Drive off `struktur_members` → Org (prasyarat deprecate ManageStruktur).
- Tech debt: split `server/index.mjs` → `server/routes/*`, full `AuthContext`, design tokens, coverage `roles.ts` / `profile-fields.mjs`.

---

## Prior — Bank soal event + form depan tipis (3 Sep 2026)

**Goal:** Counter hanya nama+WA lalu Google. Profil (asal/Sulut, domisili, gender) di Info Event. Soal event opsional (panitia + self-serve). WA grup peserta hanya dari Edit event.

### Done

- Migrasi 25: `event_question_bank` + requests + assignments + answers; seed katalog (jemaat, moda, kost, konsumsi, dll. — tanpa soal Sulut).
- API soal event + CSV `asalRegion`/`asalPlace` dari `User.origin`.
- Form `#/event/bakutau` tipis; register auth/guest tanpa wajib asal/gender.
- Program & Event: checklist soal, isi jawaban atas nama, CSV. Info Event: lengkapi profil + data panitia.
- Kanal WA layer Event read-only; DELETE ChannelLink EVENT mengosongkan `EventProgram.whatsappGroupUrl`.

### Coba ulang

```powershell
npm run db:migrate:local
npm run lint
npm run test -- tests/unit/event-questions.test.ts tests/unit/origin-parse.test.ts
npm run dev:all
```

1. Logout → `#/event/bakutau` → nama+WA atau Google → konfirmasi daftar → QR.
2. Portal → Info Event → lengkapi asal (Sulut muncul dari dropdown asal) + soal panitia jika Tim Kerja sudah centang.
3. Program & Event → Edit WA → kartu hijau. Centang 2 soal → isi dari daftar peserta → unduh CSV (kolom `asalRegion`).
4. Kanal WhatsApp → Event: tidak ada tombol Simpan.

---

## Prior — Alur daftar BAKU TAU + reset regs (3 Sep 2026)

**Goal:** Setelah Google login, kehadiran menempel; QR (bukan QRIS) + WA tampil di halaman event dan portal Info Event. Bisa daftar ulang dari nol.

### Done

- Halaman `#/event/bakutau`: sinkron pending setelah login, tidak flash form; payload register langsung isi QR/WA.
- Tamu: dua jalur jelas (akun/Google vs counter panitia). Form login-in prefill dari profil.
- `resolveEventInfo` fallback ChannelLink jika kolom WA event kosong.
- Kartu welcome: placeholder QR, tautan portal Info Event, copy “bukan QRIS”.
- `npm run db:reset:bakutau-regs` — hapus kehadiran/scan, lepas `source_event`, akun tetap.

### Coba ulang

```powershell
npm run db:reset:bakutau-regs
# jika uji di staging:
npm run db:reset:bakutau-regs:staging
npm run dev:all
```

1. Logout. Buka `#/event/bakutau`.
2. **Punya akun / Google** → masuk → isi asal/domisili sekali → harus muncul QR + tombol WA (jika tautan sudah di Edit event).
3. Portal → **Info Event** — kartu yang sama.

Pastikan WA tersimpan: Program & Event → Edit → `https://chat.whatsapp.com/...`

---

## Prior — Info Event QR/WA untuk semua peserta (3 Sep 2026)

**Goal:** QR daftar ulang + link WA BAKU TAU tetap terlihat setelah onboarding selesai (bukan hanya WAITING_POOL).

### Done

- Nav **Info Event** tidak lagi `onboardingOnly` — muncul untuk semua peran gereja (MENTEE…BPMJ/SUPERADMIN via KOMISI).
- `GET /api/me/baku-tau-registration` memakai lookup tangguh (`findBakutauPoolEntry`) + `buildCheckInCode`; register/claim mengembalikan `checkInCode` + WA.
- `EventInfoPanel`: refresh, copy jelas, lokasi publik tetap tampil sebelum daftar.
- Unit test `tests/unit/portal-nav-event-info.test.ts`; parity docs diperbarui.

### Commands

```powershell
npm run lint; npm run test -- tests/unit/portal-nav-event-info.test.ts tests/unit/event-venue.test.ts tests/unit/check-in-code.test.ts
npm run dev:all
```

---

## Prior — Form edit event: label + WA + venue jelas (3 Sep 2026)

**Goal:** Form Edit Program & Event tidak lagi “tebak field”; WA & venue punya konteks UI yang proper.

### Done

- Form Edit: label + icon + hint per field (meta, rentang program, WA, waktu & tempat).
- WA field: “Grup WhatsApp peserta” + hint sinkron ke halaman daftar BAKU TAU, kartu portal, dan WA Channels.
- Venue: bedakan nama tempat / catatan lokasi / tautan Maps / query embed; hint agar tidak mengulang jam.
- Fallback `locationDetail` BAKU TAU: `Cikarang, Bekasi` (bukan nama+jam). Migrasi idempotent menormalisasi nilai lama di DB.

### Commands

```powershell
npm run db:migrate:local            # normalisasi location_detail lama
npm run lint; npm run test
npm run dev:all
```

---

## Prior — Venue event di DB + form edit (3 Sep 2026)

**Goal:** Tanggal dan tempat BAKU TAU (dan event publik lain) hidup di `EventProgram`, bisa diedit dari portal, konstanta hanya fallback.

### Done

- Migrasi 24: `event_date`, `venue_name`, `location_detail`, `map_url`, `map_embed_query` di `EventProgram`. Backfill BAKU TAU lewat `Date` dari `2026-09-12T15:00:00+07:00` (= `2026-09-12T08:00:00.000Z`), bukan string wall-clock yang terbaca 22:00 WIB.
- Welcome Night `EventMeeting.scheduled_at` dikoreksi ke instant yang sama. Script lama `_migrate-bakutau-venue.cjs` tidak lagi menimpa jam ke 15:00 naif.
- `GET /api/events/bakutau` dan payload publik memakai `venueOf()`: DB dulu, konstanta jika kolom kosong (rollback tanpa redeploy).
- `PATCH /api/events/:id` menerima field venue; `GET` by-id mengembalikan `canEdit`. Form **Edit** di Program & Event (WIB `datetime-local`). Rentang `startDate`/`endDate` tetap program tahunan, terpisah dari hari pelaksanaan.
- `content_items` `cnt-bakutau` diselaraskan dari EventProgram saat migrasi dan saat PATCH venue.
- Unit test zona waktu + `venueOf` di `tests/unit/event-venue.test.ts`.

### Commands

```powershell
npm run db:migrate:local            # termasuk migrasi 24
npm run db:schema:check
npm run lint; npm run test
npm run dev:all
```

---

## Prior — Kalender gerejawi + pengerasan check-in (3 Sep 2026)

**Goal:** Kunci jalur check-in sebelum BAKU TAU 12 Sep, lalu ubah "payung gerejawi" yang tanpa tanggal jadi kalender gerejawi bertanggal yang menggerakkan runbook H-21 → H+7 dan timeline publik.

### Done — Fase 0 (pengerasan hari H)

- `scripts/check-db-schema.mjs` kini menutup migrasi 21: 5 tabel baru, kolom check-in `waiting_pool` / `event_attendees`, dan `EventProgram.kind` / `church_program_id`. Sebelumnya `db:schema:check` hijau padahal scanner akan gagal.
- Drift migrasi 21 ditutup: semua `ALTER TABLE` masuk `migration.sql` (sebelumnya hanya ada di CJS), plus index `EventProgram_church_program_idx` yang **hilang di kedua tempat** dan sekarang benar-benar terbuat.
- Statistik check-in dihitung via `groupBy` di DB, bukan dari 500 scan terpotong (dulu breakdown diam-diam mengecil setelah 500 scan). Daftar scan dipaginasi (`?limit=`, `?cursor=`, default 100).
- **Batalkan scan**: `POST /api/events/:slug/check-in/:scanId/void` menulis baris `VOIDED` (audit utuh) dan mengosongkan `eventCheckedInAt` / `checkedInAt`. Tombol di tab Check-in.
- Walk-in tidak lagi memuat seluruh `waiting_pool`: cocokkan varian nomor lewat `phone IN (...)`, fallback pindaian terbatas.
- Export CSV pindah ke server (`GET /api/events/:slug/check-ins/export`) — seluruh riwayat, bukan halaman yang tampil.
- Route shadowing `GET /api/events/:slug`: `:id` sekarang `next()` bila id tidak cocok, jadi kedua bentuk respons tetap hidup (naif memindah urutan justru merusak lookup by-id).

### Done — Fase 1–4 (kalender & bersih-bersih)

- `ChurchCalendarEntry` + migrasi 22; `server/lib/church-year.mjs` menghitung Paskah (Computus) dan seluruh turunannya, tanggal tetap GMIM, serta HUT Jemaat GEHC (23 Mar 2019). 23 unit test.
- Seeder `db:seed:church-calendar` — 46 entri untuk 2026–2027, idempotent, satu statement `ON DUPLICATE KEY UPDATE`.
- Tab **Kalender gerejawi** (Program & Event) dengan tampilan 12 bulan, badge sumber/musim, toggle publik, dan **penanda bentrokan tanggal**.
- Runbook H-21 → H+7 dari RACI: `POST /api/church-calendar/:id/generate-runbook` → `MinistryWeekDeliverable` (lintas bulan), notifikasi `RUNBOOK_DUE` ke pemegang peran divisi.
- `defaultWeeks()` memakai hari Minggu sebenarnya (4–5 baris); dulu dipaku ke tanggal 7/14/21/28 yang tidak pernah hari Minggu.
- `church-programs`: PATCH/DELETE + filter `tenantId` (dulu create-only dan tidak ter-scope).
- Section publik **Kalender Gerejawi** di tab Kegiatan + countdown hari raya berikutnya, label ID/EN.
- Dihapus 5 komponen orphan: `OnboardingGatePortal`, `AIRegenerationDistributor`, `GroupRegenerationCreator`, `MentorTransitionManager`, `AddressPlacesPicker`.
- Nama pengguna menggantikan user id mentah di Panel Divisi & diskusi event. Loop `findUnique` per author diganti satu `findMany` (anti-pattern TiDB).
- Nav: `pwa-settings` dilepas dari sidebar (sudah ada di Akun Saya → Notifikasi); override nav SUPERADMIN yang tidak pernah berefek dihapus.

### Commands

```powershell
npm run db:migrate:local            # termasuk migrasi 22 + RUNBOOK_DUE
npm run db:seed:church-calendar
npm run db:schema:check
npm run lint; npm run test
npm run dev:all
```

---

## Fix — bentuk data gift (3 Sep 2026)

**Gejala:** `#/portal/superadmin/jethro-placement` crash dengan React error #31 (`object with keys {key, label, score}`).

**Akar masalah:** gift test menyimpan `giftsTop5` sebagai `{ key, label, score }` ([`src/data/giftBank.ts`](src/data/giftBank.ts)), tapi `normalizeGiftKey` di server melewatkan non-string apa adanya. Objeknya lalu dipakai sebagai property key di [`server/engine.mjs`](server/engine.mjs) dan ter-coerce jadi `"[object Object]"`, sehingga `giftCoverage` selalu 0 dan `globalFreq` selalu 1 — **skor Gift Diversity selalu 100%**. Jadi bukan hanya crash render, rekomendasi penempatan Jethro ikut salah.

Ketidakcocokan kedua: `giftCoverage` kelompok dibangun dari data mentah sementara gift newcomer dipetakan ke nama Inggris, jadi `BELAS_KASIH` tidak pernah cocok dengan `Mercy` — berlaku juga untuk data lama berbentuk string.

### Done

- `normalizeGiftKey` membuka bentuk objek (`key` → fallback `label`) lalu memetakan ke nama kanonik.
- `giftCoverage` di `engine.mjs` dinormalisasi, jadi kedua sisi perbandingan memakai kunci yang sama.
- [`src/lib/gifts.ts`](src/lib/gifts.ts) — `normalizeGifts` / `giftLabels` bersama; dipakai `JethroPlacementReview` (2 titik render) dan `ProfileGiftsSection` (menggantikan salinan lokal).
- Tipe `giftsTop5` / `newcomerGiftsTop5` dikoreksi dari `string[]` (yang menyembunyikan bug ini dari `tsc`) menjadi `unknown`.
- Test: `tests/unit/gift-normalize.test.ts`, `tests/unit/gifts.test.ts`.

---

## Prior — Division ops + check-in (Sep 2026)

**Goal:** Scanner hari H di Koinonia, kanal WhatsApp (tautan saja), auto-provision folder event Drive, schema payung gerejawi.

### Done

- Tab **Check-in** di Panel Divisi → Koinonia (`EventCheckInTab`)
- API `POST/GET /api/events/:slug/check-in` + walk-in; parse `GEHC-BT|{poolId}|{ms}`
- Panel **Kanal WhatsApp** + `ChannelLink` CRUD (lapis permanen vs event)
- Program & Event: payung `ChurchProgram`, buat event operasional (kind + WA + divisi), grid `MinistryMonthPlan`
- `server/gdrive-events.mjs` — folder `[EV:<slug>:<DIV>]` + subfolder template (termasuk Koinonia `Check-in/`)

### Commands

```powershell
npm run db:migrate:local
npm run test -- tests/unit/check-in-code.test.ts
npm run dev:all
```

---

## Staging QA — review teman (2 Sep 2026)

**Goal:** Kerjakan temuan PDF di `docs/staging/` (accordion, countdown, hover peran, Our People, QR hari H, popup assign, notifikasi role).

### Done

- Tracker: [`docs/staging/2026-09-02-review-teman.md`](docs/staging/2026-09-02-review-teman.md)
- STG-01, 02, 03, 04, 06, 07, 08
- STG-05 (folder foto kelompok) — lihat **Deferred** di atas

### Commands

```powershell
npm run db:migrate:local
npm run db:generate
npm run dev:all
```

---

## Platform Operator RBAC (Episode — platform admin split)

**Goal:** Pisahkan operator bootstrap (`#/admin`) dari jemaat; passkey + break-glass; platform admin grant.

### Done

- Prisma: `PlatformOperator`, `PlatformAdminGrant`, `PlatformAuditLog`, `User.accountKind`
- `server/platform-auth.mjs`, `server/lib/platform-rbac.mjs`, `server/routes/operator.mjs`
- `#/admin` shell (`AdminLayout`, `OperatorLogin`, `PlatformAdminsPanel`)
- Endpoint audit: `/api/admin/*` → `requirePlatformAdmin` / `requirePlatformRoot`
- Docs: [`docs/tech/platform-operator.md`](docs/tech/platform-operator.md)

### Commands

```powershell
npm run db:migrate:platform-operators
npm run db:generate
npm run db:seed:operator:staging
npm run operator:bootstrap:prod   # production once
npm run test -- tests/unit/platform-rbac.test.ts
npx playwright test tests/e2e/admin-shell.spec.ts
```

---

## Current priority — Panca Tugas v2 restructure

**Goal:** 20 sub-divisi (5 pillar + BZP), HoD per panca tugas, BZP tanpa HoD (Fladyna → Penggalangan Dana), label ID/EN, runbook operasional.

### Done

- [`docs/product/pancatugas-operating-model.md`](docs/product/pancatugas-operating-model.md) — RACI + runbook H-21→H+7
- [`src/lib/pantatugas.ts`](src/lib/pantatugas.ts) — SUB_DIVISIONS v2 + migration map
- [`src/data/initialData.ts`](src/data/initialData.ts) — struktur seed dengan HoD + open roles
- [`src/components/public/StrukturSection.tsx`](src/components/public/StrukturSection.tsx) — HoD block + badge rekrutmen
- `server/seed-org-tree.ts` — slot Kepala Divisi per pillar
- `server/migrate-pancatugas-subdivisions.cjs` + `npm run db:migrate:pancatugas`

### Commands (apply to staging DB + Drive)

```powershell
npm run db:migrate:pancatugas
npm run db:seed-users:staging
npm run db:seed:org-tree:staging
npm run drive:provision
# Portal → Integrasi → Audit Sinkronisasi Drive
npm run test -- tests/unit/pantatugas.test.ts
```

---

## Prior — Drive visual + logo (staging + prod)

**Goal:** Slot visual publik (termasuk logo GEHC) di Google One, stem tetap. SA baca; unggah via OAuth. Staging dan production punya root Drive terpisah.

### Done

- Folder `Website Visual [PUBLIK]` + subfolder `brand/` di `drive-provision`
- Slot `brand/logo-gehc` → Navbar, Footer, PortalLogin, PortalLayout
- `npm run drive:auth` + `drive:seed-visuals` (staging) + `drive:seed-visuals:prod`
- `GET /api/media/slots` lookup by filename (bukan urutan Event Gallery)
- Portal menyembunyikan tag zona `[MENTOR]` dll.; ACL tetap di nama Drive
- Peta + pemilik aset: [`docs/product/website-visuals.md`](docs/product/website-visuals.md)

### Commands

```powershell
npm run drive:provision
npm run drive:auth
npm run drive:seed-visuals
npm run drive:seed-visuals:prod
npm run dev:all
```

Redirect OAuth: `http://127.0.0.1:8765/drive-auth/callback`. Token: `.gdrive-user-token.json`. Fallback: `npm run drive:seed-visuals:local` lalu seret ke Drive.

---

## Prior — Onboarding UX staging fixes

**Goal:** WA group CTA, portal terbatas saat onboarding, Google link fix, nama KTP langsung.

### Done

- Portal **terbatas** untuk `WAITING_POOL`: banner + tab Profil & Info Event
- `OnboardingBanner`, `EventInfoPanel`; WA CTA di event page + counter flow
- `POST /api/register/google` set `googleSub` + `LINKED`; backfill script
- Nama/BIPRA/kolom editable langsung saat onboarding (`PATCH /api/me/profile`)
- `WaitingPoolPanel`: kolom BIPRA/kolom + flag profil belum lengkap
- Env: `BAKU_TAU_WA_GROUP_URL` di `.env.example`

### Commands

```powershell
npm run db:migrate:local
npm run db:backfill:google-link    # user Google lama di staging
npm run dev:all
npm run test
```

**Staging:** set `BAKU_TAU_WA_GROUP_URL` di Vercel Environment Variables.

QRIS / event URL: `https://gehcpage.vercel.app/#/event/bakutau`

---

## Prior — Auth route split + EventAttendee

Placeholder — tidak dilanjutkan; tidak ada scope.

---

## Episode E10: BAKU TAU 4.0 + Org Hardening

**Goal:** Funnel pendaftaran cepat BAKU TAU, domisili preset, portal WA group CTA, fix join/onboarding blockers, revoke symmetry + backfill org.

### Done (E10)

- Hash routing fix (`#/join?inv=` / `?event=bakutau`)
- OAuth register → `WAITING_POOL` + claim quick register by phone
- BAKU TAU date **12 Sep 2026 15:00 WIB** (initialData, Countdown, i18n)
- API `/api/events/baku-tau-4-0/*` + domisili fields + `REGISTERED` status
- `JoinPage` quick form + live counter; `WaitingPoolPanel` filters + CSV
- `BakuTauWelcomeCard` di onboarding gate
- `revokeRoleAssignment` terpusat + `db:backfill:org-assignments`
- `OrgHierarchyPanel` metadata editor, assignee view, reorder
- Migrasi `db:migrate:e10-bakutau`

### Commands (E10)

```powershell
npm run db:migrate:e10-bakutau
npm run db:migrate:local
npm run db:seed:org-tree
npm run db:backfill:org-assignments
npm run dev:all
npm run test
```

Env opsional: `BAKU_TAU_WA_GROUP_URL=https://chat.whatsapp.com/...`

QRIS URL: `https://gehcpage.vercel.app/#/event/bakutau`

---

## Episode E9: Jemaat Org Hierarchy

**Goal:** Configurable org tree (`OrgNode`/`OrgAssignment`), tree-driven role wizard, simpatisan filter, Kolom leader slots.

### Done (E9)

- **E9a** — Prisma `OrgNode`, `OrgAssignment`, `User.membershipKind`; migration `14_org_hierarchy`; `db:migrate:org-hierarchy`; `seed-org-tree.ts`
- **E9b** — `server/routes/org.mjs`, `server/services/org-assign.mjs` (dual-write `RoleAssignment`), `tests/unit/org-assign.test.ts`
- **E9c** — `OrgHierarchyPanel.tsx` (Komisi nav tab)
- **E9d** — Tree-driven `RoleAssignmentWizard`; Jemaat simpatisan filter + kolom leaders from org assignments
- **E9e** — `userflow.md` §8, `pantatugas.md` §11, `rbac-admin.md` multi-domain model

### Commands (E9)

```powershell
npm run db:migrate:org-hierarchy
npm run db:seed:org-tree          # or db:seed:org-tree:staging
npm run dev:all
```

---

## Prior — Master Plan Episodes E0–E8

**Goal:** Repo hygiene, design tokens, modular API, unified onboarding, RBAC contract tests, client data layer, React Router bridge, Cursor rules, Jemaat RBAC, Drive upload.

### Done (Master Plan)

- **E0** — Dead portal components removed; `docs/` + `AGENTS.md`; CI workflow (lint + test + build)
- **E1** — Tailwind `@theme` tokens, UI primitives (`Button`/`Card`/`Modal`/`Badge`), PWA manifest `#/bulletin`, `font-display`, `animate-fade-in`
- **E2** — `createApp()` factory, `server/routes/admin.mjs` + `onboarding.mjs`, Vercel parity via `api/index.mjs` re-export
- **E3** — Google register → `WaitingPool`; waitlist UI retired; `userflow.md` §7 updated
- **E4** — `docs/tech/nav-api-parity.md`, `tests/e2e/portal-nav-roles.spec.ts`, `/api/admin/*` SUPERADMIN-only
- **E5** — `QueryProvider`, `usePortalQueries`, `useRoleFlags`, `AuthContext` scaffold
- **E6** — `HashRouter` bridge in `main.tsx`, shared `src/app/routes.ts`
- **Cursor** — `.cursor/rules/` (portal-rbac, server-api, design-tokens, prisma-migrations, testing)
- **E7** — Role admin via Jemaat + `docs/product/rbac-admin.md` (ManageUsersRBAC removed)
- **E8** — `DriveUploadPanel` wired in Integrations tab
- **DB** — `db:migrate:local`, `db:schema:check`, `docs/tech/database-migrations.md`, peringatan di `dev:all`

### Prior episode (committed `a3fc247`)

Portal rationalization + birthDate/BIPRA + role-scoped UX.

### Commands

```powershell
npm run db:migrate:local   # setelah clone/pull
npm run db:schema:check
npm run dev:all
```

Lihat [`docs/tech/database-migrations.md`](docs/tech/database-migrations.md).

### Key files

| File | Role |
|------|------|
| `scripts/db-migrate-local.mjs` | Migrasi TiDB lokal (aggregator) |
| `scripts/check-db-schema.mjs` | Cek drift schema |
| `docs/tech/database-migrations.md` | Panduan migrasi |
| `server/createApp.mjs` | Express factory |
| `server/routes/onboarding.mjs` | Waiting pool routes |

## Episode: Kegiatan hub + service scheduling + bonding (11 Sep 2026, branch cursor/kegiatan-service-hub)
Hub Kegiatan, Info Event per-event, Monitoring lock+tarik, album bonding, tab Ibadah Mingguan, antrean swap PAIR, gate BOD+Didaskalia, merge 10 grup. DB applied (status/overrides/swap tables + merge COMMIT OK). JANGAN reset/stash saat agen bekerja.
