# GEHC Portal — Handoff

## Current — Pola Didaskalia `CREATIVE_LAB` (Creative Lab, 21 Okt 2026)

**Minta:** tambah pola ibadah baru *Creative Lab* (`CREATIVE_LAB`) dari program
RUACH SERVING DAY: firman menjadi karya (Roots Reminder Jar, pot, tas), total
jemaat 105' + kru PRA 20' (baku 125'), Activity 2 berjalan paralel Tim Pot ∥
Tim Tas, dan jar ditulis manual (kertas) **dan** digital (1 juru digital per
kelompok mengetik 6 kartu ke web). Tanpa migrasi Prisma.

**Ubah:**
- `server/lib/session-stage.mjs`: `ACTIVITY_PHASES`/`ACTIVITY_PHASE_SECONDS`,
  `cleanActivity()`, `creativeLabFromDraft()` (trim nama kelompok), perluasan
  aditif `cleanTeams()` (`scribe`, `station`, `pot[]`, `bag[]`).
- `src/lib/session-engine.ts`: `PATTERN_SEGMENTS.CREATIVE_LAB` (7 segmen),
  `NOTE_SLOTS` 6 kartu + `KOMITMEN`, `SEGMENT_WIDGETS` (`activity`), tipe
  `ActivityProgress`, `segmentForPattern` mengikuti fase panggung.
- `src/lib/worship-session-draft.ts`: `CREATIVE_LAB_TEMPLATE` (8 section,
  63 field: briefing, jar, activity-1/2, groups 5×5, present, closing, lesson).
- `server/routes/worship.mjs`: `normalizeConfig` menyimpan `activity`; helper
  `CREATIVE_LAB_JAR`, `jarCards()`, `creativeLabBrief()`; payload peserta &
  layar mengirim `activity`/`activityBrief`/`jarCards`; `/stage` menerima
  `activity`; `apply-draft` materialisasi `teams` + `activity` + chip.
- `server/lib/didaskalia-ai.mjs`: `patternBlock` CREATIVE_LAB +
  `CREATIVE_LAB_RULES` (tidak mengarang nama `jar-*`/`group-*`).
- `server/_seed-worship-patterns.cjs`: `CREATIVE_LAB_PLAYBOOK` (7 bagian) +
  pola `CREATIVE_LAB` (125', PRA + 8 blok, paralel `a1`/`a2`, `sortOrder: 45`).
- UI: `ActivityPanel` (`StagePanels.tsx`: timer A1/A2/presentasi, next group,
  reset, durasi, toggle layar, navigator 6 kartu, papan kelompok); wiring
  `MentoringControl`; layar `MentoringScreen`; peserta `PatternDay` (header
  timer, widget `activity`/`teams`, welcome & chip Satu Kata).
- Docs: `worship-patterns.md` §7/§8/§9 + §12 (rundown, 6 kartu, state, QA),
  `integrasi-divisi.md` §2.6.
- Test: `tests/unit/creative-lab.test.ts` (9) + perluasan
  `session-engine`, `worship-session-draft`, `worship-patterns`.

**Verifikasi:** `node --check` 4 file server ✓; `tsc --noEmit` ✓;
`npm run test` → **157 files / 1242 tests passed** (termasuk 9 test Creative Lab).

**Deploy:** commit `feat(didaskalia): ...` → push batch `main`; lalu
`npm run db:seed:worship:staging` → QA staging → `:prod`.

## Current — Debat `DEBAT` penuh: 11 langkah bertimer + lembar juri + tim undian + Trap Reveal (19 Okt 2026)

**Minta:** naikkan pola Didaskalia "The Battle of Minds" (`DEBAT`) ke paritas
MONOLOG/BEDAH_FILM: mesin 11 langkah bertimer per ronde, lembar juri 4-kriteria
berbobot, editor tim PRO/KONTRA + undian H-1, dan alur kontrol hari-H
pola-spesifik ala FILM (D0–D2). Tanpa migrasi Prisma; RBAC tak berubah;
kompatibel mundur dengan sesi DEBAT lama.

**Ubah:**
- `server/lib/session-stage.mjs`: `ROUND_STEPS` (11 langkah, 3×240s+8×60s=1200s),
  `ROUND_STEP_SECONDS`, `JURY_CRITERIA`/`JURY_WEIGHTS`, `roundStepLabel()`,
  `jurySideScore()`; `cleanRounds()` diperluas (`step`, `stepStartedAt`,
  `stepSeconds`, `stepShowOnScreen`, `teams {pro,kontra}`, `trapReveal`, `jury[]`)
  dengan default aman untuk sesi lama.
- `src/lib/session-engine.ts`: konstanta klien paritas + `SEGMENT_WIDGETS.DEBAT`
  aktifkan widget `teams`.
- `src/lib/mentoring.ts`: tipe `JurySide`/`SessionJury`/`DebatTeam` + perluasan `SessionRounds`.
- `src/lib/worship-session-draft.ts`: `DEBAT_TEMPLATE` jadi 5 section (aturan, mosi,
  teams, juri, trap); `server/lib/didaskalia-ai.mjs`: aturan DEBAT (mosi dikotomi
  palsu + Trap Reveal merujuk firman) + `patternBlock` DEBAT diperkaya.
- `server/routes/worship.mjs`: `apply-draft` DEBAT materialisasi `config.rounds`
  (mosi → ronde, tim, juri awal, Trap Reveal).
- `StagePanels.tsx` `DebatPanel` (langkah+timer, lembar juri, tim, undi, Trap Reveal);
  `MentoringControl.tsx` tombol D0–D2 (Mulai Ronde 1 → Ronde Berikutnya → Trap Reveal);
  `MentoringScreen.tsx` + `PatternDay.tsx` tampilkan langkah/timer, kartu tim, skor, Trap Reveal.
- Docs: `worship-patterns.md`, `integrasi-divisi.md`, `pola-ibadah-hari-H.md`;
  test baru `tests/unit/debat-steps.test.ts` (8 lulus).

**Verifikasi:** `node --check` server ✓; `worship.test.ts` 24 ✓,
`debat-steps.test.ts` 8 ✓, `worship-session-draft.test.ts` 46 ✓; `tsc --noEmit`
hanya error lama milik sesi paralel (`session-engine.test.ts` — `mergeFilmVals`/`preOpen`),
tak ada dari perubahan episode ini.

**Deploy:** batch commit episode ini → push `main` (sesuai aturan batching).

## Current — Deck tamu English `#/welcome` (19 Okt 2026)

**Minta:** deck presentasi 3 slide (English) memperkenalkan GMIM Eben Haezer
Cikarang untuk tamu/misionaris: (1) GMIM gereja Injili yang fokus melayani
anak muda perantau di Cikarang (kawasan industri), (2) prioritas rumah
pemuridan kecil yang terus tumbuh & berlipat, (3) dokumentasi kegiatan +
rekreasi (sport & art).

**Ubah:**
- Data `src/data/visitorPitchSlides.ts` (English: cover + 3 slide + penutup) +
  wrapper `src/components/hub/PitchVisitors.tsx` (reuse `PitchDeck`).
- `PitchDeck.tsx`: kind `image` mendukung `images[]` → galeri grid (aditif;
  deck GEHC.page & Mentor tak berubah).
- `src/lib/host-context.ts`: `isVisitorPitchHash` (`#/welcome`); `src/main.tsx`:
  rute lazy `PitchVisitors` — identik di semua host (dipasang sebelum cabang
  hub/unit).
- `ChurchHub.tsx`: tautan "Guests · EN" → `#/welcome`.

**Verifikasi:** lint ✓ (hanya error lama `session-engine.test.ts` dari sesi
paralel); unit 1215/1217 lulus (2 gagal = sesi paralel session-engine);
`vite build` ✓ (chunk `PitchVisitors` teremit); QA browser
`localhost:4173/#/welcome` — 5 slide tampil, galeri slide 4 render dengan foto
nyata. URL: `https://gehc.page/#/welcome` (juga semua subdomain unit). Catatan:
foto "sport" belum ada aset khusus — sementara pakai foto kegiatan terdekat,
ganti dengan foto asli bila tersedia.

**Deploy:** batch commit ini → push `main`.

## Current — Penatalayan lanjutan: backfill eventId (staging+prod) + QA staging E2E + fix tipe notifikasi (18 Okt 2026)

**Minta:** tindak lanjut episode penatalayan — jalankan backfill eventId (script
baru), QA staging end-to-end (routing → usul → approve → jadwal), panduan pakai,
apply backfill staging + prod.

**Ubah:**
- Fix `scripts/backfill-penatalayan-event-link.mjs`: model `ServiceRoleRequest`
  tak punya relasi `serviceRole` → select ganti `serviceRoleId` + map nama via
  `prisma.serviceRole` (sebelumnya crash sebelum melapor); npm script baru
  `backfill:penatalayan-link:prod`.
- **Backfill terpasang**: staging & produksi — 10 jadwal 20 Sep → event
  `Follow the True Voice` (`linked=10`, `noEvent=0`); dry-run ulang kedua env
  `linked=0` / `Jadwal tanpa eventId: 0`.
- Fix kolateral notifikasi: mapping kategori `penatalayan` di
  `server/lib/notify.mjs` dari `IDLE_FLAG` → `APPROVAL_ITEM` (bell kini hanya
  ke penerima; sebelumnya semua user melihat notif routing & bocor ke dasbor
  regenerasi JethroEngine yang memfilter `IDLE_FLAG`). `CATEGORY_TO_TYPE`
  di-export + unit test di `tests/unit/notify.test.ts`.
- Docs: `docs/product/penatalayan-mingguan.md` §8 panduan pakai per peran +
  perintah backfill `:prod`.

**QA staging E2E (API + browser, DB staging):** login `stevania.hadinda@gehc.demo`
(KOMISI+MENTOR Agape) → PATCH `penatalayanGroups` event 25 Okt (Agape =
Penanggungjawab, Avodah = Tuan Rumah) → `POST /api/events/:id/penatalayan-routing`
— 4 penerima tepat (mentor & co-mentor tiap grup: Jurry/Syallomitha/Zhanon/Rendy),
`payload.href` deep-link benar, `metadata.penatalayanRoutingAt` terisi →
`proposals/bulk` dengan `eventId` → PENDING → `fulfill` → jadwal `SCHEDULED`
dengan `eventId` benar; deep-link di UI menampilkan banner “Mengisi untuk:
Ibadah Pemuda Raya: Our Roots & DNA - 25 Okt 2026”. Setelah fix tipe, notif
routing baru `APPROVAL_ITEM`, tidak tampil di bell user non-penerima; notif lama
`IDLE_FLAG` di-RESOLVED.
Catatan: `npx prisma generate` lokal dijalankan ulang (client stale —
`proposedUserId` tak dikenal); QA meninggalkan data staging (1 jadwal + 1 usulan
PENDING→FULFILLED Farly, 25 Okt). Sisa: cron Jumat/Sabtu (uji jadwal asli),
konfirmasi petugas (butuh akun petugas berpassword).

**Deploy:** batch commit ini → push `main` → `staging:sync` → verifikasi
`/api/version` prod & staging sama.

## Current — Penatalayan event: sinkron eventId + routing grup + pengingat HOD mentoring (17 Okt 2026)

**Minta:** (A) usulan/jadwal penatalayan sering lepas dari event (`eventId` kosong
→ absensi otomatis petugas ter-skip) — benahi server+klien+backfill; (C) event
spesial (mis. Bedah Film) punya Tuan Rumah & Penanggungjawab grup → mentor/co-mentor
kedua grup bisa di-routing mengisi usulan; (B) HOD panca tugas dapat pengingat
H-2/H-1 saat mentoring day (W1 tanpa baris ServingAssignment).

**Ubah:**
- A: helper `resolveWorshipEventByDate` (`server/lib/service-events.mjs`, match
  tanggal **WIB** ±1 hari, SERVING_DAY/MENTORING_DAY/UMUM, first-wins);
  dipakai auto-link `schedules/bulk` + fallback `proposals/bulk`, request
  tunggal, dan `fulfill` (`penatalayan-requests.mjs`). Panel usulan mentor:
  banner “Mengisi untuk: {event}”, kirim `eventId`, dukung deep-link
  `?date=&event=`; `GET /api/penatalayan/schedules` mengembalikan `events`
  (aditif). Script `backfill:penatalayan-link(:staging)` (dry-run default).
- C: `server/lib/event-groups.mjs` (parse/normalize/merge + `resolveGroupMentors`);
  `PATCH /api/events/:id` menyimpan `metadata.penatalayanGroups`;
  `POST /api/events/:id/penatalayan-routing` (SUPERADMIN/KOMISI/COMMITTEE)
  mengirim notifikasi `penatalayan` + deep-link per namespace ke mentor &
  co-mentor ACTIVE, mencatat `metadata.penatalayanRoutingAt`; kartu grup +
  tombol routing di `EventPenatalayanPanel`; fallback kartu Info Event
  (`/api/db/service-schedule`) untuk hari ber-grup.
- B: `resolveMentoringDayHods` (`serving-week.mjs`) + cabang mentoring di
  `runServingWeekReminders` (Jumat H-2 / Sabtu H-1, HOD saja; tetap jalan
  walau tabel serving_week_channels absen).

**Verifikasi:** lint ✓; unit 155 file / 1216 test lulus ✓ (baru: `event-groups`
9 test; extend `service-events` +`serving-week`). Smoke API lokal (staging DB,
read-only): boot ✓; `/api/penatalayan/schedules?from=..&to=..` → `events:[…]` ✓;
`/api/events/:id/penatalayan` → `event.metadata` ✓; route baru terdaftar (401) ✓.
Sisa QA staging: PATCH grup + kirim routing nyata, usulan mentor dari deep-link,
cron Jumat/Sabtu.

**Deploy:** push `main` ✓ (`c2ba91e`, cherry-pick di atas episode bedah film
`2d29d0a` via worktree terpisah — WIP paralel aman) → prod `youth.gehc.page`
`/api/version` = `c2ba91e` ✓ → `staging:sync` ✓ (9/9 alias · `/api/version`
staging = `c2ba91e`).

## Current — Pre-roll bioskop di layar BEDAH_FILM + pengumuman custom (17 Okt 2026)

**Minta:** kartu "Bersiap menonton" terlihat kecil & statis; minta teks jauh
lebih besar, muncul beranimasi + ikon relevan, teks berganti-ganti seperti
himbauan pre-show bioskop (lolos sensor Benzinema, "Youth GEHC
mempersembahkan", info nyeleneh), dan pengumuman yang bisa diatur operator
(mis. konsumsi tuan rumah).

**Ubah:**
- Lib murni `src/lib/film-preroll.ts` (`buildFilmPreRoll`): deck 10 slide default
  (pembuka → cap sensor → judul film → himbauan tenang → HP → konsumsi →
  penutup) + slide pengumuman custom (maks 6 × 140 huruf) disisipkan setelah
  info konsumsi.
- Komponen `src/components/mentoring/FilmPreRoll.tsx`: carousel 7 s/slide, ikon
  lucide per slide, animasi `film-preroll-enter`/`film-preroll-stamp` (hormat
  `prefers-reduced-motion`), strip judul film + durasi selalu terlihat, dots
  indikator.
- `MentoringScreen.tsx`: "Bersiap menonton" → slideshow; "Sedang diputar" →
  tampilan tenang teks besar (tanpa rotasi) + nada bioskop.
- `cleanScreening` (`server/lib/session-stage.mjs`) menormalkan `screening.preShow`
  (array maks 6 × 140); tipe `SessionScreening.preShow`; `ScreeningPanel`
  (Didaskalia) dapat textarea "Pengumuman tambahan (1 baris = 1 pengumuman)".

**Verifikasi:** lint ✓; unit 154 file / 1201 test lulus ✓ (baru: `film-preroll`
4 test, kasus `cleanScreening` preShow). QA visual lokal (mock API, viewport
1920×1080): rotasi 7 s terverifikasi, slide pembuka/judul/cap sensor/custom/
on-air tampil benar. Sisa: QA staging sesi BEDAH_FILM nyata.

## Current — Bedah Film: timer per langkah & sinkron 3 view (17 Okt 2026)

**Minta:** hapus durasi sesi penuh (timer 180:00 tidak muncul di layar film),
countdown hanya per langkah (M0/M3/M4), bagian film tanpa timer; sinkronkan
layar/HP peserta/kontrol (fase, gate Likert, marker tayang) untuk acara
malam ini.

**Ubah (kode, commit episode ini — di atas episode rundown 9d643dc):**
- Server: `FILM_PHASES=['M0','M3','M4']` + `FILM_PHASE_SECONDS`
  (M0/M3 5', M4 10') di `session-stage.mjs` (fallback `cleanPhase` ikut);
  `/live` kini mengirim `likertRounds` (gate AWAL/AKHIR).
- Kontrol: M1 = mulai + kunci Likert + marker ● Sedang diputar otomatis;
  M3 = buka Likert AKHIR + hentikan marker + fase M3 5'; M4 = wrapup +
  fase M4 10'; chip "+waktu" saat fase film; input "Timer sesi (detik)"
  film diganti keterangan auto-tutup 3 jam.
- Layar: kartu "Waktu tersisa" tidak lagi muncul untuk film (tanpa timer
  sesi penuh); kartu langkah M0/M3/M4 dengan countdown; kartu delta
  (dead-code diperbaiki) tampil saat gate AKHIR dibuka & finale; panduan
  konklusi saat AKHIR terbuka; fallback "Movie Breakdown" bila screening
  belum diisi.
- Peserta: chip langkah M3/M4 di kartu tontonan; peserta telat (belum isi
  Likert AWAL saat gate dikunci) **lanjut ke Nonton & Catat** (tidak
  terkunci); copy kartu gate diperjelas.
- Sim: `scripts/film-sim.mjs` (`npm run film:sim`) — replay M0→M1→M3→M4
  di staging + assert per langkah; `--stop m0|m1|m3|m4` untuk QA manual.
- Fix dirasa user: pilihan Likert sering terhapus saat menjawab (harus
  input 2×). Akar: effect init kartu Likert menimpa `vals` tiap payload
  polling 20 dtk. Kini merge-preserve `mergeFilmVals` (pilihan lokal belum
  terkirim dipertahankan; id ronde lain dibuang) + unit test regresi.
- Pesan pembuka film (permintaan user): field draft baru section `pembuka`
  (`opening`, editable di tab Draft Studio — otomatis ikut AI fill) →
  server `openingText()` (trim, cap 600) di payload peserta → kartu
  "Selamat datang" di atas kartu Likert AWAL (HP) memakai teks draft;
  kosong = teks bawaan menyebut judul film dari modul Pemutaran. Tanpa
  migrasi DB; `apply-draft` menyimpan section generik (sudah aman).

**Verifikasi:** `lint` bersih ✓; full suite 153 file / 1200 test ✓ (1196 +
3 test `openingText`; rerun setelah rebase di atas episode rundown
`9d643dc`); `film:sim` staging
(`2c686eb`) **23/23 assert LULUS** — M0 300s → M1 marker tayang + gate
terkunci → M3 gate AKHIR + delta + wordcloud → M4 600s → CLOSED; layar
film tanpa kartu "Waktu tersisa" (kode lama `180:00` hilang).

**Deploy:** staging ✓ (`2c686eb` · alias 9/9 domain · `/api/version`) → main ✓
(`22fa5dd`) → prod ✓ → fix Likert `2d29d0a` → prod+staging ✓ → pesan pembuka
`1adacf3` → prod+staging ✓ (terverifikasi `/api/version` = `4f49d3a`, turunan
`1adacf3` dari sesi paralel; branch `staging` = `main`).

**Next:** cek visual staging (layar/HP peserta/kontrol) memakai sesi
`demo-bedah-film-sim-utama` (ditinggal RUNNING di M3, kode layar `5CDFC4`,
jawaban awal/akhir + delta sudah terisi). Pesan pembuka film diisi tim di
tab Draft → section `pembuka` (kosong = teks bawaan menyebut judul film).

## Current — Akses rundown pola: semua divisi lihat, tombol tetap least privilege (17 Okt 2026)

**Minta:** rundown pola (11 blok) terlihat untuk semua divisi; tuan rumah &
penanggung jawab ikut jadwal pelayanan yang sudah ada; kendali tombol tetap
standar terbaik. Peserta (MENTEE) tidak diberi rundown penuh (anti-spoiler).

**Ubah:**
- Server: `GET /api/events/:id/worship` memuat `pattern.phases`; `GET
  /api/worship/sessions/:id` menambah `permissions.canWrite` (WRITE_ROLES +
  `canAccessDivision('DIDASKALIA')`).
- Klien: komponen bersama `PatternRundownList` (kartu/bare) — dipakai
  `MentoringControl` (banner Mode lihat-saja + fieldset ter-disable saat
  `!canWrite`; rundown pindah keluar fieldset agar tetap tajam), `ControlRoomPanel`
  (expander per blok ibadah — semua divisi), `ManageGroupsMonitoring` tab Jadwal
  (expander rundown + link kontrol per baris real — tuan rumah/PJ).
- `control-room.ts`: `WorshipMini.phases` → `DayBlockView.worshipPhases`.

**Verifikasi:** lint ✓; units 153 file / 1196 lulus ✓; smoke API lokal:
SUPERADMIN & KOMISI `canWrite=true` + 11 fase di sesi & event (`/api/events/:id/worship`
`session.phases`) ✓. Sisa QA staging: KOINONIA (lihat-saja), divisi lain
(Ruang Kontrol), mentor non-divisi (tab Jadwal).

**Deploy:** push main ✓ (`9d643dc`) → prod hub & youth `/api/version` = `9d643dc` ✓
→ `staging:sync` ✓ (branch+deploy+alias 9/9 domain) → staging `/api/version` =
`9d643dc` ✓.


## Current — Usulan penatalayan multi-divisi oleh Mentor/Co-mentor (17 Okt 2026)

**Minta:** Mentor/Co-mentor bisa mengusulkan nama petugas (multi-role ×
multi-orang, 1 tanggal, semua divisi terbuka); approve tetap di tiap divisi
(komisi/koordinator); status per-item (partial approve).

**Ubah (kode, commit episode ini):**
- DB: `service_role_requests` + `proposed_user_id` + `batch_id` (+2 index)
  via `server/_migrate-penatalayan-requests.cjs`; `service_roles.is_required`
  (P4 wajib/opsional). Jalankan `db:migrate:penatalayan-requests[:staging]`.
- Lib baru `server/lib/penatalayan-proposals.mjs` (normalisasi + dedupe +
  cap item, `proposalRowKey`) + test; `penatalayan-requests.mjs`:
  `listRequests` (division CSV, mine, batchId), `proposedUserName`,
  `hasActiveScheduleForUser`, `hasPendingProposalForUser`,
  `createRequestRow({proposedUserId, batchId})`.
- API: `POST /api/penatalayan/proposals/bulk` (per-item created/skipped,
  notifikasi per divisi); `POST /requests` terima `proposedUserId`
  (usulan tunggal mentor); `fulfill` fallback ke `proposedUserId` bila
  `userId` tak dikirim (approve satu klik).
- Kunci direct-assign mentor: `POST /schedules` & `/schedules/bulk` kini
  hanya SUPERADMIN/KOMISI/COMMITTEE (mentor → usulan).
- UI: `MentorPenatalayanUsulanPanel` (tab baru `penatalayan-usulan`,
  roles MENTOR/CO_MENTOR, youth) — pilih tanggal, centang divisi, cari
  nama binaan per role (exclude terisi/usulan pending per-role), kirim
  bulk; daftar "Usulanku" + batalkan. `PenatalayanRequestQueue` menampilkan
  "Usulan nama: X" + tombol `Setujui X` (atau ganti orang). `PenatalayanBoard`
  + status wajib/opsional + tombol "Minta divisi". i18n guide `penatalayan-usulan`
  (en+id), nav def + icons + type `ServiceRoleRequest`.

**Verifikasi:** `lint` bersih ✓ full suite 153 file / 1196 test lulus 100%
(termasuk `penatalayan-proposals` baru 5/5) ✓. Timeout `lazy-routes`
(ChurchHub cold-import >5 dtk di mesin ini) dinaikkan ke 20 dtk.

**Next:** QA staging: mentor kirim usulan multi-role (tab Usulan Pelayanan),
divisi approve satu klik (`Setujui X`), tolak/ganti nama, batalkan usulan,
cek notifikasi. Migrasi local ✓ prod ✓ staging ✓.

**Deploy:** push main ✓ (`783a605`) → CI hijau ✓ → Vercel production
Ready ✓ → migrasi prod ✓ → `staging:sync` ✓ (branch+deploy+alias) →
`/api/version` main = staging = staging-youth = `783a605` ✓. Token
multi-akun per-repo ✓ terpasang di `.env` (`VERCEL_TOKEN`, scope **Full
Account** — team-scope bikin CLI preflight `/v2/user` 404 "User not
found"; terverifikasi via `whoami` + `teams ls`). `scripts/sync-staging.mjs`
otomatis pakai token → instance VS Code/agen antar repo tidak saling
menimpa sesi login. HANDOFF diff ini sengaja dibiarkan uncommitted
(workspace paralel aktif).


## Current — Daftar hadir di portal + ringkasan untuk semua berperan (16 Okt 2026)

**Minta:** (1) fitur mendaftar kehadiran di portal Info Event (tidak hanya
landing); (2) ringkasan khotbah bisa diakses semua orang seperti RHB.

**Ubah (kode, belum push):**
- `EventInfoPanel.tsx` (+ `lib/event-register.ts`): tombol Daftar Kehadiran
  utk event aktif yg belum terdaftar (pakai `register-auth` + refresh;
  server tetap gate INTERNAL/ARCHIVED/peran).
- `didaskalia-studio.mjs`: `canViewDoc` khutbah = beyonders+staf (diekspor
  sbg `canViewMaterialDoc` + test); pesan 403 disesuaikan; pembekalan tetap.
- Test `portal-event-access.test.ts` (+5).

**Verifikasi:** `lint` bersih utk file episode (1 error lokal milik file
untracked sesi paralel, tak ikut push) ✓ test baru 5/5 ✓ `build` OK ✓.

**Next:** QA — daftar dari portal (QR+WA muncul), event Internal ditolak
sopan, Mentee buka deck khutbah, pembekalan tetap 403.

**Deploy:** push main ✓ → CI hijau ✓ → Vercel production Ready ✓ →
staging terverifikasi via /api/version (main = staging = `184711d`;
`staging:sync` timeout di sisi CLI tapi hasil akhir selaras) ✓. HANDOFF
ini belum di-commit (campur sesi paralel).

## Current — PDF via print + caption pindah tab Syukur (16 Okt 2026)

**Minta:** PDF persis website (via print); penatalayan hilang hanya di
unduhan (landing tetap); caption Koinonia pindah ke panel (tab sendiri).

**Ubah (sudah push `468fbb2`):**
- `ArsipDetail`: tombol jadi Cetak/PDF (`window.print`); print hanya
  khotbah (hero+ide+ayat+4 seksi) — tombol/galeri/petugas/caption/nav/
  footer `print:hidden`; hapus seksi caption + builder jsPDF tak dipakai.
- Baru tab `syukur` Koinonia (`portal-nav-config`, `DetailTab`, `TAB_META`,
  i18n `tabSyukur` ID/EN) + `EventThanksCard` (pilih arsip → caption
  sunting → Salin/WA) + `lib/arsip-caption.ts` + test.
- `ringkasanPdf.ts` tetap untuk tombol Warta.

**Verifikasi:** `lint` bersih ✓ `arsip-caption` 2/2 + nav 28/28 ✓
`build` OK ✓.

**Next:** QA print preview (hanya khotbah) + tab Syukur + Warta PDF.

**Deploy:** push main ✓ → CI hijau ✓ → Vercel production Ready ✓.
HANDOFF ini belum di-commit (campur sesi paralel).

## Current — Deck desktop: rail + font lg (16 Okt 2026)

**Minta:** deck di laptop kosong, di HP pas. Pilih: rail + font besar.

**Ubah (push `f9400f8` + `f7b623c`):** `DeckShell` rail daftar slide desktop (`hidden lg:`, sticky, klik lompat, auto-scroll item aktif; label via `deckRailLabel`) + container `lg:max-w-7xl`; `SlideView` font naik 1 tingkat di `lg` + artikel `lg:min-h` center vertikal; `MdBlocks` +1 tingkat `lg` (paper/overlay/plain, cetak tak berubah); HP (`<lg`) piksel-identik.

**Verifikasi:** label + struktur rail 21/21 ✓ full 1179/1180 (flaky pra-ada) ✓ lint bersih ✓ build Vercel OK ✓ push ✓. Visual browser tak bisa login staging (password demo tak cocok) — minta eyeball pemilik di laptop 1366/1920 vs HP 390.

## Current — Unduh PDF ringkasan khotbah (dibuat di HP) (16 Okt 2026)

**Minta:** fitur download as PDF di website, khususnya ringkasan khotbah.

**Ubah (sudah push `4a4e48a`):** baru `lib/ringkasanPdf.ts` (builder jsPDF
client-side: sampul + ide + ayat + 4 seksi + lampiran petugas + footer link;
cover best-effort) + tombol Unduh PDF di `ArsipDetail` (busy + fallback)
+ tombol Warta disambungkan ke builder yang sama (sebelumnya toast palsu).

**Verifikasi:** `lint` bersih ✓ `ringkasan-pdf` 3/3 ✓ `build` OK ✓.

**Next:** QA HP (unduh terbuka benar, tanpa cover tetap jadi, teks panjang
multi-halaman).

**Deploy:** push main ✓ → CI hijau ✓ → Vercel production Ready ✓ →
`staging:sync` tuntas (main = staging = `4a4e48a`) ✓. HANDOFF ini belum
di-commit (campur sesi paralel).

## Current — Guard acuan RHB 0 path (16 Okt 2026)

**Laporan:** user tempel MD lengkap ke kotak acuan (tab Inti) → notif "0/7 Path … Simpan sebagai acuan" menyesatkan. Sebab: salah kotak (importer ada di tab 7 Path) + kode lama menyimpan acuan kosong.

**Ubah (sudah push `2076ef0`):** `parseWeeklyMd('rhb')` — hasil 0 path → tidak disimpan + pesan mengarahkan ke "Import MD lengkap" tab 7 Path (1 file, 6 baris).

**Verifikasi:** lint bersih ✓ file 13/13 ✓ push ✓. Cara benar tetap: tab 7 Path → Import MD lengkap → Parse → Terapkan.

## Current — Arsip: hero overlay teks-di-gambar + grouping petugas (16 Okt 2026)

**Minta:** (1) teks ringkasan menimpa gambar cover; (2) daftar petugas
dikelompokkan Divisi → Role → Orang dengan styling bagus.

**Ubah (kode, belum push):** `ArsipDetail.tsx` — cover jadi hero
(gradient + bigIdea overlay + chip tanggal; fallback tata lama bila tanpa
cover/gagal load; ayat tetap di bawah); seksi petugas memakai
`groupPeopleByDivision` + warna divisi reuse + sub-grup Role + `DutyPersonChip`.

**Verifikasi:** `lint` bersih ✓ full suite 1173/1173 ✓ `build` OK ✓.

**Next:** QA visual HP 360 + desktop (kontras teks, fallback tanpa cover,
“Lainnya” utk tanpa divisi).

**Deploy:** BELUM commit/push (hemat deployment; workspace paralel aktif).

## Current — Import MD RHB 7 hari jadi ke 7 Path (16 Okt 2026)

**Minta:** file `Ancient_Word...Paths_1-7.md` (RHB harian lengkap 18–24 Okt = W3) bisa diregenerate/diterapkan; flow saat ini?

**Temuan:** parser acuan (`parseRhbMd`) MENOLAK file tsb (0/7: `# PATH` 1 pagar bukan heading + wajib `**Scripture:**` sedang file pakai `**Ayat Renungan:**`). File tsb = konten final (5 section + Jembatan), bukan acuan — AI tak diperlukan.

**Ubah (sudah push `79d4d99`):** `parseRhbFullMd` baru (7 `# PATH N` + `## judul` + Ayat Renungan + 5 section + Jembatan; validasi per hari) + `POST /api/didaskalia/parse-md kind=rhb-full` + blok **Import MD lengkap** di tab 7 Path (paste → Parse → preview 7 judul → mode Timpa/Isi-kosong → Terapkan; tulis judul+nats+5 section+bridge verbatim, Bacaan tak disentuh, tolak bila pendingRegen PENDING). Parser terverifikasi ke file asli: ok 7/7.

**Verifikasi:** file +2 ✓ full 1172/1173 (flaky pra-ada) ✓ lint bersih ✓ push ✓.

**Cara pakai (prod, setelah deploy):** Studio W3 → tab 7 Path → tempel isi file → Parse MD → Terapkan ke 7 Path → cek 7 hari → Ilustrasikan + Terbitkan seperti biasa. Tombol AI tak perlu disentuh.

## Current — Ringkasan publik render MdBlocks (16 Okt 2026)

**Minta:** tulisan ringkasan penuh simbol parser (`*`, `#`, `>`). Pakai renderer bawaan (disetujui).

**Ubah (sudah push `30b6bf4`):** `RingkasanPublik.tsx` + `ArsipDetail.tsx` render tiap bagian outline via `parseMdLite` (+`speech` untuk kesimpulan) + `<MdBlocks tone="paper" density="compact" />` (sama dengan deck portal); tes render cuplikan asli tanpa simbol (+1, total file 11).

**Verifikasi:** file 11/11 ✓ full 1170/1171 (flaky pra-ada) ✓ lint bersih ✓ push ✓. Browser live prod `#/ringkasan/2026-10/2`: heading biru, blockquote + chip ref, strong/emphasis, list berpoin, separator — tanpa simbol mentah ✓.

## Current — Fix redirect arsip/ringkasan ke landing (16 Okt 2026)

**Laporan:** klik tiap tanggal kembali ke landing. Akar: parser live App (`lib/hash-routes.ts`) tak kenal segmen `arsip/`/`ringkasan/` → default `beyonders`; fallback `routes.ts` di AppContext kode mati. Dampak ganda: `#/ringkasan/...` juga tak pernah terbuka.

**Ubah (sudah push `c0e0e56`):** `hash-routes.ts` (+union tab, PUBLIC_TABS, handler `ringkasan/`+`arsip/`); tes parser live +2 (total file 10).

**Verifikasi:** file 10/10 ✓ full 1169/1170 (flaky pra-ada) ✓ lint bersih ✓ push ✓. Browser live prod: `#/arsip/<id 11 Okt>` → detail penuh (cover, bigIdea, 4 section, galeri, tuan rumah Hesed + Avodah + 30 petugas, caption + Salin + WA) ✓.

## Current — Arsip klik-per-tanggal + narasi live + caption (15 Okt 2026)

**Minta:** warta kosong → tampilkan tanggal ARCHIVED/DONE berisi ringkasan + galeri + tuan rumah; gambar default = cover AI Studio; tiap tanggal klikable + routing (untuk caption Koinonia ke grup).

**Ubah (sudah push `98aa123`):**
- Server: gerbang ringkasan/gambar longgar — pekan lampau sajikan draf live + flag `published` (planning tetap 404); arsip tampil DONE/ARCHIVED lampau + `ringkasan {ym,week,published}` selalu ada.
- Client: `ArsipIbadah` jadi daftar tanggal klik → `#/arsip/:id`; `ArsipDetail` baru (cover, narasi 4 bagian, galeri, tuan rumah + penanggung jawab + petugas via service-schedule publik, caption terima kasih + Salin + WA); route `arsip` di routes/AppContext/App; i18n arsip +caption id/en.
- Tes +1 (route arsip; total file 9).

**Verifikasi:** file 9/9 ✓ full 1167/1168 (flaky pra-ada) ✓ lint bersih ✓ push ✓. Prod live `98aa123`: arsip 7 event lampau (4 & 11 Okt + Sept, semua live), 25 Okt + 17 Okt absen (tepat — planning/masa depan), ringkasan W2 200.

## Current — Publish khutbah = terbit + arsip sembunyikan planning (15 Okt 2026)

**Minta:** W1/W2 "belum diterbitkan" padahal link harusnya bisa diakses; planning (25 Okt) jangan muncul.

**Akar:** publish khotbah tak menandai PUBLISHED (hanya pembekalan/RHB) + arsip tampilkan semua event berfolder.

**Ubah (sudah push `9078a96`):** `publishedOnPublishDoc` (+khutbah) di `didaskalia-studio.mjs`; `isArchiveVisible` (published + tanggal < hari ini WIB) + filter server di `drive-ownership.mjs`; kartu disederhanakan (tanpa pesan mati); skrip `backfill-published-khutbah.mjs` (dry-run default, lewati pendingRegen); tes +3 (total file 10).

**Verifikasi:** file 10/10 ✓ full 1166/1167 (flaky pra-ada) ✓ lint bersih ✓ push ✓.

**Fakta prod (cek read-only):** W1–W4 SEMUA DRAFT dan TANPA render (`render=[-]`; cover ada W1–W3). Backfill dry-run prod = 0 kandidat (tepat — tak ada snapshot khutbah yang bisa di-flip). Artinya W1/W2 memang belum pernah di-publish via tab Terbitkan (bukan sekadar status salah).

**Tinggal tindakan tim (tak bisa/harusnya tidak otomatis):** publish W1/W2/W3 dari Studio → tab Terbitkan → publish khotbah (kode baru otomatis tandai PUBLISHED). Setelah itu tombol + narasi + gambar menyala di bulletin; W4 (25 Okt) tetap sembunyi sampai lewat + published.

## Current — Undian film dibatasi tepat 2 + tawaran ganti (16 Okt 2026)

**Minta:** kesaksian Bedah Film yang live harus tepat 2 orang (batas 2);
kalau penuh, tawarkan ganti (pool dari pendaftar/hadir — sudah dikonfirmasi).

**Ubah (sudah push `abd73ca`):**
- `testimony.mjs` (baru `TESTIMONY_FILM_CAP` + `applyFilmCap`: fresh
  diutamakan, tak pernah >2).
- `worship.mjs` (draw + manual: film penuh tanpa flag → 409 `full:true`;
  flag `replace:true` → 2 baru ganti 2 lama, slot dari 1; sabuk pengaman
  cap di semua jalur merge; manual ikut pola film).
- `TestimonyPanel.tsx` (tawaran ganti saat `full`: tampilkan 2 nama live +
  tombol Ya-ganti/Batal; pola lain tak berubah).
- Test `session-engine.test.ts` (+batas film).

**Verifikasi:** `lint` bersih ✓ `session-engine` 37/37 ✓ `build` OK ✓
full suite 1158/1159 (1 flaky `lazy-routes` pra-ada) ✓.

**Next:** QA — undi 1× = 2 di layar; undi lagi → tawaran (batal = tetap,
ganti = 2 baru); manual saat penuh ditolak; Monolog/standar tak terpengaruh.

**Deploy:** push main ✓ → CI hijau ✓ → Vercel production Ready ✓ →
`staging:sync` tuntas (main = staging, 9 alias) ✓. HANDOFF ini belum
di-commit (campur sesi paralel).

## Current — Bulletin arsip ibadah + ringkasan publik (15 Okt 2026)

**Minta:** warta kosong → grid 4 event terbuka + see more; tiap grid: gambar Studio + narasi khotbah + button ringkasan (publik penuh) + galeri hari itu (thumbnail).

**Ubah (kode, sudah push `2ba2e25`):**
- Server: `GET /api/ibadah/ringkasan/:ym/:week` + `/gambar` (publik, published-only, 404 bila DRAFT) di `didaskalia-studio.mjs`; `public-archive` tambah `date` + `ringkasan {ym,week}|null` (GESER-aware via `originDateFor` + `weekIndexForDate`, cek PUBLISHED per ym) di `drive-ownership.mjs`.
- Client: `ArsipIbadah.tsx` (baru: 4 terbuka + see more +4, cover lazy, narasi bigIdea, tombol `#/ringkasan`, thumbnail Drive) dipakai ganti empty-state warta (bila tanpa filter) di `WeeklyInfoSection.tsx`; `RingkasanPublik.tsx` (baru: `#/ringkasan/:ym/:week` baca-saja + 404 ramah); route `ringkasan` di `routes.ts`/`AppContext`/`App.tsx` (EventArchiveGallery dilepas dari bulletin, file tetap untuk halaman galeri); i18n `arsip`+`ringkasan` id/en.
- Test `ringkasan-publik.test.ts` (+4: routing hash, mapping 17→W3, kalender).

**Verifikasi:** `ringkasan-publik` 4/4 ✓ full 1162/1163 (1 flaky `lazy-routes` pra-ada) ✓ lint src/server/tests bersih (error hanya `dist/` basi sesi paralel) ✓. Push main ✓ + `staging:sync` ✓ (`2ba2e25` sama, 9 alias). Staging anon: `public-archive` 200 (9 event, 0 ringkasan), ringkasan W3 → 404 tepat (gate jalan).

**PENTING — belum ada pekan PUBLISHED di prod maupun staging** (cek DB: nol). Tombol/narasi/gambar hanya muncul setelah pekan di-PUBLISH via Studio (persetujuan HOD — pintu ke publik, jangan publish sepihak). Agar kartu 17 Okt tampil penuh: publish W3 + pastikan cover terisi (unggah/generate di Studio tab gambar).

## Current — Mentoring: back-nav semua pola + timer per fase + undi film 2 orang + extend detik (16 Okt 2026)

**Minta:** (1) dialog Monolog keluar layar di HP → perbaiki; (2) opsi kembali
ke flow terbuka ala post-to-post; (3) tiap step bisa diatur waktunya (tidak
fix) + toggle tampil di layar per step; (4) Bedah Film undian ala Monolog
(nama + grup di layar), tetap 2 orang; (5) tambah waktu fleksibel
(+5/+60/+300 dtk + custom, bukan cuma +5 mnt).

**Ubah (kode, belum push):**
- `session-engine.ts` (`resolvePinnedSegment`) + `PatternDay.tsx` (baris tahap
  jadi nav scroll + tombol kembali; pin mundur, tak ditarik maju paksa).
- `session-stage.mjs` (`cleanPhase` terima `showOnScreen` default true;
  baru `cleanPhasePrefs`/`defaultPhasePrefs`) + `worship.mjs` (cabang
  `phasePrefs`, payload `phasePrefs` di 2 live endpoint, clamp `extend`
  60→5 dtk).
- `mentoring.ts` (tipe `showOnScreen` + `PhasePrefs`).
- `MentoringControl.tsx` (blok Pengaturan tiap fase F1/F2/F3/CLOSING:
  durasi menit + toggle tampil; tombol fase pakai preferensi; extend jadi
  chip +5/+60/+300 dtk + custom 5–1800; `TestimonyPanel mode=film` utk film).
- `TestimonyPanel.tsx` (prop `mode`; teks film: tepat 2 orang nama+grup;
  server memang sudah undi 2 utk film).
- `MentoringScreen.tsx` (timer fase disembunyikan bila dimatikan; HP peserta
  tak berubah — tetap tampil).
- Test `session-engine.test.ts` (+pin mundur 4, +showOnScreen, +phasePrefs;
  1 ekspektasi lama disesuaikan field baru).

**Verifikasi:** `lint` bersih (1 error lokal milik file untracked sesi paralel,
tak ikut push) ✓ full suite 1158/1159 (1 flaky `lazy-routes` pra-ada) ✓
`build` OK ✓.

**Next:** QA — HP 320/360 (tahap scroll + mundur; jawaban tak hilang);
kontrol (ubah durasi → countdown ikut; toggle mati → layar sembunyi, HP
tampil); undi film (tepat 2 + grup di layar); extend custom 45 dtk.

**Deploy:** 520a48f (back-nav) + edd5513 (timer/undi) → push main ✓ →
CI hijau ✓ → Vercel production Ready ✓ → `staging:sync` tuntas
(main = staging = `edd5513`, 9 alias) ✓. HANDOFF ini belum di-commit
(campur sesi paralel).

## Current — Pull prod → staging penuh (kode + data) (15 Okt 2026)

**Minta:** semua yang ada di website prod sekarang ke staging, termasuk data.

**Jalan:**
- `staging:sync` ✓ — `main:staging` (`0b41663..b33d081`), deploy `gehcpage-l44tyzq04` + 9 alias, `/api/version` main == staging (`b33d081`) ✓.
- `db:copy:prod-to-staging` dry-run ✓ (132/138 tabel, 10497 baris, exclude operator/push/ai-config/avatar, password scrub) → `:apply` ✓ 10497 baris, 0 gagal, 75.6s.
- `db:seed-users:staging` ✓ (users 279, roles 397, struktur 39, mentee ter-link 92).
- Verifikasi staging: sesi 17 Okt = film-title Case for Christ ✓, film-q2 kait khotbah ✓, Likert 10 + chip 10 (hasil Terapkan prod ikut tersalin) ✓, W3 bigIdea "kesaksian historis" ✓.

**Catatan:** `screening: null` di staging = cermin akurat prod (Terapkan prod terjadi sebelum fix screening deploy). Isi otomatis pada Terapkan berikutnya (kode baru sudah live di kedua sisi). File Drive tidak ikut copy (by design — hanya ID sebagai teks). `worship_patterns` ikut dari prod (6 pola); bila tampak basi di staging → `db:seed:worship:staging`.

## Current — Standar loading global anti-bosan + kunci interaksi (15 Okt 2026)

**Kebutuhan:** saat waiting tampil UI standar (tidak bosan) dan user tak bisa
asal scroll/swipe/klik ganda. Pilihan: semua loading dikunci, gaya branded
menyenangkan, timeout + retry.

**Ubah (kode, belum push):**
- Baru: `ui/LoadingOverlay.tsx` (varian fullscreen/section, delay tampil 300ms,
  pesan playful bergilir >3dtk, timeout default 20dtk + tombol Coba lagi/Kembali,
  tone gelap utk auth, `role=status` + fokus), `hooks/useLoadingLock.ts`
  (kunci body scroll + touchmove/wheel, counter aman tumpuk), `lib/loading-copy.ts`
  (kontrak waktu) + `index.css` (`loading-slide` + reduced-motion).
- i18n `en.ts`/`id.ts`: kamus `loading` (judul per kind + 4 pesan playful + teks timeout).
- Pakai: `App.tsx` (SectionFallback + SessionRestore → overlay fullscreen),
  `main.tsx` (HubFallback → overlay), `PortalLogin` (overlay di kartu + abort +
  retry Google 25dtk + kunci form lokal anti double-submit), `AuthPanels`
  (overlay + abort + retry), `WeeklyInfoSection`/`EventsTimeline`/
  `WartaServiceDutySection`/`GroupActivitySection` (overlay section + abort +
  retry; skeleton lama dipertahankan di bawah overlay).
- Test baru `loading-copy.test.ts` (+4: delay tampil, fun mode, timeout, putar pesan).

**Verifikasi:** `lint` bersih ✓ `build` OK ✓ `test` 1152/1153 — 1 gagal
`worship-session-draft` (`parseFilmDurationMin` clamp) milik sesi paralel
(test + sumber di luar file saya; belum ada di main) — file saya hijau semua
(termasuk `loading-copy` 4/4).

**Next:** QA manual throttling Fast 4G — overlay muncul >300ms, pesan berganti
>3dtk, scroll/swipe terkunci, matikan server → timeout → Coba lagi; cek
`prefers-reduced-motion` dan screen-reader.

**Deploy:** b60e449 (fix 2 file) + ca7bd6e (perf+loading) + b33d081
(mandirikan tipe) → push main ✓ → CI `lint-and-test` hijau ✓ → Vercel
production Ready ✓ (22:02 WIB, semua alias) → `youth.gehc.page` 200 ✓.
Catatan: commit perf menyerap file loading (satu commit, tetap 1 push).
HANDOFF ini belum di-commit (campur sesi paralel) — section ini tetap di
working tree.

## Current — Terapkan isi Pemutaran + deep-Q tampil + prompt kait khotbah (15 Okt 2026)

**Laporan:** sesudah Terapkan, modul Pemutaran film tetap kosong (judul kosong, durasi 91 = fallback) — perlu isi manual; deep sharing draf (film-q1..3) tak tampil di peserta/layar; Q deep tak dikaitkan ke ringkasan khotbah Studio. Akar (tiga rantai putus): `apply-draft` BEDAH_FILM tak menulis `config.screening` (`worship.mjs:1566` hanya Likert+chip) sedang `ScreeningPanel` hanya baca `config.screening` (`StagePanels.tsx:137`); `deepGuide()` hanya kenal `deep-q1/2` sedang template film simpan `film-q1..3` (`worship.mjs:162`); prompt hanya terima `sermon.summary` tanpa bigIdea/teksUtama/outline dan tanpa aturan deep-film.

**Ubah (kode, sudah push `1cd975b`):**
- `server/lib/session-stage.mjs` (`parseFilmDurationMin`: angka 2–3 digit sebelum "menit", tahun diabaikan, fallback 90) → `worship.mjs` `apply-draft` tulis `screening {title, durationMin, startedAt:null}` dari film-title + guard live (startedAt ada → tak sentuh) + balas `screening` ke UI.
- `StagePanels.tsx` fallback baca `draft.film['film-title']` (selamatkan sesi Terapkan-lama); `SessionDraftTab.tsx` pesan sukses sebut Pemutaran terisi.
- `deepGuide()` kembalikan 3Q bila ada kunci film-q (MONOLOG tetap 2) → peserta (`PatternDay` label slot dari deepGuide), layar (`MentoringScreen`), rekap PDF (`PatternDay:405` ikut BEDAH_FILM).
- Prompt: `sermonFocusBlock` (bigIdea + teksUtama + cuplikan outline) + `DEEP_FILM_RULES` (Q1 analogi adegan; Q2 WAJIB Bedah Teologis khotbah + bigIdea + ref, fallback "(khotbah menyusul)"; Q3 nama+hari); route kirim bigIdea/teksUtama/outline + flag `sermonEmpty` → warning di `aiNote`.
- Test (+7: parse durasi, deepGuide film/monolog, 2 prompt deep-film).

**Verifikasi:** `worship-session-draft` 43/43 ✓ full suite 1152/1153 (1 flaky `lazy-routes` pra-ada) ✓. `lint`: gagal karena artefak `dist/assets` basi milik sesi paralel (50 error TS6053 semua di `dist/`, nol di `src/`/`server/` — tak terkait perubahan ini).

**Data prod:** Studio W3 = tema "Ancient Word, Modern World", FF Kis 1:1-3, kitab 2Ptr 1:3-15, bigIdea "kesaksian historis" — selaras Case for Christ. `film-q2` sesi 17 Okt diperbarui langsung (tulis 1 kunci draf, sesi DRAFT) agar kait 2Ptr 1:3-15 + Kis 1:1-3 + bigIdea.

**Deploy:** commit `1cd975b` (8 file; HANDOFF disisakan) → push main ✓ (`vercel:gc` 0 kandidat) ✓.

## Current — AI Bedah Film pakai judul tim + curasi Case for Christ 17 Okt (15 Okt 2026)

**Laporan:** `Isi dari AI pekan ini` untuk event 17 Okt (GESER 18→17, origin 2026-10/W3) tak sinkron Studio — fallback ke Gavin Stone/Soul Surfer. Penyebab: route hanya kirim firman/paths/sermon tanpa judul film; klik menimpa `film-title` yang sudah diketik; tombol bisa diklik saat origin week masih loading (baca W2 lama); Studio kosong total tetap di-generate (halusinasi).

**Ubah (kode, belum push):**
- `server/lib/didaskalia-ai.mjs` (`filmAnchorBlock` + `currentDraftBlock` + sinopsis Case for Christ: Lee Strobel/Yale Law/Leslie/±2 thn/4 argumen eksekusi–makam kosong–500 saksi–murid rela mati; ANTI-CONTOH sebut Gavin Stone eksplisit).
- `server/routes/didaskalia-studio.mjs` (`POST .../session-draft` terima `currentDraft/filmTitle/notes`; guard 400 bila Studio kosong + tanpa judul — cegah fallback lama).
- `SessionDraftTab.tsx` (kirim `currentDraft` + `filmTitle`; merge hanya isi yang kosong — tak overwrite; badge `ym/W + slot → event`; prop `weekLoading`; hint ketik judul dulu).
- `PolaSesiPanel.tsx` (hapus state beku ym/week; `key` ikut ym-week-epoch; badge pekan; teruskan `weekLoading`).
- `DivisionWorkspacePanel.tsx` (teruskan `originWeek.loading` ke Pola).
- Baru: `server/lib/bedah-film-case-for-christ.mjs` (curasi lengkap: film-alt 2 kandidat + 3 adegan ↔ 1Kor 15:3-8/Yoh 20/Kis 4 + pleno + likert 5 + deep 3Q + 10 chip) + `scripts/fill-bedah-film-case-for-christ.mjs` (dry-run default; `--apply/--force/--create`; abort bila bukan DRAFT / sudah ada soal).
- Test `worship-session-draft.test.ts` (+6: anchor film, anti-contoh, draf masukan, 3 curasi).

**Verifikasi:** `lint` bersih ✓ `test` 1141/1142 (1 flaky `lazy-routes` ChurchHub-timeout pra-ada, tak terkait) ✓ `worship-session-draft` 36/36 ✓.

**Next:** QA staging/prod: event geser 18→17 → badge W3 + tombol "Menunggu pekan…" hilang setelah override termuat; ketik judul film → AI lengkapi tanpa ganti judul; Studio kosong + judul kosong → 400 ramah.

**Deploy:** commit `0111305` (8 file; HANDOFF disisakan — section sesi paralel belum push) → push main ✓ (Vercel prod deploy 1x; `vercel:gc` 0 kandidat) ✓.

**Data prod 17 Okt:** TERISI ✓ — `fill-bedah-film-case-for-christ.mjs --apply` ke `sesi-2026-10-17-bedah-film` [DRAFT] (event "Ancient Word, Modern World - 17 Okt 2026", 0 item/responses; film-title lama kosong). Tinggal buka tab Draft → periksa → `Terapkan ke sesi`.

## Current — Performa loading: login Google + Warta/Kegiatan (15 Okt 2026)

**Laporan:** login Google delay, warta/kegiatan terbaru delay, banyak tempat lain terasa lambat.

**Akar:** tombol Google nunggu `/api/auth/me` (TiDB) + GSI lazy tanpa preconnect;
Warta/Kegiatan triple-waterfall tanpa cache tanpa skeleton; semua section landing
eager-import; endpoint publik tanpa `Cache-Control`, `media/slots` pakai
`no-store`, `content/public take 100`, stats landing N-query tak terbatas.

**Ubah (kode, belum push):**
- Server: `lib/public-cache.mjs` (baru) + `createApp.mjs` (Server-Timing + log
  >800ms) + `content-public` (limit default 30, cache 45s, bust saat mutasi,
  Cache-Control media) + `events-public` (cache landing 45s) +
  `drive-ownership` (cache service-schedule & group-albums 60s) + `index.mjs`
  (`/me` paralel Bod/Didaskalia + `no-store`) + `event-signup-stats` (take 2000).
- Frontend: `AppContext` (`ssoLoading` terpisah — tombol Google tak tunggu `/me`)
  + `google-auth-flow` (cache clientId 5 mnt) + `PortalLogin` (skeleton + spinner
  Google) + `AuthPanels` (skeleton config) + `index.html` (preconnect GSI, font
  gabungan 1 request, pwa defer) + `ui/Skeleton` (baru) dipakai
  `WeeklyInfoSection`/`EventsTimeline`/`WartaServiceDutySection` +
  `useMediaSlots` (hapus `no-store`, `refetchOnMount:false`) + `App.tsx`
  (code-split 19 section per tab + warm idle content/landing).
- Gambar: banner warta `lazy+async`.

**Verifikasi:** `lint` bersih ✓ `test` 1135/1136 (1 flaky `lazy-routes`
ChurchHub-timeout pra-ada, hijau saat rerun isolasi) ✓ `build` OK ✓
(chunks Warta/Events terpisah 8–12kB). Tanpa migrasi DB.

**Next:** QA manual — login Google <1s tampil tombol + spinner saat klik;
tab Warta/Kegiatan tampil skeleton dulu; cek Network TTFB + header
`Cache-Control`/`Server-Timing`; ukur sebelum/sesudah di throttling Fast 4G.

**Deploy:** BELUM commit/push (hemat deployment; workspace paralel aktif).
File saya saja bila commit:
`server/lib/public-cache.mjs, server/createApp.mjs, server/index.mjs,
server/lib/event-signup-stats.mjs, server/routes/content-public.mjs,
server/routes/events-public.mjs, server/routes/drive-ownership.mjs,
index.html, src/App.tsx, src/context/AppContext.tsx,
src/lib/google-auth-flow.ts, src/hooks/useMediaSlots.ts,
src/components/portal/PortalLogin.tsx,
src/components/public/auth/shared/AuthPanels.tsx,
src/components/public/WeeklyInfoSection.tsx,
src/components/public/EventsTimeline.tsx,
src/components/public/WartaServiceDutySection.tsx,
src/components/public/ui/Skeleton.tsx, HANDOFF.md`.
Perintah: `lint` + `test` sudah hijau di atas; lalu commit spesifik +
push + `staging:sync` satu batch.

## Current — Pola Katalog ↔ Studio dua arah + shell sesi (14 Okt 2026)

**Laporan:** dropdown "Pola ibadah" di Studio/Inti manual — tak sync dengan katalog
pekan (dua `savePattern` tulis field sama tanpa kabar; Studio tak buat shell sesi).

**Ubah (kode):** `src/lib/apply-week-pattern.ts` (baru: satu penulis PATCH + shell
sesi kosong idempoten tanggal efektif + event `gehc:week-pattern-changed`) + test
(+5: create/exists/no-event/failed/PATCH-gagal) → `PolaSesiPanel.tsx` + 
`DidaskaliaStudioPanel.tsx` (dua savePattern pakai helper; listener saling update
weekMeta; label Studio + tanggal efektif & "sama dengan Katalog").

**Verifikasi:** `lint` bersih ✓ `test` 1135/1136 (1 flaky `lazy-routes` pra-ada) ✓
`build` OK ✓. Tanpa migrasi DB.

**Next:** QA dua arah di event 17 Okt (Katalog→Studio & Studio→Katalog ikut;
shell tepat satu; klik ulang tak ganda).

**Deploy:** commit `0b41663` (5 file; HANDOFF hanya section sendiri via splice)
→ push main ✓ → `staging:sync` tuntas sekali jalan (deploy `gehcpage-cw4gagz4w`
Ready + 9 alias + verifikasi main = staging = `0b41663`) ✓.

## Current — Materi event geseran ikut origin week (deploy e81afbf)

**Laporan:** event dipindah 18→17 Okt, tapi isinya sinkron dgn 11 Okt (W2) —
seharusnya draf W3 (kosongan, perlu diisi); RHB + ringkasan ikut W3 atau tanggal baru?

**Akar:** grid minggu = Minggu–Sabtu → Sabtu 17 Okt jatuh ke W2; 3 resolve
tanggal→minggu (`DivisionWorkspacePanel`, `EventDidaskaliaMaterials`,
`IbadahMingguanPanel`) tak kenal GESER; `effectiveDate` hanya satu arah
(pekan→event). Data tidak rusak — hanya salah alamat minggu. Dikunci: materi
ikut origin week W3 (RHB tetap Path 1 Minggu…7 Sabtu milik W3).

**Ubah (kode, belum commit):** `service-overrides.mjs` lib (`originDateFor`,
kebalikan `effectiveDate`) + routes (GET baca dibuka semua login; tulis tetap) →
`church-week.ts` (`WeekOverride`, `originDateForEvent`, `weekForEventDate`) →
hook baru `useOriginWeek.ts` (fetch map ±7 hari, fallback perilaku lama) →
pakai di 3 komponen → test `church-week.test.ts` (+5) + `service-geser.test.ts`
(+1 originDateFor).

**Verifikasi:** `lint` bersih ✓ `test` **1131/1131** (146 files; 1 flaky
`lazy-routes` + 1 ekspektasi null milik saya, keduanya hijau di rerun/isolasi) ✓
`build` OK ✓. Tanpa migrasi DB.

**Deploy:** commit `e81afbf` (9 file; campuran paralel dikecualikan via
revert-restore) → push main ✓ → `staging:sync` tuntas → main = staging = prod =
`e81afbf` ✓. File paralel tak tersentuh (satu sisipan JSX paralel dikembalikan
di posisi logis pasca-Kalender — pemilik harap cek).

**Next:** QA manual event 17 Okt (Studio, materi/RHB, pola & sesi, ibadah mingguan
→ semua tunjuk W3; W2 tak tersentuh).

## Current — Siklus mingguan ideal: kosong → pola → draft → kontrol (14 Okt 2026)

**Kebutuhan:** draft + kontrol tiap pekan mulai kosong; pilih pola + terapkan →
draft tanggal itu muncul; isi → Terapkan; kontrol mengikuti. Semua ikut tanggal
efektif event (18→17).

**Ubah (kode):** `src/lib/effective-date.ts` (baru: `wibDayKey`/`effectiveSessionDay`
event-dulu-pekan-fallback + `sessionSlugStem`) → `SessionDraftTab.tsx` (pakai
helper; slug prefill `sesi-<tgl>-<pola>`) → `PolaSesiPanel.tsx` (`savePattern`
auto-buat shell sesi kosong idempoten per event+pola + loncat ke Draft; `saveT0`
pertahankan hari event — sebelumnya seret 17→18; header + preview `t0` tampil
tanggal efektif + catatan slot) → `worship-session-select.ts` (preferPattern tanpa
cocok → `''`, bukan sesi lama) → `MentoringControl.tsx` (gate `hasDraft`:
tanpa isi → banner + fieldset kunci total tombol aksi, link tetap; tanpa sesi →
panel kosong eksplisit) + `sessionHasDraftContent` di `worship-session-draft.ts`.

**Verifikasi:** `lint` bersih ✓ `test` 1124/1125 (1 flaky `lazy-routes` pra-ada) ✓
baru: effective-date 8 + select ketat + gate 3 ✓ `build` OK ✓. Tanpa migrasi DB.

**Next:** QA staging end-to-end (pekan kosong → katalog → draft kosong 17 Okt →
AI → Terapkan → kontrol terbuka; saveT0 tak seret tanggal; ganti pola tak
nyangkut).

**Deploy:** commit `037554d` (10 file; HANDOFF hanya section sendiri via splice)
→ push main ✓ → `staging:sync` tuntas sekali jalan (deploy `gehcpage-tdzivafn0`
Ready + 9 alias + verifikasi main = staging = `037554d`) ✓.

## Current — Baris pindahan GESER tak tampil + kartu WA tanggal efektif hilang (14 Okt 2026)

**Laporan:** prod W3 sudah di 17 (assignment idx4 Logos→Dunamis + event ACTIVE
"17 Okt 2026", override GESER tercatat — audit prod read-only), tapi di portal
baris W3 kosong (tak daftar ke 17) dan kartu Grup WA/kontrol 17 tak muncul.

**Akar (UI, 2 lapis):** (1) `specialsByDate` dikunci by `eventDate` (=17, tanggal
efektif) padahal grid hanya render hari Minggu — baris pindahan `geser-18`
tak pernah ketemu slot 18 → chip "Geser →" + penanggung/tuan rumah hilang.
(2) `ServingWeekChannelCard` hanya render bila `!special` — setelah (1)
diperbaiki pun kartu WA tanggal efektif (Sabtu 17) tetap tak ada tempat tampil.

**Ubah (kode, 1 file):** `ServicePlanPanel.tsx` (specials dikunci
by `geserFrom ?? eventDate` → baris W3 tampil chip + grup + event pindahan;
kartu WA dirender untuk GESER dengan `date` = tanggal efektif + `key` agar
ganti tanggal reload; channel dibuat/dikelola untuk hari-H sebenarnya).

**Verifikasi:** `lint` bersih ✓ `service-geser` 12/12 + `worship-session-select`
11/11 + `serving-week` 6/6 ✓. Tanpa migrasi DB; tanpa tulis ke prod (audit saja).

**Next:** QA: baris W3 18 Okt tampil chip Geser → 17 Okt + Logos→Dunamis + kartu
WA 17 Okt (buat link WA + sesi Bedah Film baru dari UI).

**Deploy:** commit `536f40d` (3 file; HANDOFF hanya section sendiri via splice)
→ push main ✓ → `staging:sync` tuntas sekali jalan (deploy `gehcpage-2zf3av798`
Ready + 9 alias + verifikasi main = staging = `536f40d`) ✓.

## Current — Draft W3 nyangkut di sesi Rescue Plan W2 (13 Okt 2026)

**Laporan:** pola pekan W3 = Bedah Film (event sudah di 17 Okt prod), tapi tab Draft
masih tampil sesi Rescue Plan Monolog milik event 11 Okt.

**Akar:** `preferSession` (`worship-session-select.ts:19`) selalu menangkan `prevId`
selama sesi ada di list — ganti event W2→W3 tak me-reset `selectedId` (komponen tak
remount; `key` hanya `sessionEpoch`), jadi sesi W2 tetap terpilih + form/AI ikut
pola lama. Ditambah: pilih pola di katalog tak membuat sesi baru, dan fallback
`list[0]` mencot sesi event lain bila event aktif belum punya sesi.

**Ubah (kode):** `worship-session-select.ts` (prev dihormati hanya
bila se-event + se-pola; bila pola beda tapi ada sesi event yang cocok → pilih
yang cocok; event tanpa sesi → `''` = empty-state buat baru, bukan sesi event
lain) → `SessionDraftTab.tsx` (tipe event +`eventDate`; tanggal efektif sesi baru
ikut event WIB fallback pekan; slug prefill `sesi-<tgl>-<pola>` untuk non-Monolog;
teks empty-state sebut tanggal + link baru) → test
`worship-session-select.test.ts` (+5: prev beda event, prev beda pola, event tanpa
sesi; 11/11) → pemanggil (Draft + Kontrol) ikut tanpa ubah logika.

**Verifikasi:** `lint` bersih ✓ `test` 1113/1114 (1 flaky `lazy-routes` ChurchHub
timeout, pra-ada) ✓. Tanpa migrasi DB. Sesi 11 Okt tak tersentuh.

**Next:** QA staging (event W3 → katalog BEDAH_FILM → Draft lepas dari Rescue Plan
→ Buat sesi `sesi-2026-10-17-bedah-film` → AI → Terapkan → Kontrol).

**Deploy:** commit `ad3c85f` (4 file episode; HANDOFF hanya section sendiri via
splice, file paralel tak tersentuh) → push main ✓ (prod = ad3c85f) → branch
staging ✓ + deploy preview `gehcpage-f0a30cibe` (Ready) + 9 alias ✓ (semua
`/api/version` = ad3c85f).

## Current — UX detail Program Event P0 (deploy 1891ca9, 13 Okt 2026)

**Kebutuhan:** halaman detail event satu scroll terlalu panjang (header → Edit
venue/maps → Konten publik → bank Soal + request + approval → 6 divisi
Pre/During/Post → Pendaftar → Penatalayan 5 divisi → Rapat); user bingung cari
tombol Simpan + beda Nama internal vs Judul publik.

**Ubah (kode, 1 file):** `src/components/portal/EventWorkspacePanel.tsx`
(+282/−57) → 6 seksi collapsible (`konten/soal/divisi/pendaftar/penatalayan/rapat`,
status buka diingat per event di `localStorage`) + sub-nav lengket + checklist
Siap Terbit (Konten ✓/! dari `/content`, Soal N dari `/questions`, Tapisan N dari
`/penatalayan`, Divisi/Rapat dari state; klik = buka + loncat) + label
`Nama internal (panitia saja)` + catatan auto pola & PJ/Tuan Rumah + fix rentang
tanggal dobel + tombol aksi header `flex-wrap` untuk HP.

**Verifikasi:** `lint` bersih ✓ `test` 1109 lolos, 1 flaky timeout
`lazy-routes ChurchHub` (tak terkait) ✓ push `main` 1891ca9 ✓
`staging:sync` ✓ sama (`1891ca9`, alias staging-* terpasang).

**Next:** QA staging detail event (buka/tutup seksi, checklist loncat, persist
per event) → lanjut auto-fill pola ibadah + PJ/Tuan Rumah grup-only di landing
Kegiatan (disetujui: nama grup + label/status saja).

## Current — Movie Breakdown 2 ronde: Likert AWAL/AKHIR + delta + undi 2 (deploy 1891ca9)

**Kebutuhan (fokus movie):** pra-film Likert AWAL 5 item (baseline) → nonton → Deep 3Q
web → Likert AKHIR (5 item sama, lihat perbedaan) → komitmen + chip card → undi 2
kesaksian. Total ikut film (baku 170 = 80 + 90; 85→165).

**Ubah (kode, belum commit):** seed `BEDAH_FILM` ditulis ulang (15 fase main + 2 paralel
PRA, baku 170, modul +`likert/chips/wordcloud`; playbook §1–§7: F0/L0–L4, delta,
concern proyektor/dresscode/matras/konsumsi) → template draft `likert-film` (5) +
`lesson` (10 chip, kunci sama dgn MONOLOG) → AI `LIKERT_RULES` + `patternBlock` →
server `worship.mjs` (`cleanLikertRounds` + `likertRounds` di config/stage/payload,
POST likert `round` PRE/POST + gate + tanpa rank untuk film, apply-draft film tulis
10 item + chip, undi film 1+1 via `TESTIMONY_NEED_FILM`, CSV film PRE/POST+Delta,
`likertMeans`/`filmRoundMeans`, horizon start 3 jam anti-auto-wrapup) →
`session-engine.ts` (6 segmen + widget `likert` + progres + `filmLikertPairs/Means`) →
`PatternDay.tsx` (`FilmLikertCard` 2 ronde + panel delta + rekap PDF) →
`MentoringControl.tsx` (tombol M0–M4 + gate + chip film) → `MentoringScreen.tsx`
(panel delta layar) → `mentoring.ts` (tipe rounds/means) → test (+13:
template, engine, undi, rounds, AI likert) + selaraskan 2 test lama →
docs `pola-ibadah-hari-H` + `integrasi-divisi` + `worship-patterns` + `liturgia-lagu`.

**Verifikasi:** `lint` bersih ✓ `test` **1110/1110** (144 files; 1 flaky
`lazy-routes` lolos rerun) ✓ `build` OK ✓ `db:seed:worship:staging` ✓ baca-balik
OK (baku 170, 15+2 fase, modul lengkap, 7 heading + 4 slot).

**Deploy:** commit `2884dca` (18 file; seed + HANDOFF + rename paralel dikecualikan
via revert-restore/filter) → push main ✓ (paralel mendarat `1891ca9` di atasnya) →
`staging:sync` (2× timeout jaringan, lolos di retry) → main = staging = prod =
`1891ca9` ✓ (prod 200, staging-youth 401 tepat). File paralel tak tersentuh.

**Next:** QA staging tab Katalog + Draft Sesi film (isi AI likert+chip) → Terapkan →
sesi uji: M0 isi AWAL → M1 nonton → M2 deep → M3 isi AKHIR + cek delta layar →
M4 komitmen/chip + undi 2 → PDF + CSV.
`db:seed:worship:prod` HANYA atas persetujuan eksplisit. Follow-up: Battle (85+5+10,
mosi grup, moderator) + Semi Drama (draf 150) — pola lain tak disentuh.
Catatan: seed + HANDOFF masih campur kerja paralel (dibiarkan untuk mereka).

## Current — Geser SISTEMIK 18→17: satu aksi semua artefak ikut (deploy 9d95cff, 13 Okt 2026)

**Laporan:** ganti tanggal event 18→17 via Kondisi → Pratinjau + Simpan, info sudah ada,
tapi UI semua masih 18 (pill PROGRAM/EVENT, landing, Drive).

**Akar (3 lapis):** (1) Dua jalur simpan: `Simpan kondisi (PUT)` hanya tulis
`service_week_overrides` tanpa pindah baris; yang pindah hanya `Terapkan geser
(POST dryRun:false)`. PUT tak cek tabrakan → override yatim + `needsMove`, data
tetap 18. (2) `POST /geser` 409 karena 17 sudah terisi 2 baris — toast saja, tombol
Simpan tetap sukses. (3) Apply lama hanya pindah 2 tabel (assignment+event, jam
jadi midnight) tanpa rename `name/title`, tanpa pindah channel WA/schedule/sesi,
tanpa rename Drive — pill/landing/Drive tetap 18.

**Ubah (kode, belum commit):** `server/lib/service-events.mjs`
(`renameServiceDateSuffix`) → `server/lib/service-geser.mjs` (baru: `planGeser`
dry-run rinci + `applyGeser` transaksional: assignment, event+startDate (jam WIB
dipertahankan via `shiftInstantKeepTime`), rename name, content title, sessionDate,
schedule date, channel WA + eventId, timeline day; 409 bawa preview + label
penghuni) → `service-overrides.mjs` (POST pakai lib baru + rename Drive
best-effort; PUT GESER tolak bila bentrok/kosong) → `gdrive.mjs` (`renameFolder`)
+ `gdrive-events.mjs` (`renameEventFolders` by tag `[EV:slug:DIV]` + arsip, ID
tetap) → `ServicePlanPanel.tsx` (satu alur Pratinjau/Terapkan sistemik, daftar
tabrakan berlabel, Simpan dinonaktifkan untuk GESER, toast rinci + event
`gehc:events-changed`) → test `service-geser.test.ts` (+7: rename, plan, apply,
409, jam).

**Verifikasi:** `lint` bersih ✓ `test` 1102/1103 (1 flaky `lazy-routes`
ChurchHub timeout, lolos saat retry) ✓ `service-geser` 12/12 ✓. Tanpa migrasi DB.

**Next:** kosongkan 2 baris penghuni 17 di staging → dry-run `18→17` → Terapkan
sistemik → cek POV (ServicePlan chip, pill EVENT `17 Okt`, landing Agenda+detail,
caption WA `Sabtu 17`, folder Drive baru, QR/check-in jalan). Pekan materi tetap
W3 (by design); slug tetap.

**Deploy:** commit `9d95cff` → push main ✓ (prod `youth.gehc.page` = 9d95cff) →
`staging:sync` branch ✓ + deploy preview `gehcpage-3gyd19gxk` (Ready) + 9 alias
staging ✓ (semua `/api/version` = 9d95cff). Perhatian: `vercel deploy`/`alias`
sering `fetch failed` (jaringan) — retry per alias; jangan deploy ulang bila
preview sudah Ready (hemat storage).

## Current — Klik notif buka source SW: normalisasi URL push + navigasi (uncommitted)

**Laporan:** selaku admin selalu dapat notif, tapi saat dibuka malah tampil source
code `sw.js` sebagai halaman (iOS).

**Akar (2 lapis):** (1) pemanggil `pushToUsers` langsung mengirim `href: '#/portal'`
telanjang (`index.mjs:7856,8345`, `didaskalia-studio.mjs:437`, `notif-cron.mjs:275`,
`penatalayan-requests.mjs:68` + variabel `href` di 5 titik lain); `pushToUsers` tak
menormalisasi (hanya `notify()` yang normalisasi). `clients.openWindow('#/...')`
di-resolve browser relatif ke URL script SW → navigasi ke `/sw.js#/portal` → source
tampil. (2) event `pwa-notification-click` tak punya listener — app terbuka hanya
difokuskan tanpa navigasi.

**Ubah (kode, belum commit):** `server/lib/push-url.mjs` (baru: `normalizePushUrl`
murni — `#/x`→`/#/x`, `/x`→`/#/x`, absolut dipertahankan, kosong→`/#/portal`) →
`server/lib/notify.mjs` (`pushToUsers.data.url` pakai helper; menutup semua call
site sekarang + depan) → `server/lib/catalog-reminder.mjs` (sama) →
`public/sw.js` (normalisasi `#`-prefix sebelum `openWindow`, defense-in-depth) →
`src/lib/pwa-notification-nav.ts` (baru: listener `pwa-notification-click` →
pindah `location.hash`, guard same-origin + anti-duplikat) + panggil di `main.tsx` →
test `push-url.test.ts` (+5).

**Verifikasi:** `lint` bersih ✓ `test` **1096/1096** (144 files) ✓ `build` OK ✓
`node --check` sw + 3 lib ✓. Tanpa migrasi DB.

**Deploy:** commit `d7fd59e` (8 file episode; entri HANDOFF paralel dikembalikan
utuh tak ikut commit) → push main ✓ (sesi paralel mendarat `9d95cff` di atasnya) →
`staging:sync` tuntas → main = staging = `9d95cff` ✓ (prod 200, staging-youth 401
tepat). File paralel tak tersentuh.

**Next:** QA HP: kirim push uji → klik saat app tertutup (mendarat halaman tujuan)
+ saat app terbuka (fokus + pindah halaman). Catatan: notifikasi yang SUDAH tampil
di HP tak bisa diperbaiki retroaktif (data baked) — abaikan saja.

## Current — RHB Kitab Fokus statis + Bacaan porsi + Nats bervariasi (13 Okt 2026)

**Kebutuhan:** RHB ditulis mengikuti Kitab/Bagian Fokus Studio yang statis sepekan,
dengan Nats Pembimbing sebagai pengaya yang bervariasi per hari.

**Ubah (kode, commit `ba52cc5`):** prompt AI (`didaskalia-ai.mjs`: kitab = ACUAN STATIS,
bacaanRef HARUS subset progresif, scriptureRef = Nats pengaya beda tiap hari) →
parser MD (`didaskalia-md.mjs`: `**Bacaan:**` opsional; kosong = pertahankan) +
`applyRhbToPaths` tulis bacaan → editor Studio (banner kitab statis + placeholder
porsi + peringatan kuning bila kitab beda; `bacaanMatchesKitab` di `didaskalia.ts`) →
deck RHB (`didaskalia-presentation.ts`: field Kitab → Bacaan hari ini → Nats) →
PDF RHB (`didaskaliaPdf.ts`: header kitab statis + subtitle kitab; sebelumnya kitab
hilang di 7 PDF harian) → caption harian (kitab + bacaan + nats) + indeks RHB
(header kitab + per-baris bacaan/nats) → diff pengajuan (`Bacaan hari ini`) →
SOP `didaskalia-studio.md` §MD RHB → test baru `didaskalia-rhb-kitab-statis` (+6).

**Verifikasi:** `lint` bersih ✓ `test` 1089 hijau (+6 baru; 2 `lazy-routes`
timeout saat full-suite tapi 17/17 saat run sendiri = flaky beban) ✓ `build` OK ✓.
Tanpa migrasi DB (field sudah ada; pekan lama tanpa bacaan tetap tampil).

**Next:** push main + `staging:sync` → QA visual deck/PDF/caption RHB staging.

## Current — Rundown paralel + T0 + varian pembuka/persembahan MONOLOG (13 Okt 2026, uncommitted)

**Kebutuhan:** rundown di-breakdown (aktivitas paralel: registrasi Koinonia, check Diakonia,
slide Marturia, doa Komisi/Tim Kerja — total tak berubah) + tulis start/end time; draft relatif,
pekan ikuti jam mulai hari itu (13:00 = setelah doa petugas + tuan rumah); 1 waktu boleh
multi-divisi; praise & worship boleh diawali doa buka / nyanyian buka / keduanya; persembahan
dibuat opsi pisah syafaat + tutup (biasa diselipin lagu).

**Keputusan dikunci:** T0 = jam jemaat mulai (`EventProgram.eventDate`); PRA = kru T-minus di luar
total baku; 1 baris = 1 pemilik (multi-divisi = N baris se-grup paralel); pembuka menumpang 15';
persembahan PENUH +6' (120→127 jemaat, ambil toleransi penutup, inti 60' utuh).

**Ubah (kode):** `src/lib/worship-patterns.ts` (tipe `anchor/parallelGroup/track`, `patternVariant`
+ `DEFAULT_PATTERN_VARIANT`, `sanitizePatternVariant`, `patternTimeline/formatRangeRel/formatRangeAbs`,
`patternTotalMinutes` main-only + delta PENUH, `patternCongregationMinutes/patternPreMinutes`,
`patternParallelCheck`, `patternVariantText`, `DIAKONIA` + label varian) →
`server/routes/didaskalia-studio.mjs` (default/reset/PATCH `patternVariant`, `resolveWeekPattern`
16 fase + field penuh + `variant`, `resolveEventId` kembalikan `eventDate`, semua generate teruskan
`patternVariant`) → `server/lib/didaskalia-ai.mjs` (`patternBlock` baris Varian pekan) →
`PolaSesiPanel.tsx` (input jam T0 + Simpan ke event via `PATCH /api/events/:id`, prefill WIB,
403 ramah untuk Didaskalia) + `WorshipPatternCatalog.tsx` (kolom Waktu relatif/absolut, badge
T-minus/paralel, dropdown Pembuka/Persembahan pola aktif, warning paralel) →
seed `_seed-worship-patterns.cjs` (MONOLOG: doa petugas 5' main + check Diakonia/Marturia paralel,
registrasi 10' PRA, no 3/8 notes varian, playbook §1/§3/§4) → test `worship-patterns.test.ts`
(+9: timeline, format, check, varian, patternBlock) → docs `worship-patterns.md` §8 +
`pola-ibadah-hari-H.md` §5.

**Verifikasi:** `lint` bersih ✓ `test` **1083/1083** (142 files) ✓ `build` OK ✓
`node --check` seed + 2 route/AI ✓. Tanpa migrasi DB (semua JSON additive, fallback data lama).

**Next:** `db:seed:worship:staging` → cek tab Katalog (relatif T-minus + Waktu absolut event 13:00
→ pra 12:45–13:00) + dropdown varian + AI baca varian → commit + push + `staging:sync` →
`db:seed:worship:prod` HANYA atas persetujuan eksplisit. Follow-up: audit paralel 4 pola lain
(menit tak diubah episode ini).

**Deploy (13 Okt, ~10:45):** `db:seed:worship:staging` ✓ + baca-balik OK (MONOLOG: PRA/paralel/
varian tersimpan; main=120 jemaat=105 kru=15) → commit `3118b1a` (9 file episode; seed +
1 hunk docs DITAHAN milik sesi paralel) → push main ✓ → `staging:sync` ✓.
**Insiden hotfix (discovered via prod 500):** commit paralel `684c073` mengimpor
`server/routes/penatalayan-requests.mjs` yang tak ikut ter-commit → semua API prod
`FUNCTION_INVOCATION_FAILED`. Hotfix `103b874` (4 file server+test milik sesi paralel,
UI + screenshot tetap milik mereka) → push → prod `/api/version` = `103b874` ✓ pulih →
`staging:sync` ulang → main = staging = `103b874` ✓.
**Final (13 Okt, ~11:30):** dua putaran docs-only menyusul (`77f3b64`, `1fa0fdf`) —
tiap push picu rebuild prod + sapu alias staging.* (perilaku Vercel), selalu ditutup
`staging:sync` tuntas. Keadaan akhir: main = staging = `1fa0fdf` ✓. Verifikasi: prod
`/api/version` = `1fa0fdf` 200 ✓; `staging-youth` 401 ✓ (protection = tepat di
deployment staging `cc6jvm95s`). Kode fungsional identik sejak `103b874`.
**Catatan:** (a) file seed (isi episode ini + restruktur 12-fase paralel) masih uncommitted —
koordinasikan commit dengan sesi paralel, JANGAN `checkout` seed (staging DB sudah berisi);
(b) tiap deploy prod menyapu alias `staging.*` ke deployment prod — `staging:sync` WAJIB
dijalankan ulang setelah tiap push main (follow-up: pin domain staging.* ke branch staging
di dasbor Vercel); (c) migrasi tabel `penatalayan-requests` di prod BELUM jalan (butuh
persetujuan + sesi paralel) — endpoint-nya 500 sampai migrasi, tapi tak ganggu boot.

## Current — Family Tree hantu (Nicole): audit 10 rumah + always-sync (13 Okt 2026, uncommitted)

**Laporan:** Family Tree Echad `2026-09` menampilkan Nicole yang "sudah tidak
ada di database". Akar (prod, read-only): baris orphan `Nicole` Echad
`ACTIVE@2026-09` dengan `userId NULL` — tersembunyi di tab Anggota
(`visibleMembers` filter `!userId`) tapi TAMPIL di pohon. Kasus sekelas di
grup lain: `Gievara H. J. Bogar` (Metanoia orphan `ACTIVE@2026-09`) +
`Christofel David Pesoth` (Kairos: `User ALUMNI` tapi roster `ACTIVE`).

**Audit (`scripts/audit-family-tree.mjs`, READ-ONLY, report-only):**
- Staging: bersih (0 hantu; Nicole staging = `ACTIVE` tertaut user — sah;
  Veylicia `MOVED@2026-09` Kairos→Shalom = by-design, hanya riwayat).
- Prod: hantu `ALUMNI/PAST@berjalan`=0 · mismatch=1 (Christofel) · orphan=5
  (Echad 3: Nicole aktif + Chelsea/Nicole `2026-06`; Metanoia 2: Gievara
  aktif + `2026-06`) · `memberCount` drift (Agape 14vs13, Hesed 12vs11,
  Logos 11vs10) · nama ganda lintas grup=0 · `npm run audit:family-tree[:staging|:prod]`.

**Ubah (pohon berjalan = ACTIVE saja; riwayat tak berubah):**
`src/lib/family-tree.ts` (baru: `activeMentees`/`historyMentees`) →
`GroupDetailPage` (tab roster filter ACTIVE; tab riwayat tetap semua+badge) →
`ManageGroupsMonitoring` (tab family-tree + hitungan Mentee) →
`GroupsCarousel` (ganti filter inline) → `AppContext`: hidrasi diekstrak jadi
`refreshGroups()` (dipanggil pasca `add/update/deleteGroupMember` +
`RegenerationWizard` via perubahan `houses`); tulis `localStorage`
GROUPS/MEMBERS/BATCHES ditahan sampai server sukses pertama kali (anti
semen seed `Nicole Naray` di `initialData.ts`).
**Sync server:** `markNonaktifBulk` (ACTIVE→PAST) + `restoreActiveBulk`
(pulihkan ALUMNI@periode-berjalan; PAST lama tetap) di
`server/lib/member-role-sync.mjs`; `POST /bulk` + `PATCH /api/jemaat/:id`
kini sync untuk ALUMNI/NONAKTIF/ACTIVE (+snapshot NONAKTIF/REACTIVE);
`POST /api/groups/:id/members` isi `batchPeriod` periode berjalan (sebelumnya
null → invisible) + `refreshGroupCounts` di create/delete (atasi drift count).

**Verifikasi:** `lint` bersih · `test` **1076/1076** (142 files; 1 flake
`lazy-routes` di run pertama, hijau di rerun — pre-existing) · `build` OK ·
test baru `family-tree` (4) + `member-status-sync` (2).

**Next (TAHAN — butuh persetujuan):** (a) perlakuan baris orphan prod
(hapus Nicole/Gievara orphan vs tautkan ke User — report-only, tanpa ubah
DB); (b) sinkron `memberCount` drift (Agape/Hesed/Logos); (c) QA staging
(`staging:sync` lalu cek pohon Echad/Metanoia/Kairos + tab Anggota);
(d) E2E hapus→pohon (deferred). Commit + push per batch (episode ini
uncommitted; JANGAN `git add -A`).

**Update 13 Okt (apply disetujui user):** `scripts/fix-family-tree-orphans.mjs`
(dry default, `--apply` menulis; `fix:family-tree:prod[:apply]`):
- Dry-run: Nicole & Gievara orphan → 0 kandidat User → hapus; Christofel →
  roster ALUMNI; drift Agape/Hesed/Logos.
- Apply prod: hapus orphan `Nicole ACTIVE@2026-09` (Echad) + `Gievara
  ACTIVE@2026-09` (Metanoia) — sebelumnya gagal FK `attendance_records`,
  skrip kini hapus absensi baris itu dulu (sama seperti handler portal);
  Christofel Kairos → `ALUMNI`+`alumniDate`; recount `memberCount`
  (Echad 13→12, Agape 14→13, Hesed 12→11, Kairos 11→10, Logos 11→10,
  Metanoia 11→10).
- Re-audit prod: mismatch=0 · orphan tampil-pohon=0 · count selaras · Nicole
  tersisa hanya `PAST@2026-06` (riwayat, tak tampil di pohon berjalan).
  Label audit `HANTU`→`ARSIP` + orphan注明 tampil/tidak (pasca-fix kode,
  non-ACTIVE tak pernah render di pohon).
- Commit script+label; push main (= deploy prod, pohon Christofel hilang
  setelah live) + `staging:sync` + QA staging menyusul di bawah.

**Update 13 Okt (push+sync+QA):** commit `9f33a9e`
(`fix(family-tree): hapus orphan Nicole/Gievara prod + audit ARSIP`) → push
main OK (prod deploy dari main) → `staging:sync` OK (version staging vs main
`9f33a9e` ✓ sama + alias unit). QA: bypass staging tak tersedia di env
  lokal, jadi smoke API lokal `PORT=8789 GEHC_ENV=staging` (server QA
  dimatikan setelahnya): `/api/db/groups` → Echad `2026-09`
  (Holly K./Aditya W., mentee non-ACTIVE=0) · Kairos (`ACTIVE:8 MOVED:1` =
  Veylicia by-design, disembunyikan kode) ✓. Sisa visual: konfirmasi user di
  `staging-youth` (pohon Echad tanpa Nicole; Kairos tanpa Christofel) +
  prod `youth.gehc.page` setelah deploy live.
- Push `d17fe4a` ke main OK + `staging:sync` OK (version `d17fe4a` ✓ sama)
  atas permintaan user — episode selesai.

## Current — Preview 2 variasi Pelsus: V1 `#/pelsus/` vs V2 `#/pelsus2/` by-person (10 Okt 2026, uncommitted)

**Kebutuhan:** 1 orang bisa 2–3 surat suara (contoh: Kolom 3 + Pemuda); alur
basis by-person (akun: pilih berurutan sekaligus; tanpa akun: paket token +
bilik berantai); preview 2 variasi via routing berbeda, data SIMULASI saja.

**Temuan:** fondasi sudah by-person — `PelsusVoter @@unique([electionId,
userId])` mengizinkan 1 userId di N election; sync DPT BIPRA/KOLOM otomatis
menempatkan orang Pemuda+kol-3 di 3 surat suara. Gap hanya UX (per-election)
+ token per-surat + tanpa perkakas cari-orang. Disetujui: DPT = validasi
(tanpa gate check-in), paket token + bilik berantai, view panitia baru,
prefix `pv2-` (bukan `sim-` agar tak ikut terhapus `pelsus:sim`).

**Ubah:** `lib/pelsus2.ts` (baru: parse/build `pelsus2`, `?sim` filter
`pv2-/sim-`, antrean `?tokens=A,B`, `nextUnvoted`, `myBallotProgress`) →
`lib/host-context.ts` (`isPelsus2Hash`, nol tabrakan dua arah dengan V1) →
`server/routes/pelsus.mjs` (`groupVotersToPeople` murni +
`GET people/search` + `POST tokens/batch`, admin-only) →
`components/pelsus2/Pelsus2App.tsx` (baru: HomeV2 section "Surat suara saya
X/N" + DetailV2 tombol lanjut + BilikV2 berantai + PanitiaView cari-orang;
TurnoutBar/QuorumBadge/GuideCard/AdminPanel/LayarView/api reuse via export
dari V1 — V1 tak berubah perilaku) → `main.tsx` (lazy chunk V2 21,7 kB) →
`seed-pelsus-preview.mjs` + npm `db:seed:pelsus:preview[:staging]` (3 election
pv2-* + 2 kandidat + DPT: 1 akun multi + 2 manual; guard dupe findFirst, 2×
rerun = +0) → `pelsus-panduan.md` §12 (tabel link + 3 skenario uji +
kriteria keputusan) → test `pelsus2.test.ts` (13: routing non-telan,
queue, next, progress, grouping) + `lazy-routes` (+1 modul).

**Data (lokal):** `pv2-*` seeded ✓ (3 elections DRAFT + 6 kandidat + 9 DPT);
`sim-v2-*` percobaan awal DIBERSIHKAN (guard 0 ballot) agar tak bentrok.

**Verifikasi:** `lint` bersih ✓ `test` **1059/1059** (138 files, tanpa flake)
✓ `build` OK ✓ smoke API lokal port 8788: people/search grup 1 orang × 3
elections ✓ batch 3 token ✓ bilik ok + ganda ditolak + rantai surat-2 ok ✓
cleanup reset+DRAFT ✓. Catatan: smoke pertama 404 karena menabrak server
:8787 milik sesi paralel (kode lama) — selalu pakai PORT≠8787 untuk smoke.

**Next:** (a) `db:seed:pelsus:preview:staging` + buka pv2 via panel; (b) klik
manual V1 vs V2 di staging-youth ikut §12; (c) putuskan pemenang → promosi ke
`#/pelsus`, hapus varian kalah. Commit + push per batch (file episode ini +
episode 18-Okt masih uncommitted).

**Update 11 Okt (sisa dikerjakan):** commit `9e9264c` (lokal, main) ✓; staging
DB = cluster bersama `.env` — 19 pel-* ternyata sudah hilang (0 ballot) jadi
tanpa reset, langsung `db:seed:pelsus:staging` → 19 elections 18 Okt + 209
DPT ✓ + pv2-* (pra-seeded, 9 DPT) ✓; `staging:sync` → deploy `9e9264c` + alias
✓ (verify-vs-main "belum sama" = wajar, staging di depan prod); smoke staging
(22 elections, judul11=0/18=19/pv2=3, people/search 1×3) ✓; QA visual lokal
(build prod + Vite 3001 + API 8789): bilik berantai "Surat 1 dari 3",
HomeV2 "Sudah 0 dari 3", DetailV2, PanitiaView cari→Paket Token/Manual —
screenshot `v2-*.png` ✓; TANPA vote (staging pristine: 22/0 ballot/0 OPEN) ✓;
server QA dimatikan. Catatan: port 8787 milik sesi paralel (pakai 878x lain);
`vercel env pull` untuk BASIC staging (file secret sudah dihapus).
**Tahan:** reseed `:prod` + merge/push main→prod = butuh persetujuan eksplisit.

## Current — Tabel pipa md-lite + rundown MONOLOG 1 tabel + hapus ringkasan atas (10 Okt 2026, uncommitted)

**Kebutuhan:** playbook §3 tampil sebagai tabel beneran (tiap pola punya
rundown sendiri; MONOLOG jadi acuan); hapus baris ringkasan paling atas;
screenshot user = data prod basi.

**Ubah (kode, episode ini):** `md-lite.tsx` blok baru `table` (parse header +
pemisah + baris; fallback paragraf bila tanpa pemisah agar teks tak hilang) +
render `<table>` per tone (`paper` gelap; `overlay`/`plain` terang) →
`didaskaliaPdf.mdTable` (paritas baca tanpa grid; wajib agar lint hijau) →
kartu katalog guard `{p.summary &&}` (ringkasan kosong tak sisakan gap) •
test `md-lite.test.ts` (+4: parse, fallback, render paper/overlay).
**Seed (di atas basis paralel, BELUM commit):** MONOLOG §3 list → tabel pipa
12 baris terbaru (No/Segmen/Menit/Owner/Naskah kunci, redaksi fase penuh) +
`summary: ''`.

**Data:** staging re-seed ✓ baca-balik: nama baru, summary kosong, 12 fase /
120', §3 = 14 baris pipa (header+pemisah+12), §1 + judul nama baru.

**Verifikasi:** `lint` bersih ✓ `md-lite` 17/17 ✓ `build` OK ✓. Suite penuh:
1 gagal milik sesi paralel (`lazy-routes` → `pelsus2/Pelsus2App.tsx` belum
dibuat mereka; tak disentuh).

**Next:** commit file episode ini (seed tetap milik paralel) → push → reseed
PROD (disetujui) → cek visual tab Pola Ibadah.

## Current — Deck 18 slide + BPPJ (9 Okt 2026, uncommitted)

**Kebutuhan:** BPPJ (belum ada di Cikarang) masuk deck + concern cashflow
+ tanggung jawab statuter.

**Ubah:** slide `bppj` baru (posisi 11) + serah-terima diperkuat
(verifikasi BPPJ pre-tandatangan) + keputusan 9 butir • docs: §VIb BPPJ
+ matriks penegak aturan-perantau • test 17→18 + footnote ter-resolve.

**Verifikasi:** `lint` bersih ✓ 33 test hijau ✓ tanpa migrasi.
Catatan sesi paralel: batch Pelsus 18 Okt berjalan (jangan sentuh file
pelsus/*, schema.prisma, migrate/seed terkait).

**Next:** commit + push + sync + verifikasi live.

**Deploy (10 Okt):** commit `d2040f2` → push main ✓ (di atas push sesi
Pelsus `81d6761`, tanpa konflik) → prod `/api/version` = `d2040f2` ✓
(deck 18 slide live) → `staging:sync` penuh ✓ (versi sama).

## Current — Pelsus 11 → Minggu 18 Okt 2026 (10 Okt 2026, uncommitted)

**Kebutuhan:** pemilihan Pelsus mundur ke 18 Okt 2026 (hari Minggu — koreksi
"Sabtu" di panduan). Disetujui: sapu bersih scope Pelsus + DB reset & seed ulang.

**Ubah (14 file, string tanggal saja):** `PelsusApp.tsx:99,140` (H1 + empty
state) → `seed-pelsus.mjs` (header + 3 template judul) →
`pelsus-panduan.md:1,50` (judul + WA `Minggu 18 Okt`) → komentar/label:
`lib/pelsus.ts`, `lib/host-context.ts`, `main.tsx`, `routes/pelsus.mjs`,
`_migrate-pelsus.cjs`, `schema.prisma`, `db-migrate-local.mjs`,
`playwright.pelsus.config.ts`, `pelsus-simulasi.spec.ts`,
`host-context.test.ts`. TIDAK disentuh: ibadah 11 Okt Rescue Plan
(didaskalia/worship/liturgy/event-select + script khutbah/QA) + riwayat
HANDOFF lama.

**Verifikasi:** `lint` bersih ✓ `test` 1043/1044 (1 flake `lazy-routes`
ChurchHub-timeout, hijau di rerun) ✓ `rg 11 Okt` di 14 file = 0 sisa ✓.

**Next (BELUM jalan — butuh pre-check + persetujuan):** (a) pastikan 0 suara
di staging+prod (`results.ballotCount`); bila >0 STOP; (b) staging: hapus 19
elections lama (`DELETE /api/pelsus/:id`, tutup dulu bila OPEN) →
`npm run db:seed:pelsus:staging` → cek 19 judul `18 Okt`; (c) prod sama via
`:prod` + input ulang kandidat DRAFT. Opsional: `npm run pelsus:sim` untuk
refresh 5 klip video (header UI ikut ganti tanggal).

## Current — Playbook readable di kartu putih + nama Monologue & Dialogue + rundown single-source (10 Okt 2026, uncommitted)

**Kebutuhan:** (1) teks Draft Template tak terbaca (putih-di-atas-putih, baru
muncul saat select); (2) standarkan nama pola `Monologue & Dialogue`;
(3) dua penulisan rundown — mau konsep tabel (fase) dengan isi naskah kunci
penuh. Diputuskan: rundown 12 fase seed baru = kanonis.

**Temuan:** `MdBlocks tone="plain"` bertinta putih (untuk permukaan gelap +
cetak) — cocok untuk slide deck tanpa foto (artikel `bg-[#0B1220]`), tetapi
`PlaybookView` memakainya di kartu `bg-white` → isi tak terlihat, hanya bold
`sky-300` yang samar. DB staging/prod masih berisi MONOLOG lama (6 fase, nama
lama); seed working-tree sudah 12 fase + English-only (milik sesi paralel).

**Ubah (kode, milik episode ini):** `md-lite.tsx` tone baru `paper` (tinta
layar gelap `#1B1B1B`/`#8C8880`/`sky-700`, panel amber terang; `overlay`+`plain`
tak disentuh) → `WorshipPatternCatalog` PlaybookView `plain`→`paper` →
fallback nama `DidaskaliaStudioPanel:1368` + `didaskalia-studio.mjs:253` →
`Monologue & Dialogue` → `pola-ibadah-hari-H.md` heading → varian (isi varian
170' dibiarkan) • test `md-lite.test.ts` (+2 guard: paper tanpa `text-white`).
**Seed (di atas basis paralel, BELUM commit — file milik sesi paralel):**
`notes` fase 3/4/5/6/8 MONOLOG diperkaya redaksi naskah kunci (terang tema
pekan, eksposisi→aplikasi→panggilan, Q berurutan, chip Lesson Learned maks 3,
ayat penutup Firman pekan; tanpa slot mentah karena notes tabel dirender
mentah; Satu Kata dipetakan ke chip Lesson Learned).

**Data:** `db:seed:worship:staging` ✓ baca-balik: nama `Monologue & Dialogue`,
12 fase, total 120', semua berdivisi, 5 notes naskah, §3 tanpa tabel pipa,
7 heading + 4 slot lengkap.

**Verifikasi:** `lint` bersih ✓ `test` 1044 hijau (1 flake `lazy-routes` di
satu run, hijau di rerun) ✓ `build` OK ✓.

**Next:** commit file episode ini (JANGAN seed — tunggu sesi paralel) → push
main + cek visual tab Pola Ibadah → `db:seed:worship:prod` HANYA dengan
persetujuan eksplisit. Follow-up: 4 tabel pipa pola lain
(POST_TO_POST/DEBAT/BEDAH_FILM/3SEQ §3) masih tembok teks — konversi ke list;
`simulasi-more-than-good-news.md` (artefak 6 Okt) sengaja tak diubah;
`liturgy-live` baca jangkar sebagai bacaan (open).

## Current — Fix swap Korintus↔Kolose W2 + verifikasi bolls.life TB/KJV/ESV (10 Okt 2026, uncommitted)

**Kebutuhan:** prod W2 Rescue Plan (11 Okt): pembekalan menampilkan isi Kolose di
ref Korintus (atau sebaliknya); user mau 100% ikut isi Alkitab. Pakai bolls.life
(TB + Inggris) sebagai canonical, koreksi manual + warning (tanpa auto-overwrite).

**Temuan audit prod:** ref BENAR (`teksUtama=2 Korintus 5:21`,
`fundamentalFirman=Kolose 1:13–14`), tetapi **isi tertukar** — `teksUtama.text`
berisi Kol 1:13-14, `fundamentalFirman.text` berisi 2Kor 5:21. Outline 4 bagian
benar (Bedah=Korintus, Jembatan=Kolose). Efek tampak: cover pembekalan callout
berlabel Kolose berisi ayat Korintus + PDF §Inti Pesan sama.

**Ubah (kode):** `server/lib/bolls.mjs` (baru: provider bolls.life tanpa key —
`TB` kanonis, `KJV`/`ESV` pembanding, `NIV*` ditolak/disabled karena ablated
Biblica, bookid 1–66 sinkron `bible-books.ts`, strip tag Strong HTML, cache
30 hari, `verifyVerse`) → `GET /api/bible/verify?ref=&ref2=&versions=`
di `server/routes/didaskalia-studio.mjs` (read-only, `requireRole()`, tanpa
tulis DB) → `DidaskaliaStudioPanel` tab khotbah: tombol Verifikasi + badge
✅/⚠️ + Salin kutipan TB (tempel manual) + detail KJV/ESV → cover pembekalan
callout dilabel tegas `Teks Jangkar Mingguan · <ref>` (sebelumnya label ref
telanjang) • test `tests/unit/bolls.test.ts` (+14).

**Data (prod, applied + history):** `scripts/fix-w2-swap-tekskanonik.mjs` —
`teksUtama.text` = 2Kor 5:21 TB + `fundamentalFirman.text` = Kol 1:13-14 TB
(verbatim bolls.life live), ref & outline tak diubah, history 6→7 (undoable).
Teks kanonis: Korintus = "Dia yang tidak mengenal dosa telah dibuat-Nya
menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.";
Kolose = "Ia telah melepaskan kita dari kuasa kegelapan dan memindahkan kita
ke dalam Kerajaan Anak-Nya yang kekasih; di dalam Dia kita memiliki penebusan
kita, yaitu pengampunan dosa."

**Verifikasi:** `lint` bersih ✓ `test` 1040 hijau + bolls 14 (1 flake
`lazy-routes`, lolos rerun isolasi) ✓ `build` OK ✓ render deck lokal: callout
jangkar + field utama benar ✓. Tanpa migrasi DB.

**Next:** commit file episode ini → push main (deck web + tombol verifikasi
live buat besok) → cek prod `#/materi/pembekalan/2026-10/2` + `#/materi/khutbah/2026-10/2`
→ publish ulang doc 01/02 dari Studio bila PDF Drive masih versi swap.
Follow-up (belum): `kitabFokus` W2 masih `Kol 1:13-14` (duplikat jangkar,
dibiarkan); `liturgy-live` baca `fundamentalFirman` (jangkar) sebagai bacaan —
konfirmasi apakah harusnya Teks Utama.

**Sengaja tidak disentuh:** `HANDOFF.md` entri atas + `docs/product/*.md` +
`server/_seed-worship-patterns.cjs` (milik sesi paralel).

## Current — MONOLOG 4-trigger + Lesson chip ganti Satu Kata (9 Okt 2026, uncommitted)

**Kebutuhan:** alur kontrol↔layar koheren (Bedah Lagu→Monolog→Diskusi→Lesson→Komitmen);
Satu Kata → chip Lesson Learned ala Post-to-Post; undi bebas 3 + grup; sapaan personal.

**Ubah:** template draft `lesson` 10 chip + `CHIP_RULES` AI + `apply-draft` MONOLOG buat
chip → `start` auto-Q3 + `config.discussion` (stage/payload/`DiscussionPanel` + countdown
layar/HP) → undi MONOLOG bebas-3 + `groupName` (pool `groupMember`, `composePicks` teruskan,
`TestimonyPanel/Wheel` tampil grup) → engine `satu-kata=Lesson Learned` (`chips+testimony+download`;
`lagu=song+notes`; hapus slot `SATU-KATA`; `segmentForPattern` sadar diskusi) → `PatternDay`
widget chip + `Thank you, {nama}` + PDF seksi Lesson + sapaan cover → layar WRAPUP gabungan
(word cloud + undi; vote awal tak sembunyikan FGD) → kontrol label per pola + editor chip
dibuka untuk MONOLOG → test (+8: segmen, `cleanDiscussion`, bebas-3+grup, CHIP_RULES, config).

**Sengaja tidak disentuh:** `server/_seed-worship-patterns.cjs` (modul `chips/wordcloud` MONOLOG +
playbook §5/§7 — file sedang dipakai sesi paralel) + `docs/product/*.md` (dirty paralel).
Follow-up: seed ulang modul + selaraskan playbook/summary. Kompatibel mundur: agregat
SATU-KATA + `allowedNoteCodes` tetap (sesi lama terbaca).

**Verifikasi:** `lint` bersih ✓ `test` 1023 hijau (2 flake `lazy-routes` timeout, lolos
rerun isolasi) ✓ tanpa migrasi DB (semua `config` JSON).

**Next:** commit + push + `staging:sync` → staging: event 11 Okt → Draft Sesi isi AI
(FGD+lagu+deep+lesson) → Terapkan (assert chip N) → Start (Q1-Q3 terbuka) → Mulai Diskusi →
Q4/Q5 → Wrapup (chip + undi 3) → Tutup (PDF personal).

**Fix #310 (9 Okt, menyusul):** `toggleChip`/`submitChips` di `PatternDay.tsx` tertulis di
bawah early return loading→ok = hook count berubah antar-render ("Rendered more hooks").
Dipindah ke atas semua guard; audit komponen mentoring lain bersih. Verifikasi: lint ✓,
unit terkait ✓, `vite build` ✓.

**Fase 60' (9 Okt, menyusul):** `config.phase {F1 20'/F2 25'/F3 10'/CLOSING 5'}` eksplisit ganti
`discussion`; `start`→F1+horizon 3 jam (bungkam auto-wrapup), `wrapup`→F3; kontrol 4 tombol
fase + `+5 mnt fase` (panel Q manual dihapus); HP countdown per fase (F1 tanpa timer) +
slot per fase; layar standby→loop Q→winners+cloud→penutup; segmen ke-6 `penutup`.
Verifikasi: lint ✓, suite 1025 hijau ✓, `vite build` ✓.

**Rundown 120' 12 fase (9 Okt, menyusul):** seed MONOLOG ditulis ulang (persembahan pindah
setelah Closing; ramah-tamah paralel→terima kasih; tiap fase bawa `division` + owner =
daftar peran). Katalog: kolom Cakupan + naskah via md-lite + slot jadi kata biasa
(konvensi: DB mentah, UI selalu render). Kontrol: badge divisi; prompt AI bawa `[cakupan]`.
Verifikasi: lint ✓, suite ✓, build ✓, re-seed staging ✓ baca-balik (12 fase, 120 mnt,
4 divisi, 7/7 heading, 4/4 slot; sesi + soal + chip utuh; 0 migrasi).
Sisa: commit file seed (tunggu sesi paralel — berisi rename mereka) + `db:seed:worship:prod`
(menunggu persetujuan eksplisit).

**Crosscheck penatalayan H-1 (11 Okt, menyusul):** `server/lib/petugas-crosscheck.mjs` murni
(cocok eventId ATAU null+tanggal WIB sama; ringkasan konfirmasi/kehadiran) → `GET check-ins`
balas `petugas{summary,byDivision,list}` + `event.date` → `EventCheckInTab` seksi Penatalayan
(mode pra-event: kesiapan H-1 + missing; mode live: split petugas/jemaat + flag belum
tercatat). Aksi konfirmasi tetap di alur penatalayan; auto-mark tak berubah.
Verifikasi: lint ✓, suite 1066 hijau (1 flake lazy-routes lolos isolasi) ✓, build ✓.

**POV rapih (11 Okt, menyusul):** tab Panduan → Sambutan personal (nama + Rescue Plan +
pesan positif; akses dibuka/tunggu), tab Komitmen dihapus (komitmen tetap field di
Penutup) → stepper 5 tab; undian manual multi-select (search user + endpoint
`testimony/manual`, jalan walau pool kosong). Verifikasi: lint ✓, suite 1042 hijau
(1 flake lazy-routes lolos isolasi) ✓, `vite build` ✓.

## Current — Deck 17 slide + celengan + Kolom 1 (9 Okt 2026, uncommitted)

**Kebutuhan:** dua bendahara (BPMJ vs Pembangunan), aliran celengan
150rb/500rb earmarked, Kolom 1 bubar via atestasi.

**Ubah:** §VIa (dua bendahara + celengan + Kolom 1) • aturan-perantau
(studi Kolom 1) • SOP BZP (tujuan setor BPMJ vs Pembangunan) • deck:
slide `celengan` + glosarium Celengan + keputusan 8 butir (deck 17).

**Verifikasi:** `lint` bersih ✓ 33 test hijau ✓ tanpa migrasi.

**Next:** commit + push + sync + verifikasi live.

**Deploy (9 Okt, ~17:30):** commit `81260ab` → push main ✓ → prod
`/api/version` = `81260ab` ✓ (deck 17 slide live) → `staging:sync`
penuh ✓ (branch + build + semua alias incl. districts/community, versi
sama). File sesi paralel tak tersentuh.

## Current — Deck 16 slide (sumber dana + serah terima + visi portal) (9 Okt 2026, uncommitted)

**Kebutuhan:** slide sumber pendapatan + serah terima saldo pre-18 Okt +
visi 100% via gehc.page + training pengurus baru.

**Ubah (kode):** 3 slide baru (`sumber-dana`, `serah-terima`,
`arah-depan`) + keputusan 7 butir + penomoran kicker; tanpa nominal
(struktur saja); footnote pakai istilah existing.

**Verifikasi:** `lint` bersih ✓ 33 test hijau ✓ tanpa migrasi.

**Next:** commit + push main + `staging:sync` + verifikasi live.

**Deploy (9 Okt, ~17:00):** commit `6c83176` → push main ✓ → prod
`/api/version` = `6c83176` ✓ (deck 16 slide live) → origin/staging =
`6c83176` ✓. Staging preview deploy: retry-1 gagal fetch, retry-2
timeout tanpa output — status alias staging tak pasti (non-bloking;
presentasi pakai produksi). Jalankan `staging:sync` ulang bila perlu.

## Current — Deck 13 slide + footnote glosarium (9 Okt 2026, uncommitted)

**Kebutuhan:** semua materi baru (kas/ABPJ 2 pos, DAP 2 mekanisme, BZP
fleksibel Sabtu/kampus) masuk deck + tiap istilah ber-footnote.

**Ubah (kode):** `server/routes/paparan.mjs` — deck 11→13 slide (baru:
`kas`, `dap`; matriks/BZP/suksesi/keputusan dimutakhirkan) +
`PAPARAN_GLOSSARY` (23 istilah) + `footnotes[]` per slide (isi hanya via
API) • `BpmjPaparan.tsx` — blok "Catatan istilah" per slide (web + cetak)
• test: guard 13 slide + glosarium unik + tiap footnote ter-resolve.

**Verifikasi:** `lint` bersih ✓ 33 test hijau ✓ tanpa migrasi.

**Next (butuh perintah):** QA visual footnote + push main + `staging:sync`.

**Deploy (9 Okt, ~16:00):** commit `cec78f9` → push main ✓ (prod
auto-deploy berjalan) + `staging:sync`: branch staging = main ✓, build
staging lolos (chunk BpmjPaparan ada) ✓, alias staging*.gehc.page
terpasang s/d staging-men (timeout CLI saat alias sisa: women/districts/
community — cek + pasang manual bila perlu).

## Current — Master Database pos pengeluaran (9 Okt 2026, uncommitted)

**Kebutuhan:** database semua pos pengeluaran (Master vs seleksi GEHC);
fakta sewa ruko a.n. gereja ±70 jt/thn (bukan bangun); tetap 2 pos.

**Ubah (docs saja):** `tata-gereja-gmim.md` §VIa ditulis ulang — 7 sumber
+ MASTER 1.1–1.10 & 2.1–2.6 berkode stabil (2.5 konstruksi = Tak-relevan
cadangan masa depan) + seleksi GEHC 2 pos (Diakonia & Beasiswa di dalam
Pelayanan; Pembangunan = "sewa & rawat, bukan proyek bangun") + sewa
a.n. gereja ✓ + satu-pemilik + DAP 2 mekanisme • SOP BZP: hasil usaha =
sumber #5 + butir tanya basis ABPJ dipertajam.

**Verifikasi:** `lint` bersih ✓ tanpa migrasi. Kode master (seed tabel
pos) menyusul bila diminta.

## Current — Perbendaharaan + SOP BZP fleksibel (9 Okt 2026, uncommitted)

**Kebutuhan:** sumber pendapatan masuk md; BZP 3 domain tanpa redundan;
DAP 2 mekanisme; fundraising bisa Sabtu/weekday + kolaborasi kampus
(President University).

**Ubah (docs saja):** `tata-gereja-gmim.md` §VIa baru (7 sumber rutin +
aturan satu pemilik + DAP kasbon vs pungutan khusus + contoh event/AC) •
`komisi-kerja-sop-bzp.md` §4 ditulis ulang (jadwal fleksibel + order per
pelaksanaan + kolaborasi internal 100% + kolaborasi eksternal (bagi hasil
putusan BPMJ, kas satu pintu) + kas ganda di event Panitia + larangan
pungut kolekte/syukur).

**Verifikasi:** `lint` bersih ✓ tanpa migrasi.

## Current — Rute paparan BPMJ khusus pimpinan (9 Okt 2026, uncommitted)

**Kebutuhan:** naskah presentasi BPMJ (11 slide) tampil di routing
gehc.page, hanya dibuka BPMJ + KOMISI + SUPERADMIN.

**Ubah (kode):** `#/paparan/bpmj-2026-10` — `isPaparanHash`
(`host-context.ts`) + `paparan-routing.ts` (parse allowlist + test) +
cabang `main.tsx` + `BpmjPaparan.tsx` (DeckShell, state auth/forbidden,
TANPA tombol bagikan, Cetak → PDF) + `server/routes/paparan.mjs`
(`GET /api/paparan/bpmj-2026-10`, `requireRole(SUPERADMIN,BPMJ,KOMISI)`;
isi deck hanya via API, tak dibakar ke bundle) + registrasi
`server/index.mjs` + `lazy-routes.test.ts` + `portal-place.ts`/`DeckShell`
kecualikan `#/paparan` dari last-place (anti loop keluar).

**Verifikasi:** `lint` bersih ✓ 32 test hijau (routing 3 + guard 13 incl.
matriks 401/403/200 + lazy 16) ✓ `node --check` OK ✓ tanpa migrasi.

**Deploy:** commit `74e17cf` → push main ✓ → prod `/api/version` =
`74e17cf` ✓ (terverifikasi live). Rute `#/paparan/bpmj-2026-10` aktif di
produksi. Laporan user (alvandisarang, "tidak terbuka") = kode belum
ter-deploy saat itu; diminta coba ulang. Cadangan bila 403: cek peran
Akun Saya (butuh SUPERADMIN/BPMJ/KOMISI) atau coba
`youth.gehc.page/#/paparan/bpmj-2026-10` (scoping tenant).

**Catatan sesi paralel:** `integrasi-divisi.md`, `worship-patterns.md`,
`_seed-worship-patterns.cjs` berubah di sesi lain — JANGAN sentuh/commit
file itu. Commit file paparan + docs tata-gereja saja bila diminta.

**Next (butuh perintah):** QA visual (tanpa login → minta login; Mentee →
ditolak; Komisi → 11 slide + cetak) → commit + push + `staging:sync` →
Fase atestasi → knowledge + ask.

## Current — Aturan perantau + suksesi komisi (9 Okt 2026, uncommitted)

**Kebutuhan:** bahan diskusi internal BPMJ — realitas perantau (3–4 thn,
time-boxed kuarter/semester/1 thn) vs syarat Tata Gereja; pola task force
PHRG/H2RG, Kostor weekly/monthly, rotasi THL kuarter; suksesi BOD Tim
Kerja → Komisi Pemuda (masa berakhir 2026, trio minus sertifikat).

**Ubah (docs saja):** `docs/product/aturan-perantau.md` (baru: dua jalur
struktural/fungsional + format pengecualian sah + pagar tak-bisa-dinego +
gerakan atestasi + sertifikasi kuarteran + pool/cadangan tanpa Sidang +
matriks lintas BIPRA/Kolom + timeline pemilihan Q4 2026 + contoh suksesi)
• `tata-gereja-gmim.md`: mekanisme Rapat Pemilihan + lowong (Pasal 33–37)
+ catatan diskrepansi masa "5 thn vs siklus 4 thn" + pointer aturan •
indeks `docs/README.md`.

**Keputusan terkunci:** suksesi via Rapat Pemilihan (didukung, bukan
diangkat); sertifikat = critical path sebelum hari-H; fleksibilitas via
kontrak tahunan + pintu lowong, bukan SK diperpendek; idle tak perlu
Pasal 37 (masa berakhir); cek sidi/non-Pelsus + klarifikasi masa SK.

**Verifikasi:** `lint` bersih ✓ (docs-only, tanpa migrasi).

**Next (butuh perintah):** Fase portal atestasi (1 migrasi: status + asal
+ tanggal + certificates JSON) → pool/cadangan via isActive/expiresAt →
knowledge + ask → label UI KOMISI/BPMJ.

## Current — Tata Gereja GMIM + SOP BZP (9 Okt 2026, uncommitted)

**Kebutuhan:** acuan Tata Gereja mengacu SMSI-82 + kejelasan Tupoksi 4 peran
internal (Pembangunan, Kostor+asisten, THL 4+4 tanpa SK 2 thn + nombok
pribadi, BZP 6 orang pola kas-Minggu 100%) + rencana fitur ask.

**Ubah (docs saja):** `docs/product/tata-gereja-gmim.md` (baru: Pelsus,
Sidang, BIPRA + delta SMSI-82 ex-officio/AMS/BPMW ber-tag RESMI/LIPUTAN,
Komisi Kerja Pasal 38 + contoh Musik, Kostor/Pegawai, tabel pertimbangan
4 peran EH Cikarang) • `docs/product/komisi-kerja-sop-bzp.md` (baru: dual-line
BPMJ/Bendahara, susunan 6 orang + segregasi, 4 pagar rekening operasional,
aturan order H–7 + default/kolaborasi 100%, draf SK + 2 format berita acara)
• disclaimer SMSI-82 di `userflow/pantatugas/unit-portals` + heading §3.5
→ "Kolom — bukan Wilayah" • indeks `docs/README.md`.

**Keputusan terkunci:** Kostor = jabatan perorangan (SK 1 orang + Surat Tugas
asisten); THL = 1 Komisi Kerja 2 seksi (SK-kan + pengakuan masa + stop dana
pribadi); BZP = Komisi Usaha Dana Jemaat (beda dari BZP Pemuda); ask =
semua login + tabel knowledge baru (dipilih user, belum dibangun).

**Verifikasi:** `lint` bersih ✓ (docs-only, tanpa migrasi).

**Next:** paket Sidang (SK 3 komisi + Kostor + pagu + tarif sewa + klaim THL
— butuh cek sidi/non-Pelsus + jawaban BZP Pemuda terpisah/lebur) →
Fase knowledge + endpoint ask → label UI KOMISI/BPMJ (perlu cek test label).

## Current — Standar nama pola dwibahasa (9 Okt 2026, uncommitted)

**Kebutuhan:** nama pola English standar. Awalnya dwibahasa, lalu direvisi → **English-only** (9 Okt 2026): Monologue & Dialogue, Post-to-Post, The Battle of Minds, Movie Breakdown, Mission Sequence. Penjelas Indonesia tetap di `summary` tiap pola. Kode stabil; Mission Sequence hindari tabrakan topik #CoramDeo.

**Ubah:** seed `MONOLOG→Monologue & Dialogue — …`, `POST_TO_POST→Post-to-Post — Misi 3 Pos`, `BEDAH_FILM→Movie Breakdown — …`, `THREE_SEQUENCES→Mission Sequence — 3 Rangkaian Misi` (DEBAT tetap) + sapu `worship-patterns.md` & `integrasi-divisi.md`. Re-seed staging + prod ✓ (terverifikasi baca-balik). Test tak perlu diubah (fixture passthrough).

**Verifikasi:** `lint` bersih • 70 test pola hijau.

## Current — Segarkan Bagian A/B + banner pola basi (9 Okt 2026)

**Kebutuhan:** ganti pola ibadah tidak auto-update FGD (hanya pola berikutnya); deck campur teknis baru + Q lama.

**Ubah (kode, belum commit):** `src/lib/flow-stale.ts` (baru: baseline pola-per-pekan di localStorage, tanpa migrasi DB) + test (+3) • StudioPanel: tombol "Segarkan Bagian A/B" (confirm → POST /extras → timpa + baseline) + banner amber bila pola berubah & alur lama • baseline dicatat saat draf/perkaya/sunting manual/muat awal.

**Verifikasi:** `lint` bersih ✓ full suite hijau (1 flaky lama lolos standalone) ✓ `build` OK ✓

**Deploy:** commit `ed2f96e` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `ed2f96e`).

**Next:** QA: ganti pola → banner muncul → segarkan → banner hilang.

## Current — Density tipografi + budget 12 + penutup sebaris (9 Okt 2026)

**Kebutuhan:** slide pendek terasa kosong; minta variasi fontsize ala khutbah, gabungan agresif (RHB 3-4, 5-9→3; pembekalan 4+5, 6+7), penutup 1 baris/hari yang compact tanpa scroll.

**Ubah (kode, belum commit):** `density` roomy/compact otomatis di `MdBlocks` + `SlideView` (ringan ≤6 → font naik; gabungan >10 → font turun + rapat) • `PACK_BUDGET` 12 + ekor ≤3 baris digabung • penutup = bullets `**Hari** — judul` sebaris + compact • chunk RHB 9/6, tetap per segmen • md-lite peran `reflection` (kotak emas) + PDF • cover RHB `inlineTitle` sebaris • test +density/pack/refleksi.

**Verifikasi:** `lint` bersih ✓ 75 test terkait hijau ✓ full suite **133/133** ✓ `build` OK ✓

**Deploy:** commit `dbff2e1` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `dbff2e1`).

**Seed knowledge:** staging ✓ (1 dibuat + 3 selaras) + prod ✓ (1 dibuat + 3 selaras) — standar baku aktif penuh.

**Next:** QA visual HP.

## Current — Budget-pack pembekalan + header RHB sebaris + kotak refleksi (9 Okt 2026)

**Kebutuhan:** slide pendek pasca-hideTitle terlihat kosong (minta gabung, cth slide 6-7); cover RHB judul + hari satu baris beda warna; hal penting RHB readable ala khutbah. RHB section: judul kecil tetap ada, tanpa "1/1", identitas hari hanya di cover.

**Ubah (kode, belum commit):** `packBlocks()` budget ±10 baris (blok utuh, ekor ≤3 baris digabung bila ≤budget+2) gantikan potong tetap di garis/bagianA/bagianB — pendek menyatu (garis 4→1, deliver+checklist→1, Q6→1), panjang tetap pecah • cover RHB: `inlineTitle` sebaris (hari sky + judul putih bold) + `hideTitle` • section RHB: `smallTitle` kecil tanpa kicker hari/nomor • md-lite peran baru `reflection` (🎒🎓💼 → kotak emas) + PDF callout • test selaraskan (+packBlocks, +refleksi).

**Verifikasi:** `lint` bersih ✓ 71 test terkait hijau ✓ full suite hijau (1 flaky lama lolos standalone) ✓ `build` OK ✓

**Deploy:** commit `cc27283` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `cc27283`).

**Next:** QA visual.

## Current — Audit usage Vercel + skrip vercel:gc (9 Okt 2026)

**Temuan (read-only):** 30 deployment, semua READY, tertua 31 Agu — SEHAT, jauh dari tumpukan 110+ (5 Okt). Angka % CPU/storage tak bisa via CLI (Observability Plus paywall) — wajib cek dasbor. Laju ±25 deployment/hari (tiap push + sync = 1 deployment) = risiko nyata berulang ±4 hari.

**Ubah:** `scripts/vercel-gc.mjs` + `npm run vercel:gc` (dry-run default; ambang >14 hari; lindungi URL ber-alias + `--safe` + `--keep`; tangani paginasi `alias ls` + stderr) — dry-run: **0 kandidat** (2 tertua ternyata ber-alias ke branch hidup; bug paginasi sempat salah tandai — sudah diperbaiki + terverifikasi).

**Next:** cek dasbor Usage (% CPU/storage); gabung commit sebelum push; sync staging secukupnya (bukan per commit docs-only).

## Current — hideTitle slide isi pembekalan + RHB (9 Okt 2026)

**Kebutuhan:** judul besar ganda (kicker + H1 + label isi) makan ruang; identitas cukup dari kicker. Cakupan: pembekalan + RHB saja, khutbah utuh.

**Ubah (kode, belum commit):** flag `DeckSlide.hideTitle`; SlideView lewati h1 bila flag aktif; dipasang di semua slide isi `buildPembekalanDeck` + section `buildRhbDayDeck` (cover/closing tetap bertitel; khutbah tanpa flag) • test +3 (termasuk guard khutbah).

**Catatan sesi paralel (ikut ter-commit):** slot upload legacy RHB (hero + per-section) dihapus total dari panel + PDF + deck — visual RHB kini murni 1 gambar AI harian (fallback terakhir cover pekan); `PdfOptions` lama (`pathImages`/`rhbSectionImages`/`rhbCoverImages`/`khutbahSlideImages`) dibersihkan.

**Verifikasi:** `lint` bersih ✓ full suite **133 file hijau** (3 gagal semu saat build paralel, hijau di run bersih) ✓ `build` OK ✓

**Deploy:** commit `605d0a3` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `605d0a3`).

**Next:** QA visual.

## Current — RHB standar khutbah: gambar harian AI + background semua slide (9 Okt 2026)

**Kebutuhan:** terapkan standar khotbah ke RHB — generate gambar sesuai tema harian (slot jadi 1 cover + 4 khutbah + 7 RHB), 1 gambar berlaku semua halaman hari itu (tulisan di atas gambar).

**Ubah (kode, belum commit):** endpoint `POST .../rhb-image` `{day:1-7}` (prompt = judul + ringkasan + nats + bacaan hari, gaya simbolis-damai, simpan `presentation.rhbAi[day]`, regen tak makan kuota) • kuota gabung 12/pekan + sub-cap cover 3 / khutbah 4 / RHB 7 (khutbah turun 8→4) • `buildRhbDayDeck`: semua slide background gambar harian (rantai: AI → upload hero → cover pekan; section lama hanya fallback plain), section panjang di-chunk ≤6 baris/≤4 bullet + nomor, section kosong dilewati • StudioPanel: "Ilustrasikan hari ini" per hari + "Ilustrasikan 7 hari" (stop saat kuota habis) • `buildRhbPdfs` full-bleed + scrim + teks terang tiap halaman (fallback terang), inline section dihapus • knowledge `dk-format-rhb` §4 • test baru `didaskalia-rhb-daily-image` (+3) + selaraskan 2 test lama.

**Verifikasi:** `lint` bersih ✓ full suite hijau (1 flaky lolos) ✓ `build` OK ✓ smoke PDF BG + terang OK ✓

**Deploy:** commit `9e39542` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `9e39542`).

**Next:** QA visual 1 hari penuh + 1 PDF • seed knowledge staging + prod.

## Current — Penutup 01 + CTA indeks RHB (9 Okt 2026)

**Kebutuhan:** penutup pembekalan perlu arahan/link ke indeks RHB seperti CTA ringkasan khotbah.

**Ubah (kode, belum commit):** helper `rhbIndexHashFor()`; slide penutup + box PDF dapat callout "Lanjut RHB" + CTA ke `#/materi/rhb/<ym>/<pekan>` • test selaraskan.

**Verifikasi:** `lint` bersih ✓ 41 test terkait hijau ✓

**Deploy:** commit `30e0ac7` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `30e0ac7`).

**Next:** QA visual HP.

## Current — Penutup 01 satu slide ringkas (9 Okt 2026)

**Kebutuhan:** slide penutup masih panjang. Minta ringkas simpel seperti dulu + style judul harian yang menarik dan standar.

**Ubah (kode, belum commit):** helper `penutupDayFields()` (`didaskalia-presentation.ts`) — label = nama hari, value = judul (tanpa summary); deck penutup jadi 1 slide `fields` + doa; PDF gambaran 7 hari ikut standar ringkas yang sama • test selaraskan (+1).

**Verifikasi:** `lint` bersih ✓ full suite **983 hijau + 1 flaky lama** (lolos standalone) ✓

**Next:** QA visual HP.

**Deploy:** commit `851288d` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `851288d`).

## Current — Pembekalan 01 pagination baca tanpa scroll (8 Okt 2026)

**Kebutuhan:** deck 01 slide-nya sedikit tapi tiap slide panjang (scroll ke bawah). Minta gaya baca enak ala pola khutbah; bila perlu jadi beberapa halaman.

**Ubah (kode, belum commit):** `didaskalia-presentation.ts` — helper `chunkForSlides` + `paginateSlides` (nomor `(1/2)` + kicker `· 1/2` ala khutbah); `buildPembekalanDeck` dipecah: garis-besar ≤2 komponen/slide (CTA doc 02 di terakhir), Bagian A = slide deliver + checklist ≤4/slide, Bagian B MONOLOG = Q ≤3/slide + teknis ≤4/slide (non-MONOLOG: bullet ≤4/slide), penutup ≤4 hari/slide (doa di terakhir) • test selaraskan (presentation + garis-besar +1).

**Verifikasi:** `lint` bersih ✓ full suite **981 hijau** (flaky `lazy-routes` lolos run ini) ✓ `build` OK ✓

**Deploy:** commit `c703824` → push main ✓ + `staging:sync` ✓ (`main` = `staging` = `c703824`, alias staging.*gehc.page aktif).

**Next:** QA visual HP (cek tak ada scroll per slide).

## Current — Pembekalan 01 gaya khotbah: garis besar 4 komponen + CTA doc 02 (8 Okt 2026)

**Kebutuhan:** samakan modul Pembekalan (01) ke standar khotbah literal + md-lite; ringkasan di 01 cukup garis besar 4 komponen (detail di doc 02); pertanyaan mentor/co-mentor ikut standar pola-aware terbaru.

**Ubah (kode, belum commit):** `didaskalia-presentation.ts` — `extractKeySentence`/`extractGarisBesar` (1 kalimat kunci verbatim per bagian, prioritas takeaway → kalimat pertama, potong batas kata + `…` bila >200 char, buang noise `---`), `DeckSlide.cta`, `khutbahHashFor` (CTA → `#/materi/khutbah/<ym>/<pekan>`); `buildPembekalanDeck` = cover + garis-besar (paragraf `####` agar MdBlocks highlight ala khotbah + callout/CTA Detail Penuh) + `a-deliver` (deliveryPlan + checklist, sembunyi bila kosong) + `b-pola` (Q1–Q6 penuh utk MONOLOG, tech + ops) + penutup — duplikasi literal `a-khotbah-*` & slide `a-checklist` dihapus • `DidaskaliaPresentation.tsx` SlideView: bullets/fields → `inlineSpans` (bold ikut highlight) + tombol CTA • `didaskaliaPdf.ts` `buildPembekalanPdf`: Bagian A = garis besar numbered + box CTA + deliver + checklist; Bagian B = tech + Q/flow + ops (paritas web); Teks Utama pindah ke hal. Inti Pesan • `rhb-caption.ts`: caption tanpa bigIdea AI (teks utama + link doc 02) • `didaskalia-ai.mjs` SERMON_RULES + generateWeekExtras: garis besar otomatis-verbatim, discussionFlow pola-aware • knowledge baru `dk-format-pembekalan` (sortOrder 8) • test baru `didaskalia-pembekalan-garis-besar.test.ts` (+13) + selaraskan 2 test lama.

**Verifikasi:** `lint` bersih ✓ full suite **978 hijau + 1 flaky lama** (`lazy-routes/ChurchHub` timeout, lolos standalone) ✓ `build` OK ✓ smoke PDF MONOLOG (20KB) + DEBAT (21KB) ✓

**Next:** QA visual deck 01 vs 02 (HP/proyektor) • seed knowledge ke staging + prod (`db:seed:didaskalia-knowledge`) • generate gambar bagian via Studio + publish ulang doc 02 W2 (sisa lama) • commit + push + `staging:sync`.

## Current — Verifikasi gabungan pasca-merge (8 Okt 2026)

**Jalan:** sesi paralel merge (`md-lite-render`, khutbah literal) + commit P2 liturgia sempat mendarat di branch salah → cherry-pick ke main + merge gabungan → perbaiki 1 brace ekstra `didaskaliaPdf.ts` (build staging gagal) → sync ulang.

**Verifikasi akhir:** `main` = `staging` ✓ · `lint` bersih ✓ **964 test** hijau (1 flaky lolos rerun) ✓ `build` OK ✓ QA visual 11/11 ✓ P2 utuh (DayScreen/ControlRoomPanel/control-room.ts ada + teruji) ✓

**Jalan:** `src/lib/control-room.ts` (agregasi klien day+live+mentoring, `pushToFreeShow` via API resmi `POST / {action:create_show/next_slide}` — bukan path tebakan) → `ControlRoomPanel` di tab Ibadah semua divisi (status + link 3 ruang, operasi display Marturia) → `DayScreen` `#/hari/<tgl>/layar` (blok + live ibadah + status mentoring, login) → test control-room (+8 incl. hash rute).

**Verifikasi:** `lint` bersih ✓ **957+ test** hijau ✓ `build` OK ✓ QA visual Playwright **11/11** (layar/kontrol/hari, tanpa boundary) ✓ tanpa migrasi ✓

## Current — Khutbah literal-MD + settlement W2 2026-10 (8 Okt 2026, branch `cursor/literal-md-khutbah`)

**Kebutuhan:** ringkasan khotbah website (doc 02) hasil AI beda dari MD Service member Didaskalia. Admin putuskan: full literal — 4 bagian MD verbatim, chunk rapi, nav atas + swipe, gambar AI per bagian sebagai background.

**Ubah (kode, belum commit):** `chunkSermonSection` + `buildKhutbahDeck` literal (cover + 4 bagian verbatim, tanpa summary/slideOutline AI) + `khutbahLiteral` images + fallback cover (`didaskalia-presentation.ts`, `didaskalia.ts`) • `DeckShell` nav pindah total ke header sticky + swipe horizontal mobile (ambang 60px, dominan horizontal) • `sermon-image` terima `section` (prompt dari isi bagian, kuota gabungan) + panel Studio "Ilustrasikan per bagian" (`DidaskaliaStudioPanel.tsx`) • `buildKhutbahPdf` literal 4 bagian + `khutbahSectionImages` • prompt AI `SERMON_RULES` verbatim bila ada MD acuan + seed knowledge `dk-format-khotbah-service` literal (seeded staging + prod) • test baru `didaskalia-khutbah-literal.test.ts` (+7).

**Data (applied, history dipertahankan):** settlement `scripts/settle-khutbah-literal-111026.mjs` staging + prod — outline W2 = verbatim `For Service_111026.md` (885/2544/1073/817 char), teksUtama diluruskan `Kolose 1:13-14` → `2 Korintus 5:21` (+ koreksi kutipan via `scripts/fix-w2-tekstutama.mjs`), fundamentalFirman = `Kolose 1:13–14`, generation 3 → 0, history 3 → 4 (+entri settlement, snapshot lama bisa undo). Verifikasi deck prod: 12 slide, semua frasa MD ada, tanpa teks AI.

**Tambahan (sesi lanjut):** pembekalan 01 ikut literal — `literalKhutbahSlides` dipakai bersama deck 02 (`a-khotbah-{bagian}` + deliveryPlan di chunk pertama), slide AI `a-kerangka`/bigIdea/rationale dihapus; PDF pembekalan render 4 bagian verbatim. Gambar AI per bagian: skrip `scripts/generate-khutbah-section-images.mjs` siap, TAPI generate CLI dibatalkan (lambat; 1 gambar ±2 mnt + moderasi OpenAI menolak prompt bedah mentah) → **generate manual via Studio (Ilustrasikan per bagian)** dengan prompt aman baru (konteks 400 char + gaya simbolis damai). Deck fallback ke cover bila gambar bagian kosong.

**Verifikasi:** `lint` bersih • unit baru 7/7 + presentasi 15/15 • full suite 956/957 (1 flaky `lazy-routes/ChurchHub` timeout 5s, lolos standalone — pola flaky lama, bukan regresi).

**Next:** generate 4 gambar per bagian via Studio (prod) • publish ulang doc 02 W2 • merge branch → deploy prod → cek `#/materi/khutbah/2026-10/2` • follow-up: samakan modul Pembekalan 01 (masih pakai summary AI) bila tim mau.

**Deploy (8 Okt 2026, ~22:35):** merge `cursor/literal-md-khutbah` → main (`83cb71e`) + push + `staging:sync` ✓ (staging == main). Prod `youth.gehc.page/api/version` = `83cb71e` ✓. Sisa manual: 4 gambar per bagian via Studio + publish ulang doc 02 W2.

## Current — Render markdown-lite + highlight semantik (8 Okt 2026, uncommitted di main)

**Kebutuhan:** teks literal tampil mentah (`**`, `>`, `####`, `---`) — minta dirapikan bullet/indent/spacing + highlight (warna/font) yang readable & appealing, berbasis standar WCAG AA + pedoman venue (kontras terang-gelap ≥4.5:1, sans ≥18pt, maks 5–7 baris/slide, warna tak sendirian → selalu +ikon/label/bentuk).

**Ubah (belum commit):** `src/lib/md-lite.tsx` (baru) — parser blok (heading/quote/divider/list+sarang) + inline tebal/miring + peran: `scripture` (quote+chip ref, deteksi via `bible-books.ts`), `takeaway` (kotak emas + ikon), `correction` (kotak pelurusan + ikon), `speech` (Kesimpulan: besar-hangat); DB tetap verbatim • `SlideView` pakai renderer + basis naik (`text-base/sm:text-xl`, firman `lg/2xl`) • `didaskaliaPdf.ts`: `richParagraph` (bold run), `callout` tone amber, `bullets` indent+ordered, `mdBlocks()` dipakai PDF khutbah + Bagian A pembekalan • konvensi penulis di knowledge (seeded staging+prod) • test `md-lite.test.ts` (+10).

**Verifikasi:** `lint` bersih • full suite **131 file / 964 test hijau** • parse data W2 asli: bedah = quote+3 heading+list(2,2,4 sarang), jembatan = quote+ol-3, kesimpulan = quote • PDF khutbah generate OK (34KB).

**Next:** cek visual HP/proyektor 1 slide bedah + kesimpulan • generate gambar manual via Studio tetap berlaku (lalu publish ulang doc 02 W2).

**Deploy (8 Okt 2026, ~22:50):** merge `cursor/md-lite-render` → main (`cdfe1be`) + push + `staging:sync` ✓ (staging == main). Prod `youth.gehc.page/api/version` = `cdfe1be` ✓.

## Current — Budget slide + anti slide-kosong (8 Okt 2026, uncommitted di main)

**Kebutuhan:** ada slide berjudul tapi kosong (bedah 5/5, jembatan 3/3 — ternyata chunk berisi garis `---` saja) + slide lain kepanjangan (700 char ≈ 12–15 baris). Keputusan: budget ketat + PDF per bagian tetap ganti halaman.

**Ubah (belum commit):** `chunkSermonSection` → budget POV presentasi (≤6 baris estimasi / ≤4 bullet, pecah di batas bullet, tanpa potong kalimat) + chunk sampah (`---`/kosong) dibuang via `isNoiseUnit`. PDF tak berubah (sudah alir-penuh per bagian — "cetak muncul semua" terpenuhi).

**Deploy budget slide (8 Okt 2026, ~23:10):** merge `cursor/khutbah-slide-budget` → main (`62b2935`) + push + `staging:sync` ✓. Prod = `62b2935` ✓.

## Current — Fix cetak: teks tetap terang di atas foto (9 Okt 2026)

**Kebutuhan:** PDF 02 (tombol Cetak) — tulisan slide kutipan (jembatan 1/2, kesimpulan) jadi hitam tak terbaca. Akar: teks quote/takeaway/speech punya `print:text-black` sementara artikel memaksa cetak background foto gelap → hitam di atas gelap.

**Ubah:** tone overlay `MdBlocks` tanpa kelas `print:` (screen = print: teks terang di atas foto, sesuai pilihan pertahankan foto); tone plain tak berubah. Test render statis: overlay bebas `print:`, plain tetap punya.

**Verifikasi:** `lint` bersih • full suite **983 hijau**.

**Deploy (9 Okt 2026, ~00:05):** merge `cursor/print-terang-foto` → main (`88b7896`) + push + `staging:sync` ✓. Prod = `88b7896` ✓. Cara cek: buka slide jembatan 1/2 → Cetak → preview: foto + teks terang (dulu hitam).

## Current — Judul chunk dihapus + merger slide (9 Okt 2026, uncommitted di main)

**Kebutuhan:** judul besar + counter redundan dengan kicker (makan space); page 8+9 bisa gabung.

**Ubah (belum commit):** `DeckSlide.title` opsional + `SlideView` lewati `<h1>` kosong; `literalKhutbahSlides` opts `{bareTitle, maxLines, maxBullets}` — deck 02: tanpa judul + budget 9 baris/5 bullet (pembekalan tak ikut). Splitter v2: segmentasi per baris (heading unit sendiri, tiap item list unit sendiri, quote/prosa run), `splitOversizeUnit` untuk quote/prosa raksasa (list & heading utuh), heading dilarang menggantung/menyendiri. Catatan: sesi konkuren merombak pembekalan 01 (garis besar 4 komponen + CTA, commit `c8aa2dd`) — tak bentrok, deck 02 tetap literal penuh.

**Verifikasi:** `lint` bersih • full suite **981 hijau** • prod W2: 18 slide tanpa judul ganda, ke-4 gambar bagian sudah terisi (kamu generate via Studio ✓ — semua slide bg=true), frasa MD lengkap, tanpa teks AI.

**Reset kuota ilustrasi (9 Okt 2026):** prod W2 penuh 8/8 (6 legacy slide-index AI + 2 literal). Peta legacy `khutbah` dikosongkan (tak dirender deck literal; file Drive utuh, ID lama di snapshot settlement) → kuota 2/8. Sisa: generate `jembatan` + `kesimpulan` via Studio.

## Current — SOP standar literal (9 Okt 2026, uncommitted)

**Kebutuhan:** jadikan alur MD → verbatim sebagai standar pekan mendatang + cara tim membuat MD.

**Ubah (docs saja):** `docs/product/didaskalia-studio.md` — prinsip + §2a ditulis ulang (parse → terapkan verbatim → AI pelengkap → gambar per bagian → approve → publish); §2b baru (checklist MD Service/RHB + penanda highlight + batas sistem); §1 & tabel diselaraskan. Terverifikasi silang dengan label UI aktual.

## Current — Cleanup legacy pasca-settlement (9 Okt 2026, uncommitted, BELUM commit/push)

**Audit:** editor kerangka slide AI + tombol AI per slide + loop PDF legacy + cabang endpoint `slide:` sudah tak dirender siapa pun → **dihapus total** (data lama aman di DB/history; tipe `khutbah` dihapus dari skema TS + sanitizer). **Bug ditemukan & diperbaiki:** enrich menulis ulang outline via AI (kontradiksi verbatim) → kini outline + teksUtama dikembalikan verbatim bila ada MD acuan (prompt + hard-restore + teruskan serviceMd di route). Dipertahankan: bigIdea (caption + cover), summary (konteks sesi-AI), rationale (review HOD), deliveryPlan/checklist/discussionFlow.

**Verifikasi:** `lint` bersih • full suite **985 hijau** (1 flaky run awal, hijau di rerun — pola timing lama).

**Deploy cleanup (9 Okt 2026):** merge `cursor/studio-cleanup-legacy` → main (`3f37ca4`) + push. Prod = `3f37ca4` ✓ (terverifikasi live). Staging sync menyusul bila diminta.

## Current — Cleanup gambar section RHB (9 Okt 2026, uncommitted, BELUM commit/push)
**Audit:** gambar section RHB (35 slot upload + fallback deck + fetch PDF) sudah mati di web (bila AI harian ada) & PDF (selalu) — upload-nya diam-diam tak tampil. Keputusan: hapus total + hero manual ikut dihapus → visual RHB = AI harian saja (fallback cover pekan).

**Ubah:** StudioPanel (hapus 2 ImageSlot RHB + `setSectionImage`; helper upload tetap untuk cover pekan) • deck `daily = rhbAi || cover-pekan`, fallback section dihapus • `buildPdfImages` berhenti fetch ±35 request mati (`rhbSectionImages/rhbCoverImages/pathImages`; tipe dibersihkan) • test RHB ditulis ulang ke perilaku harian-AI. Skema DB tak diubah (data lama harmless).

**Verifikasi:** `lint` bersih • full suite **993 hijau**. Verifikasi: `lint` bersih, full suite 966 hijau, deck W2 18 slide tanpa kosong. Catatan: bullet super-panjang (>6 baris sendirian) tetap butuh scroll dikit (aturan verbatim).

## Current — P2 kontrol terpadu + Marturia display (8 Okt 2026)

**Jalan:** `src/lib/control-room.ts` (agregasi klien day+live+mentoring, `pushToFreeShow` via API resmi `POST / {action:create_show/next_slide}` — bukan path tebakan) → `ControlRoomPanel` di tab Ibadah semua divisi (status + link 3 ruang, operasi display Marturia) → `DayScreen` `#/hari/<tgl>/layar` (blok + live ibadah + status mentoring, login) → test control-room (+8 incl. hash rute).

**Verifikasi:** `lint` bersih ✓ full suite (menyusul) ✓ (menyusul: build + QA visual + push + sync; tanpa migrasi)

## Current — Timeline hari Koinonia P1 (8 Okt 2026)

**Jalan:** `docs/product/integrasi-divisi.md` (5 pola + RACI + aturan) → model `day_timeline_items` (per tanggal; blok ibadah→event + pengumuman/selebrasi/makan/games; migrasi idempoten + Prisma + `check-db-schema`) → API CRUD + reorder (`requireDivision KOINONIA`, ringkasan ibadah: momen + live) → `DayTimelinePanel` di tab Ibadah Koinonia → batas lunak doa-buka/tutup (`orderBoundaryWarnings` paritas server↔klien + banner + field `warnings[]`) → test day-timeline (+9).

**Jalan:** `docs/product/integrasi-divisi.md` (5 pola + RACI + aturan) → model `day_timeline_items` (per tanggal; blok ibadah→event + pengumuman/selebrasi/makan/games; migrasi idempoten + Prisma + `check-db-schema`) → API CRUD + reorder (`requireDivision KOINONIA`, ringkasan ibadah: momen + live) → `DayTimelinePanel` di tab Ibadah Koinonia → batas lunak doa-buka/tutup (`orderBoundaryWarnings` paritas server↔klien + banner + field `warnings[]`) → test day-timeline (+9).

**Verifikasi:** `lint` bersih ✓ full suite (menyusul, 1 flaky pattern) ✓ `build` OK ✓ QA `qa-day-timeline.mjs` **15/15** ✓ (pelajaran: `node --check` tak tangkap duplikat import ESM — boot smoke wajib)

**Next:** QA visual composer staging → commit + push + sync → migrasi prod → P2 (kontrol terpadu + Marturia).

## Current — Kerangka segmen pola + firman auto-sync (8 Okt 2026)

**Kebutuhan:** pola Didaskalia = kerangka segmen (praise×3/worship×2/…), Liturgia isi lagu per slot; firman auto-sync perikop pekan.

**Ubah:** spec `segments` di seed 5 pola (MONOLOG f1 praise×3/worship×2/bedah-lagu×1 f2 firman f6 persembahan×2; dst — draf, perlu review Didaskalia) → migrasi `segment_key/phase_no` + Prisma → `patternSegments/skeletonFromPattern/readWeekPericope` (server, paritas klien utk skeleton) → order terima slot kosong + bulk `/order/bulk` → live resolve firman (auto Studio vs manual, badge) → composer: kartu referensi rundown + Bangun kerangka + isi slot + badge auto/manual + peringatan slot kosong → test segmen/skeleton/perikop (+~12).

**Verifikasi:** `lint` bersih ✓ **937 test** hijau ✓ `build` OK ✓ seed staging (segmen MONOLOG/P2P tampil) ✓ QA `qa-liturgy-segments.mjs` **16/16** ✓ migrasi + seed pola prod ✓ (MONOLOG f1 praise/worship/bedah-lagu, f2 firman, f6 persembahan)

**Next:** QA visual composer staging → commit + push + sync → migrasi + seed pola prod → Didaskalia review angka slot.

## Current — Kontemporer ID/EN + kolom lang (8 Okt 2026)

**Jalan:** kolom `songs.lang` (ID/EN, migrasi idempoten) + filter API + toggle UI + badge EN → verifikasi 50 link (36 ID 200 OK; 14 EN via site-search — 4 draf awal tak ada [Good Good Father, O Come to the Altar, This Is Amazing Grace + Holy Spirit salah sasaran] diganti terverifikasi: Revelation Song, In Christ Alone, Cornerstone, Holy Spirit 509) → `songs-contemporary.json` (metadata + artis + URL + copyright, tanpa lirik) → seed dedup vs himne/KLIK (2 lewati: KLIK 57/93, duplikat asli) → test JSON + lang (+4).

**Verifikasi:** `lint` bersih ✓ **930 test** hijau (1 flaky lolos rerun) ✓ `build` OK ✓ QA API live EN=14/ID=34/filter benar ✓ staging + prod seed 48 (2 dedup asli) ✓ `schema:check` sinkron ✓

**Next:** QA visual filter bahasa → commit + push + sync → migrasi + seed prod.

## Current — Isi master 'Ku Berbahagia KJ 392 (8 Okt 2026)

**Jalan:** validasi via `normalizeSongInput` + `resolveArrangement` (repeat Chorus 2/3 ✓, lirik bersih tanpa bocor chord ✓) → tulis master prod (1 baris): lirik full + chord inline, `defaultKey` G, pool 4 bagian + varian `full` V1-C-V2-C-V3-C → verifikasi baca-balik (key=G, 571 char, default full ✓, setlist V1-C-V2-C tak tersentuh ✓, layar bersih ✓). Tetap editable via Isi lirik/Edit. Rollback = teks pra-isi (lirik tanpa chord, kunci null, susunan null).

**Next:** pemusik cek penempatan chord/nada dasar; opsional alihkan pemakaian setlist ke `full` bila V3 ikut tampil.

## Current — Tombol Portal Liturgia + Aktifkan ulang live (8 Okt 2026)

**Kebutuhan:** operator salah pencet Selesai (tak bisa kembali LIVE); butuh tombol kembali ke portal Liturgia minggu terkait dari rute standalone.

**Ubah:** `src/lib/portal-place.ts` baru (ekstrak dari didaskalia-presentation + re-export, anti duplikasi) + `portalLiturgiaHref` (posisi div-liturgia → tab Liturgia ns aktif → fallback) → `PortalBackButton` di header Layar (dark) + Kontrol → `LiturgyOrderPanel` catat posisi sebelum ke kontrol → `LiturgyControl`: konfirmasi Selesai + pertahankan posisi (tak di-null) + tombol **Aktifkan ulang** saat DONE (lanjut posisi / momen pertama) → test `portal-place.test.ts` (+6).

**Verifikasi:** `lint` bersih ✓ **926 test** hijau (1 flaky lolos rerun) ✓ `build` OK ✓ QA visual Playwright **8/8** (layar+kontrol render, tombol Portal Liturgia di header + form kode) ✓ live event 11 Okt prod → DRAFT ✓

**Next:** operator susun order event 11 Okt (cantolkan 'Ku Berbahagia) → Terapkan draft AI → latihan LIVE → hari-H.

## Current — Pool master + varian bernama + staged susunan (8 Okt 2026)

**Ralat model:** susunan bukan satu list — lirik (semua bagian) → **pool setlist master** (Intro, V1–V3, Chorus, Coda, Ending…) → **variants** (`full`, `v1only`…); edit posisi batch + Save per susunan.

**Ubah:** `songs.arrangement` = `{master, variants}` (validasi pool-vs-lirik, varian-vs-pool, nama unik; legacy array → varian "Susunan"; 0 baris existing) + serialize dua field (kompat) → `effectiveArrangement` = pemakaian > varian pertama > full + `variantEntries/variantNames/isSameArrangement/arrangementSourceLabel` (paritas server↔klien) → `SongMasterEditor` (manajer pool + manajer varian + entri aktif, semua draft, satu Simpan) → `ArrangementEditor` per-event staged (draft + Simpan susunan/Batal + "Pakai susunan [nama]" salinan beku + label dari/kustom) → ringkasan `master [nama]` → test named/pool/staged (+~15).

**Verifikasi:** `lint` bersih ✓ full suite (menyusul) ✓ QA `qa-song-master.mjs` **14/14** (pool+varian PUT, tolak luar-pool/ganda 400, default full, salinan beku) ✓ tanpa DDL baru ✓

**Next:** QA visual (buat `full`+`v1only`, geser, Simpan sekali) → commit + push + sync → pemusik isi lagu.

## Current — Editor master batch + susunan default master (7 Okt 2026)

**Kebutuhan:** perubahan lagu jangan langsung tersimpan (adjust dulu, baru Simpan/Terapkan); susunan main di level master (V1-C-V2-C…); tab Chord = lirik + baris kosong di atasnya siap ketik chord; transpose berlaku untuk semua chord + rewrite nada dasar.

**Ubah:** migrasi `songs.arrangement` JSON NULL (idempoten, lokal+staging+prod) + Prisma → `normalizeSongInput` terima + validasi susunan vs master (400 bila basi) + `serializeSong` bawa arrangement → `effectiveArrangement` (pemakaian > master > null, paritas server↔klien) dipakai builder ChordPro/Quick Lyrics/`.show`, preview panel, ringkasan (`master:`), `resolveLyrics` layar → `SongMasterEditor` baru (4 tab Lirik/Susunan/Chord/Nada, draft lokal + badge belum-tersimpan + Batal + validasi blokir; tab Chord = input per baris via `chordLyricPairs`/`applyChordLine`; tab Nada rewrite ke kunci tampil saat Simpan) gantikan form inline panel (story/meaning dipertahankan) → lib `chordLyricPairs/applyChordLine/findSuspectChords` → test editor (+~12) + server arrangement (+5).

**Verifikasi:** `lint` bersih ✓ **917 test** hijau ✓ `build` OK ✓ QA `qa-song-master.mjs` **9/9** (buat+susunan, tolak basi 400, ekspor ikut master, override pemakaian menang, bersih) ✓

**Next:** QA visual editor di staging (1 lagu himne full) → commit + push + sync → migrasi prod → pemusik isi lagu susunan perdana.

## Current — Susunan main + tab Chord + modulasi (7 Okt 2026)

**Kebutuhan:** lirik full sebagai reference (Ku Berbahagia: semua verse+chorus); susunan ala ProPresenter (V1+C saja atau full, urutan bebas); tab chord terpisah (chord di atas lirik); transpose × capo digabung; modulasi + titik pindah kunci.

**Ubah:** `sections` = ordered list boleh berulang (tanpa migrasi skema) → `resolveArrangement` + `normalizeArrangement` + `validateArrangementSections` (klien ↔ server paritas) → `renderChordOverLyrics` (tampil-saja) + `stripChords` buang direktif → builder Quick Lyrics/`.show`/ChordPro + `resolveLyrics` layar ikut susunan → UI: editor susunan (tambah/hapus/geser/duplikat/preset/modulasi per baris) + tab Chord + stepper **Nada** tunggal + capo anotasi + ringkasan susunan → test arrangement/modulasi/chord-view (+~15).

**Verifikasi:** `lint` bersih ✓ **906 test** hijau (125 file) ✓ `build` OK ✓ (tanpa migrasi skema; QA API + staging menyusul)

**Next:** QA 1 lagu penuh (V1+C, modulasi chorus akhir, ekspor `.show`) → commit + push + sync.

## Current — Cleansing sesi film 11 Okt + label pola dropdown (7 Okt 2026)

**Gejala (prod):** dropdown kontrol menampilkan "BEDAH_FILM — ..." padahal panel "Pola sesi" = Monolog · sesi-2026-10-11.

**Diagnosis (audit prod read-only):** bukan sesi film nyangkut — polanya SUDAH MONOLOG (terkonversi sebelumnya, slug+link utuh); yang basi hanya JUDUL. 1 sesi event ini (DRAFT, 0 jawaban/vote/catatan/soal/chip) → tak perlu hapus/arsip; guard Terapkan lolos.

**Ubah:** rename title prod → "Ibadah — Ibadah Pemuda Raya: The Rescue Plan - 11 Okt 2026" (1 baris, guard status=DRAFT; tanpa demo admin prod jadi via SQL setara PUT — efek identik) → hardening: `src/lib/worship-session-select.ts` baru (`preferSession` + `sessionOptionLabel`) → `MentoringControl` (prop `preferPattern`, label `[POLA] judul — status`) + `SessionDraftTab` (preferensi + label) + `PolaSesiPanel` (teruskan pola pekan, remount ikut pola) → test `worship-session-select.test.ts` (+7).

**Verifikasi:** `lint` bersih ✓ **906 test** hijau (125 file, +7; 1 flaky lolos rerun) ✓ `build` OK ✓ rename prod terverifikasi via SELECT ✓

**Next:** user tempel draft AI di Draft tab → Simpan → Terapkan → START SESI hari-H. "Arsip (1)" milik event lain, tak disentuh.

## Current — Bedah lagu kontekstual + berkisah (7 Okt 2026)

**Kebutuhan:** usulan AI ngaco ("Mendekat" oleh "Luthfi"). Maunya: lagu dari himne KJ/NKB/NNBT yang kontekstual dengan firman + ada sejarah di balik lagu (cth. Mengikut Yesus Keputusanku — kisah suku Assam/Garo).

**Ubah:** template `song` → 6 kunci (`song-title/book-ref/writer/story/about/id`; `song-singer` lawas tetap fallback) → `SONG_RULES` di `generateSessionDraft` (wajib KJ/NKB/NNBT + nomor, kaitan firman eksplisit, kisah diakhiri "(perlu verifikasi tim)", contoh jebakan KK 399, kosongkan bila tak yakin) → `sessionSong()` + tipe `SessionSong` diperluas (bookRef/writer/story/songId) → widget PatternDay + layar + PDF rekap (badge nomor buku + kotak kisah + peringatan verifikasi) → `SongPicker` + badge "di luar pustaka" di Draft Sesi → kolom kurasi `songs.story/meaning` (migrasi idempotent + serialize + editor Liturgia) → test template/AI-prompt/sessionSong/serialize (+~10).

**Verifikasi:** `lint` bersih ✓ test hijau ✓ `build` OK ✓ migrasi lokal/staging/prod + seed NNBT ✓

**Next:** QA 1 bedah lagu nyata (AI → verifikasi kisah → kurasi ke pustaka); tim kumpulkan kisah lagu favorit ke `songs.story`.

## Current — Editor lirik + chord + fix rute layar/kontrol (7 Okt 2026)

**Kebutuhan:** rute `#/ibadah/.../layar|kontrol` prod error React #306; pemusik butuh isi lirik full + taruh chord di atas lirik + key picker nada dasar.

**Diagnosis #306:** `LiturgyScreen/Control` tanpa `export default` padahal di-`React.lazy` (lazy resolve `undefined`; tsc/vite/test tak menangkap) + `LiturgyControl` pakai `useApp()` di luar provider.

**Ubah (F1):** `export default` 2 file → `LiturgyControl` toast state-lokal → test `lazy-routes.test.ts` (13 modul lazy + bentuk hash prod) → commit `6280267` → push main → `staging:sync` ✓ → QA visual Playwright 6/6 (form kode + panel kontrol, tanpa boundary).

**Ubah (F2):** policy lirik full semua sumber (login-only, ekspor peran tulis; sekuler tetap tanpa lirik) → `song-chords.ts` (`SECTION_TEMPLATES`, `isChordLine`, `compileChordOverLyrics`, `keyIndex/transposeKey/transposeSteps`, `PICKER_KEYS`) → `LiturgiaSongsPanel` (mode edit lagu + tombol template + gabungkan chord + `defaultKey` select + dropdown **Main di…** + tombol **Isi lirik**) → test `song-chord-editor.test.ts` (+12) → docs §8.

**Verifikasi:** `lint` bersih ✓ **887 test** hijau (124 file) ✓ `build` OK ✓ (tanpa DDL baru — QA API 23/23 tetap berlaku)

**Next:** QA visual editor di staging (isi 1 lagu himne full + gabungkan chord + main di D) → commit + push + sync → pemusik isi lagu susunan perdana.

## Current — Tata ibadah live + transpose per pemusik (7 Okt 2026)

**Kebutuhan:** rundown fix → Liturgia susun lagu → 1 link presentasi tata ibadah (proyektor + HP jemaat, seperti link khotbah) + chord versi pemusik dengan transpose personal (gitar +2, keyboard +1 di lagu yang sama).

**Ubah:** Prisma `ServiceOrderItem`/`ServiceSongSetting`/`ServiceLiveState` → `_migrate-liturgy-live.cjs` (+`db-migrate-local`, `check-db-schema`, npm `:staging/:prod`) → `server/lib/liturgy-live.mjs` (validasi order/live/setting, `effectiveTranspose`, `resolveLyrics`, kode proyektor) → `server/routes/liturgia-live.mjs` (order CRUD + reorder, live baca login/kode, tulis Liturgia, mysetting per akun) + ekspor `asMe=1` di `liturgia-songs.mjs` → klien `lib/liturgy-live.ts` + `LiturgyScreen` (layar, polling 15 dtk, bait sinkron, placeholder-link bila lirik kosong) + `LiturgyControl` (next/prev momen+bait, start/selesai, rotasi kode, salin link) + `LiturgyOrderPanel` (susun momen, cantolkan setlist) di tab Ibadah Liturgia + `Chord saya` di `LiturgiaSongsPanel` (transpose/capo personal, preview, unduh ChordPro saya) + rute `#/ibadah/<key>/layar|kontrol` di `main.tsx` → test `liturgia-live.test.ts` (+12) → `docs/product/liturgia-lagu.md` §7.

**Verifikasi:** `lint` bersih ✓ **858 test** hijau (122 file, +12 baru) ✓ `build` OK ✓
migrasi lokal + staging (3 tabel) ✓ QA E2E `scripts/qa-liturgy-live.mjs` vs API lokal
**23/23 LULUS** (order CRUD + reorder, live kode 200/401, resolve lirik bersih,
mysetting 2 akun +2/-1, ekspor asMe `[A]`, negatif 400, cleanup bersih) ✓
migrasi **prod** 3 tabel (`db:migrate:liturgy-live:prod`) + `db:schema:check:prod` sinkron ✓
(insiden toast "Tabel setting belum ada" di prod = migrasi tertunda; teratasi, tanpa ubah data lagu)

**Next:** QA staging (5 momen, 2 lagu, 2 akun beda transpose, 1 layar + 1 HP) → migrasi prod → pakai perdana 1 ibadah nyata. Prasyarat: pemusik isi ChordPro lagu yang dipakai.

## Current — Pustaka lagu NNBT + PKJ + KLIK + guard sekuler (7 Okt 2026)

**Kebutuhan:** Liturgia butuh lagu NNBT GMIM + PKJ + KLIK di pustaka; lagu Indonesia sekuler boleh dipakai momen bebas ibadah.

**Ubah:** `SONG_SOURCES` + `SOURCES` (+`HIMNE_NNBT/HIMNE_PKJ/KLIK/SEKULER`) di `server/lib/liturgy-songs.mjs` + `server/routes/liturgia-songs.mjs` → `assertSecularMoment` (sekuler hanya `bebas`/`bedah-lagu`, 400 bila momen inti; cek di POST + PUT setlist) → `normalizeSongInput` (SEKULER wajib pencipta + tautan/catatan hak cipta, tolak simpan lirik) → seed `songs-nnbt.json` (50) + `songs-pkj.json` (308) + `songs-klik.json` (479, varian 203A/451b/464b; 1 baris sampah `KLIK 026` dibuang) → `_seed-liturgia-songs.cjs` loop 3 buku (`alkitab.app/<BUKU>/<n>`) → `LiturgiaSongsPanel.tsx` (filter 8 sumber, badge SEKULER, hint sekuler, placeholder cari baru) → test `liturgia-songs.test.ts` (+3: sumber, guard momen, validasi sekuler) → `docs/product/liturgia-lagu.md`.

**Verifikasi:** `lint` bersih ✓ **846 test** hijau (121 file, +4 baru) ✓ `build` OK ✓ seed idempoten (rerun +0) ✓ staging 1546 ✓ prod 1546 (478 KJ + 230 NKB + 50 NNBT + 308 PKJ + 479 KLIK + 1 lokal) ✓

**Next:** QA Liturgia: cari `NNBT 42 / PKJ 15 / KLIK 125` di tab Ibadah → masukkan ke setlist 1 event → ekspor `.show` → uji tolak sekuler di momen `firman` (400). Commit + push menunggu perintah.

## Current — Penatalayan mingguan: mentor assign + WA temporer + Representative Day (Okt 2026)

**Kebutuhan:** assign tersentral HOD; koordinasi mingguan tanpa wadah; HOD butuh 1 hari presentasi tanggung jawab (firman→pembaca, latihan, slide, logistik, tuan rumah+absensi); undangan via caption/video cara alat.

**Ubah:** `mentor-assign.mjs` (scope kelompok binaan, all-or-nothing 403) → `POST /schedules` + `/bulk` dibuka untuk MENTOR/CO_MENTOR (komponen UNIT saja) + `GET /people` auto-scope + banner kalender → `serving_week_channels` (+ migrasi/seed-check) + `serving-week.mjs` (siklus DRAFT→OPEN→CLOSED, daftar undangan petugas+mentor+HOD) + routes (GET/PUT/open/close; tulis = BOD/Komisi) + `ServingWeekChannelCard` di baris serving + caption undangan/penutup/cara-kerja/roster (`serving-week-caption.ts`, katalog `TOOL_VIDEOS`) → `representative-day.mjs` (6 agenda baku) + `GET /template` + tombol isi-template di Rapat event → audiens `SERVING_REPS` (notify + announcements snapshot + cron dispatch) + `runServingWeekReminders` (Jumat H-2 / Sabtu H-1 / Senin tutup) → test mentor-assign(5)+serving-week(6)+representative-day(2)+notify(+1) → `docs/product/penatalayan-mingguan.md`.

**Verifikasi:** `tsc` bersih ✓ **842 test** hijau (121 file, +14 baru) ✓ `build` OK ✓ migrasi lokal `serving_week_channels` ✓

**Next:** migrasi `:staging` → QA 1 minggu serving ujung-ke-ujung → rekam 5 video panduan → isi link Drive ke `TOOL_VIDEOS`.

**Update 7 Okt (data lagu full + deploy):** seed `songs-hymns.json` (KJ 1–478 + NKB 1–230, judul terverifikasi SABDA, metadata saja) → staging: migrasi songs/serving_week ✓ + seed 709 ✓ + `staging:sync` deploy ✓ version = main ✓ → prod: migrasi 3 tabel ✓ + seed 709 ✓ (478 KJ + 230 NKB + 1 lokal). ChordPro diisi pemusik via UI; video panduan oleh Marturia/BOD.

## Current — Sprint A Marturia & Diakonia: tab + API + kurasi pindah milik (7 Okt 2026)

**Keputusan (dikunci):** paralel MVP tipis keduanya; setuju pindahkan kepemilikan (Info Peluang→Perantau, Portal Doa→Kasih Peduli, Warta multi-divisi); Diakonia by-event + rutin. Tab pendek + nama resmi jadi subtitle; approver interim Diakonia = KOMISI + BOD Tim Kerja (Plt via Kelola Struktur, tak blocking); uji staging = Mentoring Day terdekat.

**Ubah:**
- IA: `portal-nav-config.ts` MARTURIA→`liputan,galeri,desain,kesaksian,misi,…` + DIAKONIA→`tugas,logistik,konsumsi,kesehatan,peduli,perantau,…` + `DETAIL_TAB_ALIASES` (`gallery→galeri`) + `resolveDetailTabId()` → test nav-config update (+6).
- DB: 10 tabel (`marturia_shotlist/assets/versions/souls/referrals`, `diakonia_event_checks/transport/cases/visits/kost`) — Prisma models + `_migrate-marturia-diakonia-a.cjs` (idempoten, wired `db-migrate-local` + npm `:staging|:prod`) + `check-db-schema` REQUIRED_TABLES. Lokal applied ✓ 10/10, rerun idempoten ✓.
- Server: `routes/marturia.mjs` (15 endpoint: shotlist+seed, assets+versions+handoff 1-langkah, souls+handover, referral+`/api/r/:code` publik klik) + `routes/diakonia.mjs` (12 endpoint: readiness agregator, checks upsert, transport, cases+masking non-peduli, visits, kost+moderasi) — semua tulis `requireRole` + `requireDivision`, baca scoped. Registrasi di `index.mjs`.
- UI: 7 tab baru (`MarturiaLiputan/Desain/Misi`, `DiakoniaTugas/Operasional/Peduli/Perantau`) + `TAB_META` + render branches di `DivisionWorkspacePanel`; galeri M1 (filter kontributor, approve massal, salin URL Warta ≤10, badge Kurasi Marturia); Warta strip kontribusi divisi (`WARTA_SECTION_OWNERS`, `division="MULTI"`); `InternalWartaPanel` props owner+lock kategori; `PastoralCareBoard` embed + tombol Untuk Liturgia (salin + ingatkan samarkan nama); caption Ajak baca carpool Diakonia (D3) + test caption (+2).
- Lib murni teruji: `src/lib/marturia.ts` + `src/lib/diakonia.ts` → `marturia-diakonia.test.ts` (+9).

**Verifikasi:** `lint` bersih ✓ **828 test** hijau (118 file, +16 baru) ✓ `build` OK ✓ migrasi lokal 10 tabel ✓ 27 endpoint ter-registrasi ✓

**Lanjut (staging E2E, branch `cursor/sprint-a-marturia-diakonia`):**
- Commit `d2f81b1` (Sprint A) + `eee52cd` (endpoint hapus + smoke) + `aa2b5e8` (fix moderasi kost + guard) + `de7d0eb`/`4c65d69`/`fb4c7e1`/`5901743` (smoke) → push origin ✓
- Migrasi staging ✓ (tabel sudah ada — lokal & staging satu cluster `gehc`; `db:schema:check:staging` sinkron ✓)
- Reseed demo staging ✓ (`db:seed-users:staging` — staging habis sync prod 5 Okt, 0 akun demo; kini 280 users)
- Deploy staging 3× ✓ (final `gehcpage-d72xv5dkf`) — `/api/version` = Sprint A ✓ (Basic Auth via `STAGING_BASIC_AUTH` di `.env`)
- **Smoke E2E `npm run smoke:marturia-diakonia` → 30/30 PASS, 0 residu** (shotlist seed 6 + toggle, guard akun segar 403×2 + masking + hapus via people-delete, readiness, transport, kasus lapor→assess + 409 lompat + visit, asset + 409 lompat + versi, souls, referral + klik publik, kost + moderasi; cleanup assert 0 sisa)
- Temuan jujur: (1) gievara/prichel = COMMITTEE+BOD tanpa divisi → cross-tulis 200 adalah perilaku benar (bukan bug); (2) moderasi kost awal terlalu ketat vs middleware → fix ikut `requireDivision`; (3) flake propagasi alias 1× (seed list=1, lolos saat rerun + repro manual 6/6); (4) mentee seed tanpa password lokal → smoke pakai registrasi akun segar + hapus.
- Sisa di staging: 1 referral gievara + klik counter (data personal sah, bukan polusi); check LOGISTIK event 25 Okt dikembalikan BELUM.

**Verifikasi akhir:** `lint` bersih ✓ **842 test** hijau (121 file) ✓

**Next (butuh perintah):** Sprint B: desain handoff penuh, kesaksian live, referral funnel, inventaris detail.

## Current — Sprint B Marturia & Diakonia: funnel + saksi + inventaris (7 Okt 2026, staging hijau)

**Branch:** `cursor/sprint-b-marturia-diakonia` (di atas `bec1e9b`; commit liturgia `443e455` nyasar di branch ini tapi isinya identik dengan `ec3bdce` di main → merge nanti bersih).

**Ubah:**
- DB: 6 tabel (`marturia_templates`, `diakonia_inventory/checkout/consumption/safety/incidents`) — Prisma + `_migrate-…-b.cjs` + check-schema; lokal & staging applied ✓
- Funnel: `server/lib/marturia-funnel.mjs` (signup +1 & jiwa BARU otomatis; HADIR +1, awaited deterministik) → hook di register google+local → `#/join?ref=` dipertahankan ke `#/register?ref=` (`JoinPage`) → banner + `ref` di `AuthPanels` → `referralCodeFromHash()` teruji → tombol Salin untuk Jethro di Misi.
- Saksi: `POST /api/marturia/testimony-leads` (DRAFT placeholder → antrean kurasi, idempoten per sesi+nama) → tombol → Marturia per pick di `TestimonyPanel` → `DELETE /api/me/testimonials/:id` (draf sendiri) + tombol Tarik di panel mentee.
- Inventaris: master + pinjam-kembali (guard 409 hapus saat keluar) + konsumsi terstruktur + safety standby + insiden (BERAT → buat kasus peduli 1 klik) — semua di tab Logistik/Konsumsi/Kesehatan existing.
- Desain: brand kit (CRUD template) + filter peminta + badge peminta.
- Smoke `scripts/smoke-marturia-diakonia.mjs` → **50/50 PASS staging, 0 residu** (termasuk guard akun segar, masking, 409 alur, funnel klik→daftar→hadir).

**Temuan jujur:** (1) race void-import → fix await; (2) flake baca deployment lama → retry 30 dtk di smoke; (3) GET tanpa sesi = 401 terbaca "0" → bug smoke, sudah fix; (4) sesi paralel menaruh commit liturgia di branch ini + stash otomatis — dipulihkan via `reset --hard origin` + `stash pop`, tak ada kerja hilang.

**Verifikasi:** `lint` bersih ✓ **846 test** hijau ✓ `build` OK ✓ staging deploy + smoke 50/50 ✓

**Next:** Sprint C pandas (perantau burnout check-in, dsb.) bila diminta.

## Current — Merge Sprint B ke main + deploy PROD (7 Okt 2026)

**Jalan:** `main` tidak bergerak (tetap `ec3bdce`) → `--no-ff` merge `cursor/sprint-b-marturia-diakonia` (`45109da`, 22 file, tanpa konflik — liturgia duplikat resolve otomatis identik) → `lint` bersih + **846 test** hijau pasca-merge → push `main` ✓ → migrasi prod B 6 tabel + `db:schema:check:prod` sinkron ✓ → Vercel Production auto-deploy.

**Verifikasi prod:** `/api/version` = `45109da` ✓ endpoint baru terdaftar & terkunci (templates + inventory → 401 tanpa login, tanpa data uji ditulis) ✓

## Current — Merge Sprint A ke main + deploy PROD (7 Okt 2026)

**Jalan:** FF-merge `cursor/sprint-a-marturia-diakonia` (8 commit) → `main` (`b671b71..98a7250`) → push ✓ → migrasi prod 10 tabel duluan (non-destruktif, `db:migrate:marturia-diakonia-a:prod` 10/10 + `db:schema:check:prod` sinkron ✓) → Vercel Production auto-deploy.

**Verifikasi prod:** `/api/version` = `98a7250` ✓ endpoint baru terdaftar & terkunci (shotlist + kost → 401 tanpa login, tanpa data uji ditulis) ✓

**Catatan:** `staging:sync` (ref `staging` git) tidak dijalankan — staging Vercel sudah di depan via `deploy:staging`; jalankan bila perlu paritas ref.

## Current — Alihkan pola sesi di tempat (7 Okt 2026)

**Kebutuhan:** slug `sesi-2026-10-11` sudah dipakai sesi Bedah Film (prod) → buat sesi Monolog baru bentrok "Slug sudah dipakai"; overwrite slug tidak mungkin karena unik.

**Ubah:** `POST /api/worship/sessions/:id/convert-pattern` (`convertSessionPattern` teruji: DRAFT-only, tolak bila ada data peserta, hapus isi organizer pola lama transaksional, slug & link tetap, timer/floors dipertahankan) → `SessionDraftTab` CTA primer `Alihkan sesi ini ke {pekan}` saat mismatch + saran slug unik otomatis saat 409 → test `worship.test.ts` +4 convert.

**Verifikasi:** `tsc` bersih ✓ 84 test hijau (5 file worship/nav-config) ✓

**Next:** prod 11 Okt: sub-tab Draft → `Alihkan sesi ini ke MONOLOG` (konfirmasi) → isi AI → Terapkan. Link lama tetap berlaku.

## Current — Pustaka Lagu Liturgia + chord/transpose + ekspor FreeShow (7 Okt 2026)

**Kebutuhan:** rundown pola (Didaskalia) tanpa daftar lagu; Liturgia butuh setlist per ibadah + referensi himne (SABDA) & kontemporer + chord pemusik dengan transpose & pilih bagian + siap integrasi free.show; media simpan harus reusable lintas-unit.

**Ubah:** Prisma `Song` (pustaka GLOBAL: metadata KJ/NKB + link SABDA, copyright/CCLI, ChordPro kanonis) + `ServiceSong` (setlist per event: urutan/bagian/transpose/capo/momen) → `_migrate-liturgy-songs.cjs` (+ `db-migrate-local` + `db:schema:check` + npm scripts) → `server/lib/liturgy-songs.mjs` (validasi + mesin ChordPro + builder Quick Lyrics/ChordPro/`.show`) ↔ `src/lib/song-chords.ts` (mesin klien identik) → `server/routes/liturgia-songs.mjs` (pustaka CRUD + setlist + reorder + export; tulis = Liturgia + KOMISI/COMMITTEE/SUPERADMIN) → `LiturgiaSongsPanel.tsx` (setlist, cari pustaka, lagu baru, transpose/capo, checkbox bagian, preview chord/lirik, unduh .show/ChordPro, salin Quick Lyrics) dipasang di tab ibadah Liturgia → `_seed-liturgia-songs.cjs` (metadata KJ 1–10 terverifikasi SABDA + 1 contoh lokal ber-chord) → test `liturgia-songs.test.ts` (+17) → `docs/product/liturgia-lagu.md`.

**Verifikasi:** `tsc` bersih ✓ **810 test** hijau (117 file) ✓ `build` OK ✓ migrasi lokal (2 tabel) + seed lokal (11 lagu) ✓

**Next:** migrasi+seed staging (`:staging`) → QA Liturgia: buat setlist 1 event → impor 1 `.show` ke FreeShow → tambah KJ 11+ / NKB bertahap (metadata dulu); kontemporer via form manual + CCLI.

## Current — Sub-tab Pola & Sesi + mismatch eksplisit (7 Okt 2026)

**Kebutuhan:** tab Pola & Sesi scroll terlalu panjang; revert Bedah Film → Monolog tanggal 11 tapi draft masih tampil film (dual source of truth pekan vs sesi + auto-reselect sesi kept).

**Ubah:** `PolaSesiPanel` sub-tab Katalog/Draft/Kontrol (default Draft, hidden bukan unmount, `initialSub` deep-link dari Studio, `sessionEpoch` refresh list sesi tiap savePattern) → `SessionDraftTab` banner mismatch + CTA `Buat sesi {pekan} baru` + sembunyikan Isi AI/Simpan/Terapkan + form read-only saat mismatch + tahan seleksi kosong setelah reset tanpa hapus + reset form ke kosongan Monolog + `key={selectedId-detailCode}` remount bersih → `DivisionWorkspacePanel` `polaInitialSub` (Lihat detail pola → katalog).

**Verifikasi:** `tsc` bersih ✓ 80 test hijau (worship, nav-config, draft, patterns, delete) ✓

**Next:** staging 11 Okt: sub-tab Draft → banner mismatch → Buat sesi MONOLOG baru → Terapkan; sesi film lama Tutup (arsip CLOSED). Sesi film 11 Okt yang nyangkut: arsipkan, jangan hapus.

## Current — Deck 7 slide + Absensi Grup + preselect + tooltip AI (6 Okt 2026)

**Deck pembekalan 16→7:** cover+inti, garis besar, A gabungan (deliver+ringkasan), checklist (pindah), kerangka gabungan, B gabungan (teknis pola + alur + absensi + monitoring), penutup (7 hari + doa). Renderer dukung semua field. Test deck ditulis ulang.

**Absensi Grup:** mentor/co-mentor menandai hadir anggota grup binaannya = check-in resmi (OK + audit `MENTOR:userId`, badge di riwayat Koinonia). Guard server 403 di luar grup; undo tetap Koinonia/komisi. Tab baru + nav + i18n + guide. Test izin 7.

**Lainnya:** auto-select event minggu berjalan (`nearestUpcoming` + test 5; lengkapi helper yang hilang); tooltip 4 tombol AI + §2b tabel peringatan di SOP Studio.

**Verifikasi:** `lint` bersih ✓ **793 test** hijau ✓ `build` OK ✓ (1 test guide diperbaiki dengan entri baru, bukan dilonggarkan).

## Current — Kondisi GESER: pindah ibadah beda tanggal (6 Okt 2026)

**Kebutuhan:** W3 18 Okt berpotensi maju ke Sab 17 Okt (kegiatan gereja). Belum ada skenario pindah tanggal — link event/DB/Drive harus ikut.

**Keputusan:** kondisi ke-4 `GESER` (18 Okt → newEventDate 17 Okt). Jadwal efektif ikut geser; pekan materi tetap W3 (RHB/ringkasan tak tersentuh); grup idx tetap; Drive/links ikut eventId (tanpa rename).

**Ubah:** migrasi `new_event_date` (`_migrate-service-overrides.cjs`) → `service-overrides.mjs` (`OVERRIDE_CONDITIONS` + `effectiveDate` + upsert validasi) → `service-overrides.mjs` routes (PUT terima `newEventDate`; `POST /geser` dry-run default + apply pindah assignment+event, cek tabrakan) → `serving-assignments.mjs` (slot Minggu tampil baris pindahan, tetap consume idx) → `didaskalia-studio.mjs` (`resolveEventId` ikut tanggal efektif) → `ServicePlanPanel` (opsi Geser + date picker + pratinjau + chip `→`) → test `service-geser.test.ts` (+5).

**Verifikasi:** `lint` (sisa error hanya file WIP lain) + `vitest` + `build` + uji staging dry-run.

**Next:** staging dry-run `from 2026-10-18 to 2026-10-17` → apply bila bersih → HOD verifikasi jadwal/event/materi W3.

## Current — Tab paralel Pola & Sesi + POV per pola (6 Okt 2026)

**Kebutuhan:** opsi bawah kontrol masih Post-to-Post walau Bedah Film dipilih (sesi 11 Okt The Rescue Plan); tiap event perlu 3 link (peserta/layar/kontrol); Studio 9 tab sesak; sesi CLOSED lama membebani list.

**Ubah:** `portal-nav-config.ts` DIDASKALIA `['studio','pola','penatalayan','members']` → `DivisionWorkspacePanel` TAB_META `pola` + render `PolaSesiPanel` (ikuti `selectedEvent` via `yearMonthWib/weekIndexForDateWib`) → `DidaskaliaStudioPanel` 7 tab (hapus `pola/sesi`, tombol `Lihat detail pola →` deep-link ke tab baru) → `MentoringControl` filter event + arsip CLOSED>28hr + sembunyi Likert/Chip/Rank/Rooms bila non-POST + `open-likert` hanya POST → `SessionDraftTab` hidrasi pakai pola sesi + 3 link per sesi event + arsip + AI pakai pola sesi → `worship.mjs` `normalizeConfig(raw, patternCode)` strip topics bila non-POST + `apply-draft` non-POST hapus warisan Likert/Chip transaksional + `ensureAutoClosed` (LIKERT_OPEN/RUNNING/WRAPUP lewat tanggal → CLOSED) di semua jalur baca → test `worship.test.ts` (+4) + `portal-nav-config.test.ts` update.

**Verifikasi:** `tsc` tanpa error baru (error lama ServicePlanPanel/didaskalia-presentation/service-geser tidak tersentuh) ✓ `worship+nav-config+draf` 80 test hijau ✓

**Next:** staging: pilih event 11 Okt → tab Pola & Sesi → buat sesi baru `sesi-2026-10-11-rescue-plan` (BEDAH_FILM) → isi AI → Terapkan (assert likert 0/chips 0/rooms 0) → cek 3 link (layar `?code=`, kontrol login DIDASKALIA). Sesi lama CLOSED jadi arsip.

## Current — Ringkasan khotbah pola For Service ±600-900 kata (6 Okt 2026)

**Latar:** ringkasan AI (100–150 kata) jauh lebih tipis dari pola .md tim (pengantar + bedah per frasa + jembatan + kesimpulan panggung).

**Ubah:** aturan summary di 3 generator (draf/enrich/sermon) → struktur 4 bagian + key-takeaway per poin + kesimpulan direct-speech; token sermon 6–9 ribu + timeout 60 dtk; dokumen knowledge FORMAT baru `dk-format-khotbah-service` (seed staging + prod); tanpa field/skema baru (kompatibel mundur).

**Verifikasi:** `lint` bersih ✓ **777 test** hijau (+3) ✓ `build` OK ✓

## Current — FGD 3Q + Drive ramah + materi responsif & kembali kontekstual (6 Okt 2026)

**Kebutuhan:** error gambar AI `invalid grant`; Q mentee di session link hari H (lesson learned tetap) tapi Q wajib ada di slide pembekalan; layout materi HP (scroll bawah, tanpa geser kanan, tombol kembali ke info event/posisi terakhir).

**Ubah:** `didaskalia-studio.mjs` (3 route gambar → `DRIVE_AUTH_EXPIRED` + pesan ramah, bedakan "AI jadi tapi simpan gagal"; kuota tak bertambah) → Studio banner pra-generate + guard (`/api/drive/token-status`) → FGD: template `Panduan FGD (tepat 3)` + `FGD_RULES` di `generateSessionDraft` (Q1 observasi+analogi, Q2 Bedah Teologis, Q3 konkret; rotasi perwakilan) + banner rotasi di `PatternDay` + widget `panduan: [guide,notes,download]` → pembekalan `b-fgd` = Q1-Q3 eksplisit + aturan rotasi → `DeckShell` scroll vertikal + `break-words` + `rememberPortalPlace/lastPortalPlace` (localStorage 24 jam; Keluar/Portal/Kembali pakai posisi terakhir) → test `didaskalia-md.test.ts` (+3: widget, deck Q, portal-place).

**Verifikasi:** `lint` bersih ✓ **777 test** hijau (+4) ✓ `build` OK ✓

**Next:** uji staging 2026-10 pekan 2 (FGD hari H: buka Q → jawab perwakilan → catat → unduh; materi HP 360px; tombol Kembali) → commit + push (staging & main, menunggu perintah).

## Current — Skenario MD mingguan Didaskalia: sermon 4 outline + metode bebas + 3 caption (5 Okt 2026)

**Kebutuhan:** MD Service (`For Service_*`: Pengantar, Bedah Teologis, Jembatan, Kesimpulan) jadi input awal Ringkasan Khotbah; MD RHB (`For RHB_*`) jadi input 7 Path; bigIdea + metode + analisa AI; pembekalan = garis besar + arahan pola + ringkasan untuk preacher + RHB; caption pembekalan (mentor) + caption khotbah (preacher); cover AI teks-di-atas-gambar.

**Ubah:** `server/lib/didaskalia-md.mjs` (baru: `parseServiceMd`/`parseRhbMd`/`unwrapPythonMd`) → `server/lib/didaskalia-ai.mjs` (`SermonObjectSchema` + `clampSermon`: bigIdea/teksUtama/outline 4 bagian; `generateSermon` MD-aware; metode bebas — kosong = AI pilih; `generateWeekDraft` pakai pilihan AI) → `server/routes/didaskalia-studio.mjs` (`sourceMd` per pekan + sanitize + PATCH whitelist; `POST /api/didaskalia/parse-md`; draft/sermon terima `serviceMd`; cover prompt + bigIdea + preset gaya + `coverStyle`) → `server/lib/didaskalia-diff.mjs` (6 baris diff SERMON baru) → `src/lib/didaskalia.ts` (tipe + default) → `DidaskaliaStudioPanel` (slot MD + Terapkan ke Ringkasan/7 Path; editor bigIdea/teksUtama/4 outline; pola gambar AI/UPLOAD/MOTIF + gaya visual; tombol Caption Khotbah) → `didaskalia-presentation.ts` (slide Garis Besar + Arahan Teknis per pola via `patternTechnicalBullets`; khutbah 4 section outline) → `rhb-caption.ts` (`buildPembekalanCaption`, `buildKhutbahCaption`) → `EventDidaskaliaMaterials` (3 tombol caption) → test `didaskalia-md.test.ts` (+8) → SOP `didaskalia-studio.md` §2a.

**Verifikasi:** `lint` bersih ✓ **773 test** hijau (+8) ✓ `build` OK ✓ parse file prod asli Y111026: Service ok (4/4 + info) & RHB ok (7/7) ✓

**Next:** uji staging 2026-10 pekan 2 (11 Okt Rescue Plan): tempel 2 MD → generate → enrich 1x → cover AI → 3 caption → approval HOD → publish. Lolos → ulangi di prod.

**Status deploy (5 Okt):** commit `104a660` → push main ✓ (prod auto-deploy) → `staging:sync` ✓ (branch staging = main, deploy `gehcpage-1r216yn4s`, semua alias staging menunjuk build baru, `/api/version` sama `104a660`).

## Current — Enrich per-path + auto-select minggu berjalan (6 Okt 2026)

**Latar:** enrich 1 panggilan raksasa (±9189 token) ditolak Groq (limit 8000 TPM) setelah OpenAI gagal lebih dulu; event picker default ke event terbaru (25 Okt) bukan minggu berjalan (11 Okt).

**Ubah:** `generateEnrichedDraft` dipecah 7 panggilan per Path + 1 khotbah (cap catatan 8000 char transparan via meta, gagal 1 hari tak menggugurkan lain, total gagal → error jelas) → meta enrich di respons + toast warning (path gagal/kepotong/catatan dipotong) → log ukuran prompt per model di provider → auto-select event `nearestUpcoming` (terdekat ≥ hari ini, toleransi 12 jam) + test.

**Verifikasi:** `lint` bersih ✓ **765 test** hijau (+7) ✓ `build` OK ✓

## Current — Guard kaya + preset Kembangkan + Bagian B ikut pola (5 Okt 2026)

**Ubah:** `richnessCheck` + tolak approve bila section kosong (400 + daftar Path) + peringatan susut/di-bawah-300 di ringkasan HOD → tombol preset **Kembangkan** di tab diskusi (template instruksi satu klik) → `PdfOptions.patternCode/patternName`, judul Bagian B PDF mengikuti pola (fallback pola generik bila kosong), `contentFromStudio` + meta presentasi bawa `patternCode`, deck web pakai kode (bukan nama lama basi) → teks "Senin–Sabtu" jadi "Minggu–Sabtu".

**Verifikasi:** `lint` bersih ✓ **758 test** hijau (+2) ✓ `build` OK ✓

**Next:** commit + push staging & main.

## Current — RHB kaya-vs-tipis: anti-hilang + hari fix + reset prod (5 Okt 2026)

**Diagnosis prod (data, bukan tebakan):** Okt W1 kaya (16544 char, 35/35, gen 2, diskusi 115 char) vs W2 tipis (1894 char, 20/35, gen 1, diskusi 1515 char) — korelasi volume catatan terkonfirmasi. Bonus: dayLabel bölgesel rusak (W1 Path 2 = "2026-10-05", Path 7 = "Saturday"; W2 = Senin..Minggu; Sep W4 Inggris semua) — penyebab: contoh skema enrich `"dayLabel":"Senin"` + nol normalisasi.

**Ubah:** contoh skema → Minggu + aturan hari eksplisit → `genOne`/`clampPaths`/`proposalFromDraft`/`sanitizePaths`/`ensurePaths` paksa kalender → enrich dapat `patternBlock` + larangan kosong → merge keep-old (kosong = pertahankan) + sermon guard → meta diagnosis (`models/truncated/promptChars`) di pengajuan + riwayat → guard susut >50% di ringkasan HOD → budget knowledge terlihat di tab Pengetahuan → SOP `docs/product/didaskalia-studio.md` → rename Post-to-Post & 3 Sequences.

**Data:** skrip `fix-didaskalia-week.mjs` (dry-run default; npm `:staging[:apply]`/`:prod[:apply]`) — dayLabel + slot regenerate saja (paths/khotbah utuh). Staging ✓ + prod ✓ (4 pekan, 0 sesi DUAL perlu migrasi). Seed worship staging + prod ✓ (nama baru, DUAL arsip, sesi 4 Okt utuh).

**Verifikasi:** `lint` bersih ✓ **756 test** hijau ✓ `build` menyusul saat commit.

**Next:** commit di branch, push menunggu perintah.

## Current — Reset pola 11 Okt + tombol Reset ke Monolog (5 Okt 2026)

**Temuan:** default pekan memang sudah MONOLOG di semua lapis; 11 Okt diganti manual ke BEDAH_FILM + dibuatkan sesi (`sesi-2026-10-11`, DRAFT, kosong 0/0/0) di staging & prod.

**Reset konkret:** pekan W2 Okt di kedua DB ternyata sudah MONOLOG — yang dibersihkan hanya sesi yatim: hapus cascade via skrip satu-kali (guard DRAFT + 0 respons/vote/catatan, transaksi) di **staging ✓ dan prod ✓** (items=0, chips=0). Sesi 4 Okt tak tersentuh.

**Fitur permanen:** `DELETE /api/worship/sessions/:id` (guard 404/409 + cascade transaksi; helper `deleteEmptySession` dipakai ulang) → `POST .../studio/:ym/:week/reset-pattern` (pekan → MONOLOG + hapus sesi DRAFT kosong tertaut, laporkan `deleted`/`kept`) → tombol **Reset ke Monolog** di tab Draft Sesi (dialog konfirmasi + refresh) → test `worship-session-delete` (+4) → docs `worship-patterns.md` §10.

**Verifikasi:** `lint` bersih ✓ test baru hijau ✓ (full suite menyusul saat commit).

**Next:** commit di branch, push menunggu perintah.

## Current — Sinkron penuh TiDB Prod → Staging (5 Okt 2026)

**Perintah:** salin terkini prod ke staging (semua tabel), lokal tidak disentuh.

**Jalan:** dry-run `db:copy:prod-to-staging` → 108/114 tabel, 8151 baris, tanpa error baca, password di-scrub, tabel rahasia dikecualikan → apply `--truncate --apply` → **8151 baris ditulis, 0 gagal (44,4 dtk)** → verifikasi staging: users 154, EventProgram 9, worship_sessions 2, likert_responses 378, check_ins 104, service_schedules 46 ✓.

**Koreksi penting:** copy menimpa `worship_patterns` staging dengan versi lama prod (MONOLOG 90 mnt + DUAL aktif) → seed ulang `db:seed:worship:staging` ✓ (MONOLOG gabungan 120 mnt, DUAL arsip, sesi 4 Okt + Likert + chip utuh).

**Belum:** seed worship **prod** masih versi lama (butuh perintah eksplisit bila mau disamakan); simulasi lokal kini bisa jalan melawan DB staging yang segar.

## Current — Standarisasi seed worship prod (5 Okt 2026)

**Perintah:** samakan prod dengan standar (MONOLOG gabungan, DUAL arsip).

**Jalan:** `db:seed:worship:prod` ✓ — verifikasi prod: MONOLOG ACTIVE 120 mnt, DUAL_MONOLOG ARCHIVED, POST_TO_POST/DEBAT/BEDAH_FILM/3SEQ tak berubah, 0 sesi dimigrasi, sesi 4 Okt + Likert + chip utuh. Staging + prod kini standar sama.

## Current — Monolog + Dual digabung (5 Okt 2026)

**Keputusan:** perluas MONOLOG → "Monolog, Bedah Lagu & Deep Sharing" (±120'); DUAL_MONOLOG ARCHIVED; sesi lama migrasi otomatis.

**Ubah:** seed (playbook + phases + modules gabungan; arsip + migrasi sesi di skrip seed) → template Draft Sesi (fgd + song judul/makna/penyanyi + deep 2Q; DUAL memetakan ke MONOLOG) → server (`config.song/fgd`, `sessionSong/deepGuide/fgdState/oneWordAggregate`, `allowedNoteCodes` +SATU-KATA, stage `fgd/song`, payload peserta + live `song/deepGuide/fgd/oneWord`, patternBlock MONOLOG) → client (engine 5 segmen + widget song + alias DUAL; PatternDay kartu lagu + Q terkunci-menunggu-pemicu + PDF seksi lagu; kontrol `FgdTriggerPanel` Q1–Q5 + pemicu mentor/co-mentor/perwakilan; layar lagu + Q terbuka + agregat Satu Kata; katalog sembunyikan arsip) → sim MTGN pola gabungan (lagu + deep Q kontekstual) → docs hari-H + worship-patterns.

**Verifikasi:** `lint` bersih ✓ **747 test** hijau ✓ `build` OK ✓ seed staging ✓ (MONOLOG gabungan; DUAL arsip; 0 sesi dimigrasi).

**Catatan:** upload Drive laporan staging gagal (`invalid_grant` kredensial SA staging) — laporan v3 ada di `docs/preview/`. Perubahan belum di-commit/push.

## Current — Hemat kuota Vercel Free: hapus 110+ deployment + longgarkan polling (5 Okt 2026)

**Gejala:** `Fluid Active CPU 8h17m/4h` + `Functions Storage 9.69GB/10GB` (screenshot). Invocations 174K/1M masih aman — masalah durasi CPU per-request + 159 deployment menumpuk, bukan traffic.

**Ubah:**
- Vercel CLI: `vercel list/alias/usage/inspect/api` dipelajari → keepers prod `dpl_D7hXF2BY64suGoPGxCcz99Noq6TJ` (youth.gehc.page + 20 alias) & staging `dpl_EsPFiiUCkdtJ8pz8k4bohmXjxhGL` → hapus ~110 deployment yatim via `vercel remove <uid> --safe --yes` (5 batch, `--safe` lindungi ber-alias).
- Polling: `MentoringScreen 3s→15s`, `MentoringControl/MentoringDay/PatternDay 5s→20s`, `EventCheckInTab 8s→15s` + `document.hidden` guard; `useMediaSlots refetch 60s→5min + no-focus-refetch`.
- Cache publik: `unit-landing/church-profile/org/public-tree` → `max-age=60, s-maxage=300, stale-while-revalidate=600`.
- `.vercelignore` baru: kecualikan backups/logs/token dari Deployment Storage.

**Verifikasi:** `lint` bersih ✓ `test` 732/733 (1 flaky timeout lolos saat diulang) ✓ prod+staging READY ✓

**Next:** cek dashboard Usage (Storage harus turun <5GB) → deploy staging baru → pantau CPU 2-3 hari → bila masih jebol: pecah `api/index.mjs` + lazy `sharp/googleapis/ai`.

**Commands:** `vercel list --limit 50`, `vercel alias list`, `vercel remove <uid> --safe --yes`, `npm run lint`, `npm run test`

## Current — Simulasi 6 pola More Than Good News + peran 2 perikop (5 Okt 2026)

**Kebutuhan:** draft hanya 1 perikop, studio Didaskalia ada 2 (Fundamental Firman + Kitab Fokus) — jadikan concern eksplisit; simulasi tiap pola dengan perikop More Than Good News; laporan markdown dikirim ke email gehcofficial.

**Ubah:** `generateSessionDraft` (`didaskalia-ai.mjs`): blok `pericopeBlock` (Fundamental = jangkar, semua slot solusi wajib sebut ref; Kitab Fokus = bacaan/pendalaman) + larangan placeholder `{{...}}` + topik code dikunci HUBUNGAN/PEKERJAAN/KELUARGA + skema Zod dilunakkan ke strict-mode OpenAI (tanpa optional/record) → `scripts/simulate-session-drafts.mjs` (baru; 6× live AI, read-only DB, JSON + `docs/preview/simulasi-more-than-good-news.md` + tabel cakupan perikop; npm `sim:session-drafts`) → test prompt perikop (+2).

**Hasil simulasi:** POST_TO_POST 18/18 slot solusi merujuk 1Kor 15:3-4 ✓; DEBAT trap-reveal ✓ + 5 mosi valid; BEDAH_FILM scenes/pleno/Q2 ✓; MONOLOG observasi ✓; DUAL placeholder `{{firman_ref}}` ketahuan → sudah diperbaiki & diverifikasi ✓; 3 Sequences jarang (jujur tercatat di laporan).

**Verifikasi:** `lint` bersih ✓ **733 test** hijau (+2) ✓

**Next:** mekanisme kirim email (belum ada SMTP/Resend di proyek — butuh kredensial atau alternatif Drive) → kirim laporan → commit + push.

**Tambahan:** skema Zod POST_TO_POST dilunakkan ke strict-mode OpenAI (tanpa optional/record; `affirmations` jadi array) — bug ini juga memengaruhi Draft Sesi tab untuk pola Post-to-Post. Simulasi menemukan AI menyalin placeholder `{{firman_ref}}` → prompt dilarang + diverifikasi bersih.

**Terkirim (ganti email → Drive, sesuai pilihan):** `simulasi-more-than-good-news.md` terunggah ke folder Didaskalia event 4 Okt (staging): https://drive.google.com/file/d/15IxF3EnoHlOczj_mpEyNPwONk7PKJDA7/view — npm `sim:session-drafts:upload:staging` (idempoten, file lama senama dihapus dulu). Perubahan belum di-commit.

## Current — Simulasi v2 (eksegesis-pertama) + auto-hadir petugas (5 Okt 2026)

**Sim v2:** prompt `generateSessionDraft` dua langkah (eksegesis 3–5 poin + 2–3 implikasi dari teks, lalu slot; output `exegesis` ikut dikembalikan) + anti-contoh + kontekstual Beyonders + kunci `film-alt` (2 kandidat + alasan; templatedraft ikut bertambah) → skrip: § eksegesis, deteksi contoh lama (`gavin stone`, bungsu/sulung, sisa `{{...}}`), arsip v1 → `docs/preview/simulasi-more-than-good-news.md` v2 + upload Drive menimpa (file baru, folder sama). Hasil jujur: P2P 18/18, Debat/Film/Monolog baik, Dual masih bungsu/sulung (ter-flag ⚠️ untuk reviewer), 3SEQ jarang.

**Auto-hadir petugas (semua peran, saat CONFIRMED, cabut saat batal):** `server/lib/petugas-attendance.mjs` (baru, murni + teruji: auto/auto-filled/kept-manual/revoked/revoked-hadir/kept-manual-scan) → hook di PATCH tunggal + bulk-status `service-schedule` (efek samping try/catch, respons bawa `attendanceSync`) → scan QR baris auto = OK "kehadiran fisik terkonfirmasi" + stempel `manualScan` → stats check-in tambah kartu `Otomatis (petugas)` → caption kartu tugas → skrip `backfill-petugas-attendance.mjs` (dry-run default; npm `backfill:petugas-attendance[:staging]`). Dry-run lokal & staging: 20 penugasan CONFIRMED akan terisi (`would-auto:20`).

**Verifikasi:** `lint` bersih ✓ **743 test** hijau (+10: 2 prompt + 8 petugas) ✓ `build` OK ✓

**Next:** commit di branch (push staging & main menunggu perintah) → backfill `--apply` staging → uji 1 confirm + 1 scan di staging.

**Status push (5 Okt):** `9d5872f` → merge main → push main ✓ + `staging` ref ✓ → `deploy:staging` ✓ READY (build 22:57, semua alias) → remote main = staging = `9d5872f` ✓. Main = prod — deploy prod mengikuti Vercel Production.

## Current — Ronde Debat + penanda film + papan tim: PatternDay generik (5 Okt 2026)

**Lanjutan fase 2:** `SEGMENT_WIDGETS` di `session-engine.ts` (guide/rounds/screening/teams/testimony/notes/download per segmen) → `server/lib/session-stage.mjs` (validasi murni rounds/screening/teams) → `PUT .../sessions/:id/stage` (tulis live, admin Didaskalia) + `rounds/screening/teams` di payload peserta & layar → `PatternDay.tsx` (baru, generik; `FgdDay.tsx` dihapus) + `MentoringDay` beralih untuk semua non-post-to-post → layar: mosi + fase + skor (Debat), countdown film (Bedah Film), papan tim (3 Sequences); `StagePanels.tsx` (baru: Debat/Screening/Teams) di `MentoringControl` per pola → test `session-engine` (+7: widget + validasi stage).

**Verifikasi:** `lint` bersih ✓ **731 test** hijau (+7) ✓ `build` OK ✓

**Next:** commit + push (staging & main, menunggu perintah) → seed worship staging (modules baru) → uji E2E ringan per pola di staging.

**Status staging (5 Okt, fase 1+2):** branch `cursor/session-stage-fase2` (`b2c9ef9`) → push origin ✓ + `staging` ref ✓ (main tetap `22524f1`, prod aman) → `deploy:staging` ✓ (READY, semua alias menunjuk build baru) → `db:seed:worship:staging` ✓ (6 pola termutakhirkan modules, sesi 4 Okt utuh).

## Current — Engine sesi generik + testimony + FGD tuntas + doc hari-H 180-max (5 Okt 2026)

**Kebutuhan:** cara kerja teknis terstruktur per pola (setara post-to-post: likert, catatan, arahan pos); catatan + komitmen + unduhan di semua pola; undian kesaksian otomatis 4 orang (2 Mentee + 1 Mentor + 1 Co-mentor, spin wheel dari yang hadir); dokumen hari-H satu file (180 max, merger default, trek paralel, terima kasih tuan rumah saja).

**Ubah (fondasi + FGD):** `src/lib/session-engine.ts` (baru: registry segmen 5 pola + gerbang + slot catatan + label modul) → `server/lib/testimony.mjs` (baru: komposisi + tanpa-ulang, murni) → `server/routes/worship.mjs` (`normalizeConfig` loloskan `testimony`; `allowedNoteCodes` = topik + KESIMPULAN/KOMITMEN + kunci draft; `fgdGuide` dari draft; `guide` + `testimony` di payload peserta & live; endpoint `testimony` pool/draw/reset + guard status) → `SessionNotes.tsx` (baru: autosave generik) → `mentoringPdf.ts` (`buildSessionRecapPdf` generik; builder lama utuh) → `FgdDay.tsx` (baru: panduan + catatan + komitmen + PDF) + switch pola di `MentoringDay` → `TestimonyWheel.tsx` (baru: roda di layar) + view FGD di `MentoringScreen` → `TestimonyPanel.tsx` (baru) di `MentoringControl` → seed `modules` (fgd/testimony/rounds/screening) + label → `docs/product/pola-ibadah-hari-H.md` (baru: 180-max, elastis, gabung, paralel, spin, tabel 6 pola) + `worship-patterns.md` §7 + indeks `docs/README.md` → test `session-engine.test.ts` (+12).

**Belum (menyusul per pola):** UI ronde/juri Debat, penanda putar Bedah Film, papan tim 3 Sequences (registry + rundown sudah jalan).

**Verifikasi:** `lint` bersih ✓ **724 test** hijau (+14) ✓ `build` OK ✓

**Next:** commit + push (staging & main) → seed worship staging (modules baru) → uji FGD + undian di staging.

## Current — Fix global "Belum ada event" per-akun (5 Okt 2026)

**Gejala:** beberapa HP (iPhone & Samsung) tidak melihat info event (QRIS, post-to-post, materi Didaskalia, absensi); HP model sama bisa tampil di user lain; akun yang dipakai sama dengan saat daftar.

**Akar (satu sebab, semua gejala):** `GET /api/events` (`server/index.mjs`) hanya menampilkan event yang ≥1 divisinya cocok `StrukturMember.division` user (`canSeeEventDivision`). User tanpa baris struktur / divisi tak cocok → daftar kosong → `EventInfoPanel` "Belum ada event" → tanpa `ev.id` tidak ada fetch registrasi (QR), worship, materi, absensi. Audit lokal membuktikan: **256/256 akun peran portal tanpa baris struktur** (cocok 0/2 event). Bukan masalah device.

**Ubah:** `server/lib/event-visibility.mjs` (baru: `hasPortalRole`, `memberListAccess`, `sameDivision`; prinsip keberadaan event ≠ akses panel divisi) → `GET /api/events`: staf tetap full; peran portal valid melihat semua event + `meta.access` (`full|division|open|none`) + log server bila fallback terpakai; tanpa peran → kosong + alasan → `canSeeEventDivision` samakan struktur via `userId` dulu (tetap ketat; dipakai gate diskusi divisi) → `EventInfoPanel`: empty-state bedakan "belum punya peran jemaat" vs "belum ada event" → `scripts/audit-event-access.mjs` (baru: laporan + `--email` + `--apply` taut userId; npm `audit:event-access[:staging|:prod]`) → test `event-visibility.test.ts` (+7).

**Panel divisi TIDAK dilonggarkan** (403 drive, requireDivision, diskusi divisi tetap).

**Verifikasi:** `lint` bersih ✓ **712 test** hijau (+7) ✓ `build` OK ✓ audit lokal jalan ✓

**Status deploy:** commit `a35d46a` → push main ✓ → `staging:sync` ✓ (main & staging `a35d46a`) → audit staging: akun `cocok=0/2` terkonfirmasi (kini terlihat via fallback) ✓ working tree bersih ✓

**Next:** uji 1 akun tanpa divisi di staging (buka Info Event → event muncul) → prod (push/merge) + audit prod.

## Current — Tab Draft Sesi: kosongan per pola + Isi dari AI + guard sesi terisi (5 Okt 2026)

**Kebutuhan:** tab khusus berisi draft kosongan per pola yang tersinkron AI pembekalan/RHB/khotbah — setelah pilih pola ibadah, isi draft pola ikut terisi; sesi 4 Okt yang sudah ada isi tidak boleh tersentuh.

**Ubah:** `src/lib/worship-session-draft.ts` (baru: template kosongan 6 pola, `draftToStored`/`storedToSections`, `countFilled`, `sessionDraftGuard`, `templateFieldKeys`) → `server/lib/didaskalia-ai.mjs` (`generateSessionDraft`: Post-to-Post terstruktur penuh via `jethroGenerateObject` + Zod, pola lain nilai per kunci template) → `POST /api/didaskalia/studio/:ym/:week/session-draft` (usulan saja, RBAC Didaskalia) → `server/routes/worship.mjs` (`normalizeConfig` loloskan `config.draft`; `eventId` di list/detail sesi; `POST .../sessions/:id/apply-draft` dengan guard 409: bukan DRAFT / ada jawaban / sudah berisi) → `src/components/portal/SessionDraftTab.tsx` (baru: cari/buat sesi event pekan → form kosongan → Isi dari AI → Simpan draft → Terapkan) → tab `Draft Sesi` di `DidaskaliaStudioPanel` → test `worship-session-draft.test.ts` (+18) → `docs/product/worship-patterns.md` (§9).

**Review:** Portal → div Didaskalia → Studio → tab **Draft Sesi** (tanpa migrasi DB; `config.draft` JSON).

**Verifikasi:** `lint` bersih ✓ **705 test** hijau (+18) ✓ `build` OK ✓

**Next:** commit + push staging & main → seed worship staging (playbook 7 bagian) → `staging:sync`.

## Current — Draft template 6 pola ibadah + tab Katalog di Studio (5 Okt 2026)

**Kebutuhan:** 5 pola selain Post-to-Post didetilkan seperti Post-to-Post (draft template per pola, mengikuti penyesuaian tema + firman); satu tempat review semua draft.

**Ubah:** `server/_seed-worship-patterns.cjs` (6 playbook jadi template baku 7 bagian: identitas–pra-acara–rundown–naskah siap baca–modul web–peran–adaptasi `{{tema}}/{{firman_ref}}/{{firman_text}}/{{kitab_fokus}}`; `phases[].notes` per fase) → `server/lib/didaskalia-ai.mjs` (`patternBlock`: cabang eksplisit DUAL_MONOLOG + THREE_SEQUENCES, phase `notes` ikut ke prompt) → `src/lib/worship-patterns.ts` (baru: `patternTotalMinutes`, `patternTemplateCheck`, `patternDurationDelta`, `moduleLabel`) → `src/components/portal/WorshipPatternCatalog.tsx` (baru: kartu 6 pola + rundown tabel + playbook 7 bagian + Salin naskah + Pakai pekan ini) → `DidaskaliaStudioPanel.tsx` (tab `pola` = katalog + `MentoringControl`; fix tipe tab; tautan `Lihat detail pola →` di dropdown Inti) → test `worship-patterns.test.ts` (+12) → `docs/product/worship-patterns.md` (§8).

**Review:** Portal → div Didaskalia → Studio → tab **Pola Ibadah** (butuh DB ter-seed baru agar playbook 7 bagian tampil: `npm run db:seed:worship` lokal / `:staging`).

**Verifikasi:** `lint` bersih ✓ **687 test** hijau (+12) ✓ `build` OK ✓

**Next:** seed staging (`db:seed:worship:staging`) → cek tab katalog staging → `staging:sync`; prod hanya setelah disetujui (`db:seed:worship:prod` idempoten via upsert per `code`).

## Current — Upload foto event → Warta: kompres HEIC otomatis (4 Okt 2026)

**Masalah:** mentee + akun Marturia gagal upload foto by-event (beberapa foto dipilih tapi nol tersimpan), sementara gallery grup bisa. Penyebab: `POST /api/gallery/jemaat` upload mentah tanpa kompres + tolak HEIC (`type=""`) + batas 8MB; frontend `break` saat file pertama gagal lalu pilihan dibuang; endpoint arsip panitia tolak MENTOR/CO_MENTOR di `requireRole`.

**Ubah:** `server/index.mjs` (jemaat pakai `decodeImageUpload`+`toJpegBuffer` ≤1600px/~900KB, terima HEIC by-ekstensi, batas mentah 15MB, nama `.jpg`, error spesifik) → `drive-jpeg.mjs` (`decodeImageUpload` dukung override `maxBytes`) → `gallery-jemaat.mjs` (konstanta `RAW_MAX 15MB/20MB-base64`) → `drive-ownership.mjs` (arsip + gallery/photos izinkan MENTOR/CO_MENTOR + pesan 403 actionable) → `EventPhotoShare.tsx` (terima `.heic/.heif`, batas 15MB, hasil per-file tanpa buang yang gagal, info kuota/jendela) → `WartaPublikTab.tsx` (blok Dokumentasi di editor + strip foto di kartu list) → test `drive-jpeg.test.ts` (+6: HEIC by-ekstensi, tolak non-gambar, prefix data-url, override 15MB, output JPEG valid).

**Alur foto → warta:** mentee upload (PENDING) → Marturia Setujui → Sematkan preview (≤10) → event DONE → `Draf Warta` (maks 10 URL approved, cover = foto pertama) → lengkapi + `PUBLISHED` → tampil di landing Warta.

**Verifikasi:** `lint` bersih ✓ **675 test** hijau (+6) ✓

**Tambahan (menyusul):** `EventGalleryTab` upload Marturia dirapikan — pesan per-file (tidak lagi tertimpa pesan sukses), warna merah bila gagal, file picker terima `.heic/.heif`. Lint + test unit tetap hijau.

## Current — Role ganda + upload 413 + folder Marturia (4 Okt 2026)

**Laporan:** (1) akun pindah MENTEE Kairos → CO_MENTOR Dunamis tapi portal tetap mentee; (2) upload foto event masih gagal generik; (3) folder `Marturia [MENTOR]` berantakan.

**Ubah:**
- Role: `syncRosterRole` + `assignRoleToUser` (`role-assign.mjs`) + `PATCH /api/role-assignments/:id` (`index.mjs`) kini selalu hapus baris `UserRole` lama (tanpa peran ganda, seperti `placePerson`); endpoint audit read-only `GET /api/role-assignments/audit-duplicates` (multiRole, menteePlusLead, drift RA↔UserRole); test `member-role-sync.test.ts`.
- Upload: `express.json` 8MB→20MB + 413 JSON (`createApp.mjs`); `gallery/photos` limit 15MB + pola 400/422 seperti jemaat (`drive-ownership.mjs`, `drive-jpeg.mjs` dukung override `maxBytes`); pesan klien sertakan `(server STATUS)`; diagnostik `GET /api/diagnostics/sharp` (heifInput/libvips per environment).
- Folder: skrip `_migrate-marturia-to-arsip-event.cjs` (`--dry/--apply/--cleanup`, pindah `[EV:*:MARTURIA]` → `Arsip Event`, trash hanya yatim kosong, ID tetap) + cabang MARTURIA di `createEventFolder` + fallback root + npm `drive:migrate:marturia-arsip-event[:dry|:prod]`.

**Verifikasi:** `lint` bersih ✓ **676 test** hijau (+1) ✓ skrip `node --check` OK ✓

**Next (butuh akses/keputusan):** deploy staging → `GET /api/diagnostics/sharp` di staging+prod (jawab HEIC Vercel) → uji HEIC HP → `GET /api/role-assignments/audit-duplicates` di prod → hapus baris lama akun tsb (DELETE + logout→login) → migrasi folder `--dry` dulu, `--apply` setelah disetujui → `staging:sync`.

## Current — Voting Pelsus 11 Okt 2026 (4 Okt 2026)

**Kebutuhan:** Pemilihan Pelsus level gereja (Penatua BIPRA, Penatua/Diaken Kolom, BPMJ fase-2) di GEHC.page — akun sendiri + 5 laptop bilik (token) + manual tervalidasi, anti-ganda, layar per election (partisipasi live, hasil setelah CLOSED). Alur warta: Juklak → Absensi/Kuorum → Cara → Pilih.

**Ubah:** skema `Pelsus*` (6 model `prisma/schema.prisma`) + migrasi `server/_migrate-pelsus.cjs` (wired `db-migrate-local` + npm `db:migrate:pelsus[:staging|:prod]`) → API `server/routes/pelsus.mjs` (list/detail/ballot 1-submisi immutable/live-cache 2,5 dtk/results+CSV Berita Acara/elections CRUD+DPT sync-import/kandidat/token bilik 10 mnt/checkin manual/promote BPMJ; `requireRole`, admin = SUPERADMIN/BPMJ/KOMISI/COMMITTEE) → frontend `#/pelsus` (`src/lib/pelsus.ts`, `isPelsusHash`, `PelsusApp.tsx`: home + surat suara + bilik kiosk auto-reset + layar kode + panel panitia; polling 15 dtk/5 dtk + backoff anti-thundering-herd) → seed `server/seed-pelsus.mjs` (19 elections DRAFT + DPT dari User) → panduan `docs/product/pelsus-panduan.md` (warta + bilik + WA) + test `pelsus.test.ts` (+1 host-context).

**Anti-kambuh Likert:** agregat GROUP BY + count (tanpa full-scan), ballot 1 transaksi pendek + increment atomik + unique DB final, live cache, retry/backoff klien.

**Data:** migrasi jalan (6 tabel) ✓ seed 19 elections + 193 DPT ✓ (DB `.env`).

**Verifikasi:** `lint` bersih ✓ **669 test** hijau (+11) ✓ `build` OK (chunk PelsusApp 24 kB) ✓ `db:schema:check` sinkron ✓ smoke API vs staging **22/22 PASS** (login, 19 elections, DPT import, ballot, 409 ganda, token-denied, reset; DB bersih kembali) ✓

**Status deploy:** commit `ae1dc0c` → push `cursor/pelsus-voting` ✓ migrasi+seed staging ✓ (19 elections DRAFT + DPT). `vercel login` (gehcofficial) → `deploy:staging` ✓ alias staging menunjuk preview baru ✓ verifikasi live: `/api/version` OK, login 200, `/api/pelsus` = 19 elections + canAdmin ✓ (BPMJ/ANAK total 0 = wajar, DPT via import/promote).

**Next:** (a) buka preview branch `cursor/pelsus-voting` dari dashboard Vercel, atau `vercel login` lalu `deploy:staging`; (b) simulasi UI 7 langkah di preview/staging; (c) OK → merge `main`; (d) H-2: migrasi+seed `:prod`, OPEN hari-H. Lokal bisa simulasi sekarang: `npm run dev:all` → `localhost:3000/#/pelsus` (DB staging siap).

**Simulasi Playwright (commit `193145b`):** `npm run pelsus:sim` → **5/5 PASS** (1,6 mnt, config produksi-instan) → klip `public/media/pelsus/01–05` terverifikasi visual (caption + alur benar) → DB staging bersih (assert 0 orphan). Temuan & fix: regex caption, caption tahan-reload, `markOnly` 400, `createMany([])` 500, `abstain is not defined` 500 (vote tercatat tapi respons gagal!), DELETE tanpa cascade → orphan (fix: cascade eksplisit + 8 FK; 207 baris orphan lama dibersihkan) → + tombol Hapus election. Staging redeploy (preview `gehcpage-h6ga6d3mi`) + verifikasi live: 19 elections, DELETE-route baru aktif. `lint` + **675 test** hijau.

**Bukti rotasi status (staging, commit `b32bf26`):** Tutup→Draft→tambah→Buka = suara utuh (A=1, B=0), tambah saat OPEN tetap 409, anti-ganda 409, DELETE bersih 0 orphan — **17/17 PASS**. Sambil jalan ketemu + fix 1 bug rekap: `turnout.abstain` (dulu `voted-minus` → selalu salah; kini = pemilih tanpa ballot). Staging redeploy + terverifikasi live.

## Current — Sub Pembekalan dan Pengarahan Didaskalia (4 Okt 2026)

**Missed lalu:** Didaskalia punya sub `Pembekalan dan Pengarahan` (Diferd + Putri). Struktur kini: HoD + `Kurikulum dan Modul` + `Pembekalan dan Pengarahan`.

**Ubah:** alias display + canonical (`pillar-groups.ts`), `SUBDIVISION_CHILDREN`, seeds, i18n ID (`Equipping & Briefing`) + EN, opsi ManageStruktur, peta legacy; migrasi `migrate-istilah-baku` diperluas (termasuk `org_assignments.position` yang ketinggalan ronde lalu — ketahuan saat verifikasi).

**Data:** staging + prod applied ✓ prod: HoD Alvandi, Kurikulum dan Modul (Jeremia, Michel), Pembekalan dan Pengarahan (Diferd, Putri) ✓

**Verifikasi:** `lint` bersih ✓ **658 test** hijau ✓ `build` OK ✓ browser staging ✓

**Next:** push staging+main; cek prod.

## Current — Istilah baku Indonesia (3 Okt 2026)

**Keputusan:** sub-divisi + jabatan + peran dinas dibakukan KBBI-proper (Benevolence→Kedermawanan, Merchandise→Cenderamata, Story→Cerita, Intercession→Syafaat; Chairperson/Secretary/Treasurer awalan dibuang; Comentor→Co-mentor; PIC→Penanggung Jawab) + dedupe fungsi (Song Leader→Pemimpin Pujian; Firman 1/2→Pembaca Firman; Liturgist→Pemimpin Liturgi; dst, 30→27 peran).

**Ubah:** `pantatugas.ts`, `org-legacy-slots`, seeds (users/initialData/onboarding/service-roles), i18n ID+EN, keywords ikon, prosa runbook, test fixtures. Migrasi `server/migrate-istilah-baku.cjs` (+`drive-rename.mjs`, dry-run default): DB + folder Drive.

**Jalan:** staging penuh (subs 4, posisi 13, role 11, pindah 1, nonaktif 2, org 8, Drive 4 folder) ✓ prod penuh (DB + 3 folder Drive; timeout sekali di tengah — rerun idempoten selesai) ✓ browser staging: chip nama + ikon baru ✓ data uji Okt prod utuh (panitia aktif edit, bukan efek migrasi) ✓

**Verifikasi:** `lint` bersih ✓ **658 test** hijau ✓ `build` OK ✓

**Next:** push staging+main; catatan: folder Drive lama tak tersisa duplikat; role kustom (Cajon, Drama, Pengawas Agenda, Liturgist-Shyllo) tak disentuh.

## Current — Header BPMJ nama lengkap (3 Okt 2026)

**Ubah:** seksi BPMJ di Orang Kami berjudul `BPMJ — Badan Pekerja Majelis Jemaat` + sub `Payung tertinggi pelayanan pemuda` (ID+EN). Murni label.

**Verifikasi:** `lint` bersih ✓ (staging tak ada data org → cek visual di prod yang berdata).

**Next:** push staging+main.

## Current — BPMJ teratas + pilar per sub-divisi (3 Okt 2026)

**Ubah:** urutan BPMJ → Komisi → Tim Kerja → pilar (struktur gereja) ✓ tiap kartu divisi: Kepala Divisi dulu, lalu per sub-divisi canonical (yang kosong tetap tampil + `Belum ada anggota.`), tanpa teks ganda bila sub == jabatan ✓ (`pillar-groups.ts`: `isHeadOfDivision`, `dedupeRoleLine`, `groupPillarMembers`).

**Verifikasi:** `lint` bersih ✓ **657 test** hijau (+5) ✓ `build` OK ✓ browser staging: struktur tampil (org staging kosong → semua sub `Belum ada anggota.`, sesuai desain) ✓

**Next:** push staging+main; cek prod (data nyata: HoD + sub terisi).

## Current — Rapikan halaman Orang Kami (3 Okt 2026)

**Ubah:** Komisi Pemuda + Tim Kerja paling atas → BPMJ → 6 pilar; buang bagan OrgTree + mini-list About (rangkap); kartu foto besar → baris nama+jabatan; narasi Siapa Kami dipadatkan (ID+EN); typo `Mengasihi`; deskripsi 6 pelayanan sumber tunggal `PANTATUGAS` (id.ts menumpang, en.ts terjemahan).

**Data:** `Midun XCp` → `Pnt Noldy Wanget` (prod + staging; akun noldyjwnew@). Audit: struktur staging 39 baris bersih; prod 11 placeholder OK; users/groups/assignments disisir untuk 'midun'.

**Verifikasi:** `lint` bersih ✓ **652 test** hijau ✓ `build` OK ✓ browser staging: urutan + narasi + tanpa foto besar ✓

**Next:** push staging+main; cek prod.

## Current — Tab Ajak & Jemput Koinonia (3 Okt 2026)

**Fitur:** caption siap-tempel (`event-invite-caption.ts`): sapaan + event/tanggal/venue + link `#/event/<slug>` (tanpa login) + 3 langkah daftar + absensi QR (tegaskan BUKAN QRIS) + 4 manfaat (QR, WA carpool, tercatat, kartu terima kasih). Tab `ajak` baru di panel Koinonia: pilih event terdekat → pratinjau editable → Salin / Kirim WA.

**Verifikasi:** `lint` bersih ✓ **652 test** hijau (+5) ✓ `build` OK ✓ browser staging: tab tampil, caption terisi data event, Salin + wa.me ter-encode ✓

**Next:** push staging+main; Tuan Rumah tinggal pakai tiap minggu.

## Current — Foto jemaat → kurasi 10 Marturia (3 Okt 2026)

**Alur:** peserta terdaftar upload di Info Event (`EventPhotoShare`, PENDING, subfolder Foto Jemaat auto, 8MB, 5/orang, H−1..H+7) → Marturia approve → sematkan 10 (`previewList`/archive/pin 5→10 + counter n/10) → Warta/landing. Endpoint `POST /api/gallery/jemaat` (aturan murni di `server/lib/gallery-jemaat.mjs`).

**Verifikasi:** `lint` bersih ✓ **647 test** hijau (+4) ✓ `build` OK ✓ E2E staging: 403 tak terdaftar → 201 PENDING → approve → Disetujui; counter 0/10 ✓ data uji dibersihkan (DB + Drive) ✓

**Next:** push staging+main; Marturia mulai kurasi foto 4 Okt.

## Current — RHB panjang + teknis pola + gambar slide AI (3 Okt 2026)

**Masukan mentor:** terlalu pendek; mau naskah siap-baca; terikat teknis pola; default trio metode; ringkasan bergambar AI; pembekalan tanpa arahan visual.

**Ubah:** batas summary 150 kata / section 300–600 char + MAKNA wajib naskah siap-baca (direct speech) ✓ `patternBlock` teknis per pola (fase/durasi/pemilik dari DB) ✓ default metode Praktika/Tematika/Biblika ✓ endpoint `POST .../sermon-image` per slide (kuota terpisah 8/minggu; tanpa teks di gambar) + tombol per-slide & bulk di Studio ✓ deck web + PDF khutbah render gambar per slide ✓ callout Arahan Visual dihapus dari deck + PDF pembekalan (visualNote tetap jadi prompt gambar) ✓ token naik (path 4500, sermon 6000).

**Verifikasi:** `lint` bersih ✓ **643 test** hijau (+2) ✓ `build` OK ✓

**Next:** push staging+main; generate uji 1 pekan (catatan: biaya gambar OpenAI per slide).

## Current — AI membaca pola ibadah mingguan (3 Okt 2026)

**Masalah:** AI tidak pernah diberi tahu pola — prompt FGD di-hardcode, pola hanya dipakai sesi hari-H.

**Ubah:** seed pola ke-6 `MONOLOG` (default eksplisit) staging+prod ✓ pekan Studio simpan `patternCode` (default MONOLOG) ✓ blok `patternBlock()` disuntik ke generate draft/sermon/extras (MONOLOG→FGD; Post-to-Post→rute kunjungan; Debat→ronde; Bedah Film→pleno; else→skenario pola) ✓ dropdown pola di Studio (tersimpan, ikut semua generate) ✓ deck Pembekalan Bagian B judul + fallback mengikuti pola ✓ standar isi RHB tetap di semua pola.

**Verifikasi:** `lint` bersih ✓ **641 test** hijau (+4 pola, mock provider) ✓ `build` OK ✓ minggu lama tak tersentuh (hanya generate baru).

**Next:** push staging+main; generate uji 1 pekan Post-to-Post.

## Current — Hapus Warta 1 + backfill Drive semua event (3 Okt 2026)

**Warta 1** (`cnt-warta-warta-mtodkwj1yeqo`) dihapus permanen staging+prod ✓ feed publik bersih ✓.

**Backfill** `server/_backfill-event-drives.cjs` (+ npm `drive:backfill-events[:staging|:prod]`, dry-run default): 6 divisi + folder Drive per divisi + folder arsip Marturia per event. Staging: 7 divisi + 29 folder + 6 arsip. Prod: 16 divisi + 43 folder + 9 arsip, 0 gagal. `public-archive` prod: 9 event `hasArchive=true` (termasuk ARCHIVED BAKU TAU) ✓ previews masih kosong → giliran kurasi Marturia.

**Next:** kurasi 10 foto/event (Marturia) → Warta etalase; upload susulan jemaat jalan via folder yang sudah ada.

## Current — Seksi PJ/TR collapsible + grup TR tetap tampil (staging) (3 Okt 2026)

**Ubah:** `ServiceDutySections` — Penanggung Jawab (Liturgia/Didaskalia/Marturia + nama grup) + Tuan Rumah (Koinonia/Diakonia + **nama grup tetap tampil** walau kosong, tanpa dump anggota). Trigger chevron kiri + mini-stack foto, default tertutup. Konsisten mentoring & serving day (Warta + Info Event).

**Verifikasi:** `lint` bersih ✓ **637 test** hijau ✓ `build` OK ✓ browser vs DB staging: PJ·6/TR·4 + expand per divisi ✓ TR 11 Okt: `Hesed (perkiraan)` + `Belum ada.` ✓

**Next:** push staging (ini); cek visual; merge `main` bila OK.

## Current — Database tempat pos + peta 4 Okt (Lt1/Teras) (3 Okt 2026)

**Latar:** Lt 2 dipakai rapat BPMJ/Komisi 4 Okt. Master `worship_venues` (7 tempat + kapasitas) + sesi menunjuk 3 tempat per prioritas; hitung/kapasitas tampil, tanpa alih otomatis.

**Ubah:** tabel `WorshipVenue` + migrasi/seed npm (`db:migrate:worship-venues`, `db:seed:worship-venues` [:staging|:prod]) → config sesi `floors[]` bawa `venueId/capacity` → endpoint `GET/POST/PUT /api/worship/venues` (baca semua peran; tulis Didaskalia) → picker Rank1/2/3 di control room (+ total kursi, validasi beda & aktif) → payload `rooms`/`myResult` bawa `venue/capacity/isFull` → UI peserta (`12/25` + badge Penuh), layar proyektor, monitor kontrol.

**Data:** seed 7 tempat staging+prod ✓ peta 4 Okt Rank1→Lt 1 (40), Rank2→Teras Kiri (25), Rank3→Teras Kanan (20), total 85 ✓ kedua sesi DRAFT; data uji kemarin dibersihkan (prod 9+3+4, staging 9+3) — PENTING: sesi prod sempat WRAPUP (ada yang mengetes di prod), sudah reset.

**Verifikasi:** `lint` bersih ✓ **637 test** hijau (+2 venue config) ✓ `build` OK ✓

**Next:** push staging+main; cek control room (pilih tempat) + layar proyektor besok; Lt 2 bisa diaktifkan lagi via master setelah rapat.

## Current — Petugas per divisi + Kegiatan Studio-first (3 Okt 2026)

**Ubah:** daftar chip petugas (Warta + Info Event) dikelompokkan per Panca Tugas — header ikon+warna+jumlah (`groupPeopleByDivision`, `DivisionDutyGroup`); tuan rumah tetap datar. Grid Drive 01/02/03 di Kegiatan hanya tampil bila ada file; bila kosong → `Materi Studio menyusul dari Didaskalia.` Sekaligus menghapus teks bocor admin (`upload di Panel Divisi → …`) di 4 titik. Blok Presentasi Web Studio tetap acuan utama.

**Verifikasi:** `lint` bersih ✓ **635 test** hijau (+5) ✓ `build` OK ✓ browser vs DB staging: Warta 4 Okt (5 seksi divisi ×2) ✓ Kegiatan (link Studio + tanpa grid) ✓

**Next:** cek visual prod setelah deploy.

## Current — Konfirmasi tanggal lahir + link Studio di Kegiatan (3 Okt 2026)

**Latar:** input `type="date"` mengikuti locale browser (en-US → mm/dd/yyyy) — dua kasus HUT kemarin salah bulan karenanya. Data wire selalu YYYY-MM-DD (server benar).

**Ubah:** komponen bersama `BirthDateField` (native picker + konfirmasi long-date ID + usia, mis. `Rabu, 10 Maret 2004 · usia 22 th`) + helper `formatLongDateId()`; dipasang di edit admin (`YouthGEHCList`) & profil mandiri (`MyProfilePanel`). **Kegiatan** (`IbadahMingguanPanel`): blok Presentasi Web Studio (Pembekalan/Ringkasan/RHB, hormati canView01/03) per event terpilih — sama seperti Info Event.

**Verifikasi:** `lint` bersih ✓ **630 test** hijau (+3) ✓ `build` OK ✓ (satu temuan samping: `formatBirthDateInput` rapuh zona waktu — di luar scope, tidak diubah).

**Next:** cek visual (form HUT + Kegiatan) di staging/prod setelah deploy.

## Prior — Vonis Alvandi + hapus tab Materi Didaskalia (staging) (3 Okt 2026)

**Vonis kasus Alvandi (diagnosis DB prod):** ia memegang **SUPERADMIN** (tenant-jemaat) + COMMITTEE + RA aktif DIDASKALIA + struktur kosong (= terdeteksi BOD). Topeng Tim Kerja tidak menyembunyikan SUPERADMIN/BOD — jadi lihat semua panel. Perilaku ini sudah ada sebelum gate kemarin (bukan regresi).

**Fix aturan (spesifik > umum):** pemegang divisi aktif hanya melihat divisinya, BOD tanpa divisi melihat semua, KOMISI/SA tetap semua. Berlaku server (`canAccessDivision`) + client (`canSeeDivisionTab`). BOD inti (Theodore/Zhanon/Milithya, RA TIMKERJA, tanpa divisi panel) tidak terdampak — tetap semua.

**Tab Kurikulum & Materi dihapus total** dari panel Didaskalia (Studio satu-satunya jalan; tersisa Studio/Penatalayan/Anggota). Daftar sub-tab diekstrak ke `divisionDetailTabIds()` (teruji). Upload/listing Drive per-event ikut terbuang; backend Drive + tampilan file di Info Event/Kegiatan tidak berubah.

**Verifikasi:** `lint` bersih ✓ **630 test** hijau (+4) ✓ `build` OK ✓

**Next:** commit+push staging; putuskan pencabutan SUPERADMIN Alvandi (dan Theodore?) — tanpa itu ia tetap lihat semua; cek visual staging; merge `main` bila OK.

## Prior — Merge main: gate divisi + standar RHB live di prod (3 Okt 2026)

`cursor/division-gate` (3 commit: gate panel Panca+BZP, catatan, standar RHB) → FF-merge → push `main` → `/api/version` prod = `09e8f5b` ✓ live. Gate ulang sebelum merge: lint + 627 test + build hijau. DB prod sudah sinkron sebelumnya (tak perlu migrasi). Sisa: alias `staging.*` masih build lama (perlu `vercel login`).

**Next:** cek visual prod (KOMISI → 6 panel divisi; PIC non-BOD → hanya divisinya); generate uji RHB 1 hari; validator pasca-generate (opsional).

**Standar** (disetujui pemilik: nada pas, label emoji 🎒🎓💼, ilustrasi 1–2 kontekstual): tiap hari = Pengantar (konteks + ilustrasi) → Pembahasan → Makna → Refleksi Pribadi (tepat 3 pertanyaan berlabel konteks) → Diskusi Kelompok (2–3, alur observasi → interpretasi → aplikasi).

**Dikunci 2 lapis:** (1) dokumen `FORMAT` baru `dk-format-rhb` di `server/seed-didaskalia-knowledge.mjs` → seed staging+prod (masuk tiap generate via `teamContextBlock`); (2) `PATH_RULES` di `server/lib/didaskalia-ai.mjs` (berlaku untuk generate mingguan + per-path; batas 220 karakter dilonggarkan khusus Pengantar/Refleksi/Diskusi). Skema Zod tidak berubah. Prinsip tetap: AI = usulan, tim menyunting.

**Verifikasi:** `lint` bersih ✓ **627 test** hijau (+1 pola RHB, mock provider) ✓ `build` OK ✓ seed staging+prod (1 dibuat + 1 selaras) ✓

**Next:** generate uji 1 hari pekan berjalan → nilai → massal; opsi validator pasca-generate (tandai draf kurang lengkap).

## Current — Gate panel Panca + BZP: Admin/Komisi/BOD/divisi (staging) (3 Okt 2026)

**Aturan baru:** panel divisi (5 Panca + BZP) hanya untuk SUPERADMIN, KOMISI, COMMITTEE yang BOD Tim Kerja, dan anggota/kepala divisi itu. BPMJ + COMMITTEE non-BOD + peran lain tanpa divisi: tidak lihat. Tulis tidak berubah (tetap `requireRole` per endpoint). Sebelumnya justru lebih ketat (KOMISI/BOD tanpa divisi pun tertutup).

**Ubah:** `server/lib/division-access.mjs` (`isKomisiUser`, `isBodCommittee`, `canAccessDivision`) → `/api/me/divisions` (+flag) → `useMyDivisions` → `canSeeDivisionTab` → guard deep-link & API ikut otomatis. Endpoint publik BZP (produk/landing) tidak disentuh.

**Verifikasi:** `lint` bersih ✓ **626 test** hijau (623−1 usang+4 baru; coverage lama yang tertimpa dipulihkan) ✓ `build` OK ✓ commit `7109a83` → `cursor/division-gate` + `staging` (alias staging.* masih build lama — perlu `vercel login`).

**Next:** cek visual staging (KOMISI → 6 panel; PIC non-BOD → hanya divisinya; MENTEE/BPMJ → tidak ada); merge ke `main` bila OK.

## Current — Penatalayanan demo 4 Okt + petugas interaktif Warta (2 Okt 2026)

**Data staging:** 10 penugasan CONFIRMED tgl `2026-10-04` (2 peran × 5 divisi panca: Liturgist+Holly, Singer+Glenity, Firman1+Putri, Firman2+Alvandi, KoordTR+Theodore, Usher+Zhanon, Bersih+Prichel, Konsumsi+Artjuna, Multimedia+Gievara, Fotografer+Milithya; `eventId` = event Mentoring 4 Okt). Idempoten (skip bila sudah ada).

**API (`server/routes/drive-ownership.mjs`):** `/api/db/service-schedule` kini mengirim `avatar` per petugas + `hostMembers` sebagai `{name, avatar}` (resolve via `groupMember.user`; tetap tanpa email/telepon, tetap hanya CONFIRMED/DONE).

**UI:** baru `src/components/public/DutyPersonChip.tsx` — `DutyPersonChip` (foto + nama + badge ikon; ikon spesifik ~30 kata kunci peran → fallback ikon divisi Flame/BookOpen/Heart/HandHeart/Megaphone + warna divisi baku) + `DutyAvatarStack` (foto overlap +n, klik expand). Dipakai di `WartaServiceDutySection` (kartu + entrance stagger motion, hormati reduced-motion), `WartaPelayananBlock`, dan `EventServiceDutyCard` (sekaligus fallback render daftar petugas saat tanpa pasangan penanggung/tuan rumah — kasus Mentoring Day).

**Verifikasi:** `lint` bersih ✓ **623 test** hijau (+4 `duty-person-chip.test.ts`) ✓ `build` OK ✓ data staging terverifikasi via query ✓ browser lokal vs DB staging: Warta → kartu 4 Okt (stack + expand 10 chip) + 11/18 Okt (proyeksi + anggota) ✓ Info Event 4 Okt → kartu Pelayanan + kartu Post-to-Post (`Segera` + link mentoring) ✓ fix hooks `useReducedMotion` (early-return) ✓

**Sinkron DB prod (2 Okt 2026):** `db:migrate:worship:prod` + `worship-notes:prod` (7 tabel baru) → `db:seed:worship:prod` (5 pola + sesi `mentoring-2026-10-04` DRAFT, 9 soal, 12 chip) → sesi di-link `event_id` event Mentoring 4 Okt → 10 penugasan CONFIRMED 4 Okt (orang asli: Holly, Glenity Marchella, Putri Claudia Massie, Alvandi, Theodore, Zhanon, Prichel, Artjuna, Gievara, MilithyaCh). Verifikasi: `/api/version` prod = `31c6d68` ✓ `/api/db/service-schedule?from=2026-10-04` → 10 duties + avatar Google asli ✓ Sisa: alias `staging.*` masih build lama (perlu `vercel login` + `deploy:staging`).

## Prior — Info Event: Pelayanan + link Post-to-Post 4 Okt (staging) (2 Okt 2026)

**Data:** prod punya agenda `Ibadah Pemuda Mentoring: More Than Good News - 04 Okt 2026` (`evt-ibadah-pemuda-mentoring-more-than-good-n-munvbmqezm`, MENTORING_DAY, ACTIVE) tapi `service-schedule` 4 Okt masih kosong. Pull scoped prod→staging (`_copy-prod-to-staging.cjs --only=EventProgram,serving_assignments,serving_cycle_pairs,service_week_overrides,service_roles,service_schedules --truncate --apply`, 71 baris; worship_* dikecualikan — belum ada di prod). Sesi `mentoring-2026-10-04` (POST_TO_POST, 9 soal, 12 chip) di-link `event_id` + reset WRAPUP→DRAFT.

**API:** `GET /api/events/:id/worship` (`requireRole()`, tanpa PII) — sesi via `eventId`, fallback `session_date` = tanggal event.

**UI (`EventInfoPanel.tsx`):** kartu `EventServiceDutyCard` (penanggung jawab + petugas, tuan rumah + anggota dari endpoint publik `service-schedule`; kosong → sembunyi, tanpa teks admin) + `EventWorshipCard` (nama pola + badge status + `Buka Sesi Mentoring →`; DRAFT → `Panduan menyusul dari Didaskalia`).

**Verifikasi:** `lint` bersih ✓ test hijau (+6 `event-info-cards.test.ts`) ✓ `build` OK ✓ data staging terverifikasi via query langsung ✓

**Next:** cek visual di `staging-youth` (Info Event 4 Okt → kartu Pelayanan bila sudah ada petugas + kartu Post-to-Post); isi penatalayan 4 Okt di Program & Event; deploy `main` bila OK.

## Prior — F5.2: Segmen hari-H + catatan peserta + simulasi 3 lantai (staging) (29 Sep 2026)

**Latar:** hasil simulasi pemilik — timer/segmen perlu dipisah, arah ruangan harus jelas, peserta butuh catatan (bisa jadi PDF), dan Lesson Learned baru muncul setelah 20 menit + tautan ke layar proyektor.

**Skema/migrasi:** `worship_notes` (`session_id`, `user_id`, `topic_code` = HUBUNGAN|PEKERJAAN|KELUARGA|KESIMPULAN, `content`; unik per sesi+user+topik) — `server/_migrate-worship-notes.cjs`, npm `db:migrate:worship-notes[:staging|:prod]`.

**API (`server/routes/worship.mjs`):**
- `PUT /api/worship/notes` (upsert; konten kosong = hapus) + `notes` di `GET /api/worship/session/:slug`.
- **Auto-wrapup** lazy (`ensureAutoState`): `RUNNING` + waktu habis → `WRAPUP` pada pembacaan state (peserta/layar/detail admin).
- `PUT /state` + aksi **`extend`** (`+5 menit`, clamp 60–1800 s; membatalkan WRAPUP bila sudah lewat).
- Detail admin menyertakan **catatan peserta** (untuk role penulis) + `export.csv` menambah kolom `Catatan_<TOPIK>` & `Kesimpulan`.
- Payload peserta menambah `me`, `notes`, `rooms[].rank`, `progress`.

**Peserta (`MentoringDay.tsx` → 4 segmen + `SegmentStepper.tsx`):** Likert → **Arah Pos** (prioritas + **rute berurutan** + progres `n/total` + “menunggu aba-aba panitia” + pesan lanjut lantai berikutnya) → **Kunjungan & Catatan** (timer besar, catatan 3 pos + kesimpulan dengan **auto-save batch**, tombol **Unduh PDF rekap**) → **Lesson Learned** (chip, afirmasi, **“Lihat layar utama”** ke `.../layar`, PDF). Auto-lompat segmen idempoten (tidak pernah menarik mundur).

**PDF:** `src/lib/mentoringPdf.ts` (jsPDF deterministik) — identitas, prioritas+lantai, tabel Likert, catatan, chip.

**Kontrol:** tombol **+5 menit**; Start menampilkan konfirmasi `n/total` bila belum penuh; panel **Catatan peserta**.

**Simulasi:** `scripts/worship-sim.mjs` (npm `worship:sim`, `worship:sim:reset`) — driver HTTP staging (Basic Auth dari `.env`), menyalin soal/chip dari template `mentoring-2026-10-04`, distribusi dominasi PEKERJAAN 40% / HUBUNGAN 35% / KELUARGA 25%, mode `final` (sampai CLOSED) + `live` (dibiarkan RUNNING). Guard menolak host produksi kecuali `--force`.

**Hasil simulasi staging (60 peserta):**
- `demo-mentoring-3-lantai-final` — **CLOSED**, 60/60 Likert, 42 peserta beri catatan (96 baris), 39 kirim chip. Ranking: **Lantai 2 Pekerjaan (24)**, **Lantai 1 Hubungan (21)**, **Lantai 3 Keluarga (15)**. Top chip: `#BebasValidasi(19)`, `#Integritas(19)`, `#BukanHustleCulture(14)`.
- `demo-mentoring-3-lantai-live` — **RUNNING**, 36/60 terisi (layar proyektor menampilkan timer + progres + word cloud parsial).

**Verifikasi:** `lint` bersih ✓ **613 test** hijau (+6) ✓ `build` OK ✓ E2E lokal 4 segmen (Likert → arah+progres → kunjungan+catatan auto-save → lesson+chip+tautan layar) ✓ PDF terunduh (9,9 kB) ✓ staging: live/CLOSED via API ✓

**Docs:** [`docs/product/worship-patterns.md`](docs/product/worship-patterns.md) (katalog pola, modul, alur, API, simulasi).

### Next
1. Tinjau staging: control room sesi demo (`.../kontrol`) + layar (`.../layar`, kode dari panel).
2. Isi sesi asli 4 Okt (`mentoring-2026-10-04`, sudah DRAFT + 9 soal + 12 chip).
3. Migrasi prod (`db:migrate:worship-notes:prod`) + merge ke `main` bila sudah OK.
4. Modul pola berikutnya: `DEBAT` (rounds), `BEDAH_FILM` (screening), `THREE_SEQUENCES` (teams).
5. Bersihkan data demo kapan pun: `npm run worship:sim:reset`.


## Current — F5: Pola Ibadah & Mentoring Day (Didaskalia) — staging review (29 Sep 2026)

**Tujuan:** katalog **pola ibadah** (skenario siap pakai) di Didaskalia + sesi hari-H ber-*modul web* yang diakses Pemuda/Beyonders lewat routing khusus `#/mentoring/<slug>`.

**Skema/migrasi (`server/_migrate-worship.cjs`, wired `db-migrate-local.mjs` + npm `db:migrate:worship[:staging|:prod]`):** `worship_patterns`, `worship_sessions`, `worship_likert_items`, `worship_likert_responses`, `worship_chips`, `worship_chip_votes` (+ `Worship*` di `prisma/schema.prisma`).

**Seed (`server/_seed-worship-patterns.cjs`, npm `db:seed:worship[:staging|:prod]`):** 5 pola (POST_TO_POST, DUAL_MONOLOG, DEBAT, BEDAH_FILM, THREE_SEQUENCES) lengkap dengan `phases` + `playbook` (dari doc retreat & doc mentoring) + sesi `mentoring-2026-10-04` (3 topik × 3 soal Likert, 12 chip, timer 1200 s, kode akses 6 karakter).

**API (`server/routes/worship.mjs`):**
- Peserta (login + tenant youth/SUPERADMIN): `GET /api/worship/session/:slug` (state + soal + hasil personal), `POST /api/worship/likert` (upsert 9 jawaban → topik prioritas + lantai), `POST /api/worship/chips` (maks 3), `GET /api/worship/live/:slug` (progres, ranking topik→lantai, word cloud).
- Proyektor: `GET /api/worship/live/:slug?code=XXXXXX` (read-only tanpa login; kode bisa dirotasi).
- Admin (`requireDivision('DIDASKALIA')` + `requireRole(SUPERADMIN|KOMISI|COMMITTEE)`): CRUD pola & sesi, `PUT .../state` (`open-likert|start|wrapup|close|reset`), CRUD soal & chip, `export.csv`. Endpoint admin menerima **id atau slug**.

**Frontend:**
- `#/mentoring/<slug>` → `MentoringDay` (peserta: Likert → prioritas+lantai+afirmasi → catatan → chip words → thank you; polling 5 s).
- `#/mentoring/<slug>/layar` → `MentoringScreen` (proyektor; gerbang **kode sesi**, progres + timer raksasa + alokasi pos + live word cloud; polling 3 s).
- `#/mentoring/<slug>/kontrol` → `MentoringControl` (5 tombol trigger, timer/target, kode + tautan salin, monitor hari-H, editor soal & chip, ekspor CSV, rundown pola).
- Panel Didaskalia dapat sub-tab **“Pola Ibadah”** (`DidaskaliaStudioPanel.tsx`) yang memuat `MentoringControl`.
- `src/lib/mentoring.ts` (routing + tipe + `fmtClock`), `SessionTimer` (timer server-authoritative via `serverNow`), `WordCloud` (skala √count).

**Algoritma:** kerentanan topik = `Σ (6 − skor)`; ranking → lantai dari `config.rankFloors` (default `[2,1,3]` = terbesar/kedua/terkecil); timer hitung mundur dari `startedAt`; wrap-up menampilkan chip → word cloud.

**Verifikasi (lokal, DB = staging):** `lint` bersih ✓ `build` OK ✓ **607 test** hijau (+5 `tests/unit/worship.test.ts`) ✓ E2E manual: kode proyektor → layar; login → Likert → “Hubungan → Lantai 2” + afirmasi; kontrol `Buka Likert → Start → Trigger Lesson Learned`; chip `2/3` → “Thank you”; word cloud muncul di layar proyektor. Data uji dihapus & status direset ke `DRAFT`.

### Next
1. Tinjau di staging: login `tech@gehc.demo` → panel Didaskalia → tab **Pola Ibadah**; tautan peserta/layar/kontrol + kode 6 karakter.
2. Migrasi + seed prod sebelum merge ke `main` (`db:migrate:worship:prod`, `db:seed:worship:prod`).
3. Modul menyusul untuk pola lain (DEBAT `rounds`, BEDAH_FILM `screening`, THREE_SEQUENCES `teams`).
4. Opsional: word cloud animasi + rekap evaluasi per sesi di panel.


## Current — F4: Landing publik per subdomain unit (staging review) (29 Sep 2026)

**Tujuan:** subdomain unit (men/women/teen/kids/districts/community) menampilkan **landing publik unit** (bukan landing Pemuda); portal tetap di `#/portal`. Pemuda tidak diubah.

**Skema/migrasi:** `Tenant.schedules Json?` — `server/_migrate-tenant-schedules.cjs` (didaftarkan di `scripts/db-migrate-local.mjs` + npm `db:migrate:tenant-schedules[:staging|:prod]`). Catatan: `.env` lokal memakai DB **staging** (user sama), jadi migrasi lokal sudah mencakup staging.

**API publik:**
- `GET /api/unit/landing` — profil unit dari host (`?portal=` hanya berlaku untuk host tak dikenal) → `{ unit, tenant, church }`: nama, tagline, deskripsi, kontak, sosial, logo, hero, jadwal, branding, `registrationOpen`.
- `GET /api/units/:slug/pengurus` — `StrukturMember` ber-`tenantId` unit (name/position/subdivision/photoUrl/isOpenRole).
- `PUT /api/tenants/:slug/profile` — kini menerima `name`, `description`, `schedules`.
- Scope tenant ditambahkan: `GET /api/gallery/public` (join `EventProgram.tenantId`) & `GET /api/events/landing`.

**Frontend:**
- `src/components/unit/UnitLanding.tsx` (baru, lazy) — hero+identitas, jadwal (fallback jadwal gereja), agenda (`/api/events`), galeri (filter gambar, bukan folder Drive), pengurus, kontak/sosial, CTA portal + daftar; watermark GMIM+GEHC; tema per unit via `usePortalTheme()`.
- `src/main.tsx` — host unit non-Pemuda & bukan hash app/auth → `UnitLanding`. `isAuthHash()` baru di `src/lib/host-context.ts` agar `#/login|#/register|#/join|#/event` tetap aplikasi.
- `ManageChurchInfo.tsx` — editor **jadwal unit** di panel Info Gereja.
- `ChurchHub.tsx` — copy "coming soon"/"dalam pengembangan" diganti; `UnitComingSoon.tsx` (tak terpakai) dihapus.

**Verifikasi:** `lint` bersih ✓ **602 test** hijau (+5: `unit-landing.test.ts`, hash di `host-context.test.ts`) ✓ `build` OK (chunk `UnitLanding` 14,5 kB) ✓ lokal: `?portal=men` → landing unit; `#/portal` → login; `#/register` → daftar; tanpa override → landing Pemuda tetap.

### Next
1. Tinjau staging: `staging-men|women|teen|kids|districts|community.gehc.page`.
2. **Migrasi prod** `npm run db:migrate:tenant-schedules:prod` sebelum merge ke `main`.
3. Isi konten unit (tagline/deskripsi/jadwal/logo/hero) via Info Gereja.
4. (Opsional) copy halaman login/daftar masih "Beyonders" di host unit non-Pemuda.


## Current — L1: Logo GMIM + GEHC di hub (staging review) (29 Sep 2026)

- **Aset**: logo **GMIM resmi** diambil dari situs Sinode (`gmim.or.id/assets/images/logo-gmim.png`, 493×480 transparan) → dioptimalkan (22 kB) ke `public/visuals/brand/logo-gmim.png`. Logo **GEHC** memakai `public/visuals/brand/logo-gehc.png` (sudah versi terbaik).
- **`ChurchHub.tsx`**:
  - Header: **GMIM** (h-9) + teks "GMIM EBEN HAEZER / Cikarang · Laman Hub" + pemisah + **GEHC** (lockup).
  - Hero: **GMIM** dalam lingkaran (halo) + badge **GEHC**.
  - **Watermark background = logo GEHC** (opacity 4%, `crest-watermark`, `pointer-events-none`, `aria-hidden`, dimatikan saat print).
  - Section gelap (Info Gereja): watermark **GMIM** 6%. Footer: **GMIM + GEHC**.
  - Fallback: slot Drive (`brand.logoGmim`/`brand.logoGehc`) → static `public/visuals/brand/*`; `ChurchCrest` tetap tersedia bila keduanya kosong.
- **Fix encoding**: refactor tema D1 (PowerShell) sempat merusak karakter non-ASCII di 11 file → diperbaiki (bandingkan versi pra-refactor, patch UTF-8 aman via Node). **Sisa 39 `�` adalah pra-existing** (bukan regresi; kandidat pembersihan terpisah).

**Verifikasi:** `lint` bersih ✓ **597 test** hijau ✓ `build` OK ✓ staging `9afc164`; `…/visuals/brand/logo-gmim.png` → 200 (22 kB) ✓ (belum prod)

### Next
1. Tinjau hub staging (header/hero GMIM+GEHC, watermark GEHC, footer).
2. **H2** — marquee data-driven, direktori unit dari DB, Majelis, Jadwal+Lokasi.
3. (Opsional) bersihkan 39 mojibake pra-existing.

## Current — H1: Sistem visual hub (glass, crest, aksen ungu) — staging review (28 Sep 2026)

**Latar:** adopsi sebagian pola desain dari mock `gehc-·-gmim-eben-haezer-cikarang.zip` (AI Studio) ke hub.

**Yang dibangun:**
- `src/index.css` — utility **Apple-glass** (`.apple-glass`, `.apple-glass-card(-hover)`, `.apple-glass-glow`, `.apple-glass-dark`), alias `.font-serif-display`, dan aturan **print** (glass/watermark dimatikan). (Marquee sudah ada.)
- `src/components/brand/ChurchCrest.tsx` (baru) — crest GMIM (SVG statis: salib, merpati, Alkitab, pita) varian `full|emblem|watermark`; tanpa aset biner.
- `PORTAL_THEMES.jemaat` → **ungu→indigo** (`#7E22CE`/`#4F46E5`) menggantikan emas.
- `ChurchHub.tsx` — **watermark crest** (opacity 5%), **header sticky glass** + emblem crest, hero dengan **ambient glow** + emblem.

**Verifikasi:** `lint` bersih ✓ **597 test** hijau ✓ `build` OK ✓ staging `0316afc` ✓ (belum prod)

### Next
1. Tinjau hub staging (`staging.gehc.page`): ungu + glass + crest/watermark.
2. **H2** — marquee data-driven (Info & Peluang), direktori unit dari DB (`/api/tenants`) + `colorTheme` terstruktur, Majelis, Jadwal+Lokasi.
3. **H3** — mobile bottom dock + modal (detail unit, peta, pitch).

## Current — D3: Branding tema per unit dari DB (staging review) (28 Sep 2026)

**Schema (migrasi `server/_migrate-tenant-branding.cjs`; staging dijalankan):** `Tenant.brandAccent`, `brandAccent2`, `brandInk`, `logoUrl`, `heroImageUrl`, `themeTone`.

**API:**
- `GET /api/portal/theme` (publik) — resolusi tenant dari host → `{ tenantId, branding }` (null bila belum diatur).
- `PUT /api/tenants/:slug/profile` — menerima field branding (hex divalidasi/normalisasi; tone `NETRAL|FORMAL|HANGAT|CERIA`). `GET /api/tenants` & profil unit otomatis memuat field baru.

**Klien:**
- `portal-themes.ts` — `fetchBranding`, `brandingToOverride`, `getBrandingOnce`, `initPortalTheme` (default kode → override DB).
- `main.tsx` — `initPortalTheme` saat mount.
- `src/hooks/usePortalTheme.ts` (baru) — tema aktif (dengan override) untuk komponen; `PortalLayout` memakai `theme.logo` (ganti logo GEHC bila diatur).
- **Info Gereja** — per unit: color picker (aksen, aksen-2, teks di atas aksen) + URL logo/hero + nada (tone).

**Verifikasi staging:** `GET /api/portal/theme` di `staging-men` → `tenantId=tenant-men`, branding null ✓; `PUT /api/tenants/men/profile {brandAccent:'#0055ff', themeTone:'FORMAL'}` → tersimpan `#0055FF`/`FORMAL` ✓; theme endpoint mengembalikan override ✓; **direset** ke null ✓. `lint` bersih ✓ **597 test** hijau ✓ `build` OK ✓ **Belum di-merge ke prod.**

### Next
1. Tinjau staging; set warna/logo unit via Info Gereja; merge ke prod bila setuju.
2. (Opsional) D4 — tone/tipografi per unit (perilaku visual, bukan hanya warna).

## Current — D1: Tema portal per domain/subdomain (staging review) (28 Sep 2026)

**Tujuan:** tiap portal (host) punya identitas warna sendiri; Pemuda tetap merah/oranye, Jemaat netral emas/ink, unit lain pakai aksen masing-masing.

**Yang dibangun:**
- Token baru di `src/index.css` `@theme`: `--color-brand-ink`, `--color-brand-soft` (tint via `color-mix`).
- `src/lib/portal-themes.ts` — `PORTAL_THEMES` (per portal), `themeForPortal`, `resolvePortalTheme(host, search, override?)`, `applyPortalTheme` (set CSS var di `document.documentElement`), `applyThemeForHost`.
- `src/main.tsx` — terapkan tema saat mount (host + `?portal=` non-produksi).
- **Refactor warna → token** di **108 file** (`src/**`): `#FF416C`→`brand`, `#FF4B2B`→`brand-end`, `[#…]`→utility, sisa hex→`var(--color-brand)`. Dikecualikan: `src/index.css` (definisi), `src/data/churchUnits.ts` & `src/data/initialData.ts` & `youth-gehc-helpers.ts` (warna identitas grup/unit).
- Tes: `tests/unit/portal-themes.test.ts`.

**Palet:** jemaat `#8A6A1F`/`#C8A24A` · youth `#FF416C`/`#FF4B2B` · men `#0EA5E9`/`#1D4ED8` · women `#EC4899`/`#8B5CF6` · teen `#7C3AED`/`#DB2777` · kids `#F59E0B`/`#EF4444` · kolom `#10B981`/`#047857` · community `#6366F1`/`#0EA5E9`.

**Verifikasi:** `lint` bersih ✓ **591 test** hijau ✓ `build` OK ✓ CSS hasil build memakai `var(--color-brand)` (35×) + `color-mix` (13×) sehingga override runtime berlaku. **Di-deploy ke staging untuk ditinjau** (belum prod).

**Tambahan (sementara) — panel jemaat disembunyikan dari portal Pemuda:**
- `portal-nav-config.ts`: `JEMAAT_PANELS_LIVE_IN_YOUTH = false` + `HIDDEN_IN_YOUTH_PORTAL` (8 panel: `unit-pengurus`, `unit-members`, `church-facilities`, `church-finance`, `church-stewardship`, `church-mds`, `church-security`, `church-dashboard`) + `isHiddenInPortal()`.
- `buildPortalNavItems`: **SUPERADMIN menembus** filter `portals` **dan** daftar sembunyi (inspector: lihat semua di portal mana pun); peran lain → sembunyi di portal `youth`.
- `PortalLayout`: `inActivePortal` bypass SUPERADMIN; extras juga difilter `isHiddenInPortal`.
- Menampilkan kembali nanti = ubah **satu konstanta** `JEMAAT_PANELS_LIVE_IN_YOUTH = true`.
- Tes: KOMISI Pemuda tanpa 8 panel; SUPERADMIN melihat semua (termasuk `org-hierarchy`/`integrations` di Pemuda); portal lain tak berubah. **596 test** hijau ✓

### Next
1. Tinjau staging per portal (hub/youth/men/women/teen/kids/kolom/community).
2. **D3** — branding DB (`Tenant.brandAccent/brandAccent2/brandInk/logoUrl/heroImageUrl/themeTone`) + UI Info Gereja + logo per unit.
3. (Opsional) D4 — tone/tipografi per unit.

## Current — P8: PDF laporan server-side (pdfkit) (27 Sep 2026)

- Dependency baru: **`pdfkit`** (pure JS, aman di Vercel serverless).
- `server/lib/report-data.mjs` (baru) — agregasi laporan dipakai bersama: `kasReport`, `facilityReport`, `bpmjReport`, `unitReport` (+ katalog `UNIT_LABEL/UNIT_TENANT`). Endpoint JSON P6 kini tipis (memakai lib ini).
- `server/lib/report-pdf.mjs` (baru) — penyusun section murni (`kasSections`/`facilitySections`/`bpmjSections`/`unitSections`) + `streamReportPdf` (pdfkit: judul, field, bullet, tabel dengan page-break & lebar kolom).
- `GET /api/church/reports/<kas|fasilitas|bpmj|unit>.pdf?period=[&unit=]` — RBAC sama dengan JSON (kas/fasilitas → pengurus; bpmj → BPMJ/SA/KOMISI; unit → auth). Nama berkas `laporan-<jenis>-<periode>.pdf`.
- UI: tombol **PDF** di header halaman laporan + di panel Keuangan/Fasilitas/Dasbor BPMJ (CSV & print-to-PDF tetap ada).
- Tes: `tests/unit/report-pdf.test.ts` (section builders).

**Verifikasi staging:** `kas.pdf` 200 `application/pdf` `%PDF-` (2.917 B) ✓; `bpmj.pdf`/`fasilitas.pdf`/`unit.pdf` (BAPAK) juga `%PDF-` ✓; KOMISI Pemuda minta `kas.pdf` → **403** ✓. `lint` bersih ✓ **585 test** hijau ✓ `build` OK ✓

## Current — P7: Tren bulanan di Dasbor BPMJ (27 Sep 2026)

- `server/lib/report-trends.mjs` (baru) — `lastMonths(n)`, `mergeTrend(months, rows)`, `maxOf`.
- `GET /api/church/bpmj/trends?months=6` (SUPERADMIN/BPMJ/KOMISI) — agregat per bulan (kas masuk/keluar, BZP lunas, booking, insiden) via raw SQL `DATE_FORMAT`.
- `BpmjDashboardPanel` — kartu **“Tren 6 bulan”** dengan bar CSS (masuk hijau / keluar merah) + ringkasan teks per bulan.
- Tes: `tests/unit/report-trends.test.ts`.

**Verifikasi staging:** `trends?months=6` → 6 bulan (2026-04…2026-09), BZP 2026-09 = 300.000 (dari data), sisanya 0 ✓. `lint` bersih ✓ **581 test** hijau ✓ `build` OK ✓

### Next (opsional)
1. PDF server-side (bila butuh hasil seragam lintas browser) — butuh dependency; print-to-PDF sudah tersedia.

## Current — P6: Laporan presentasi + PDF (pola Didaskalia) (27 Sep 2026)

**Pola:** halaman presentasi **standalone** + **cetak PDF** (print-to-PDF), seperti `#/materi` Didaskalia.

**Rute:** `#/laporan/<jenis>/<periode>[/<unit>]`
- `#/laporan/kas/2026-09` (bulan) · `#/laporan/kas/2026-W38` (minggu ISO)
- `#/laporan/fasilitas/2026-09` · `#/laporan/bpmj/2026-09` · `#/laporan/unit/pemuda/2026-09`
- Standalone (di luar shell portal), **wajib login**, bisa dibuka dari host mana pun; RBAC di endpoint.

**Yang dibangun:**
- `server/lib/report-period.mjs` — `monthPeriod`, `isoWeekRange`, `parsePeriod` (bulan/minggu).
- `src/lib/report-routing.ts` — `parseReportHash`/`isReportHash`/`reportHashPath`/`reportAbsoluteUrl`, `unitCodeForPortal`, `currentPeriodKeys`/`isoWeekKey`.
- `src/lib/report-decks.ts` — `buildKasDeck`/`buildFacilityDeck`/`buildBpmjDeck`/`buildUnitDeck`.
- `src/components/reports/ReportPresentation.tsx` — `DeckShell` + blok `hidden print:block` (semua slide, `break-after-page`) + **Cetak (PDF)** + **Salin tautan** + **caption WA**.
- API JSON: `GET /api/church/reports/{kas|fasilitas|bpmj|unit}` (RBAC: kas/fasilitas → pengurus; bpmj → BPMJ/SA/KOMISI; unit → auth). `reports/cash.csv` kini menerima `period` (bulan/minggu).
- `main.tsx` + `host-context.ts` — `isReportHash` (lazy route sebelum cabang host).
- Pintu masuk: tombol **Laporan (presentasi)** di panel Keuangan (bulan & minggu), Fasilitas, Dasbor BPMJ, dan Anggota Unit.

**Verifikasi staging:** `kas/2026-09` (9 akun, label September 2026) ✓; `kas/2026-W38` (type=week, "Minggu 38 · 14–20 Sep 2026") ✓; `fasilitas` ✓; `bpmj` (267 anggota) ✓; `unit/BAPAK` (Kaum Bapa, 10 anggota, 1 akun kas) ✓; `cash.csv?period=2026-W38` → `kas-2026-W38.csv` ✓. `lint` bersih ✓ **577 test** hijau ✓ `build` OK ✓

### Next (opsional)
1. Tren bulanan di Dasbor BPMJ.
2. PDF server-side (bila butuh hasil seragam lintas browser).

## Current — P5: Guard per-unit, Kas Unit otomatis, Laporan CSV (27 Sep 2026)

**1. Guard tulis per-unit (bukan lagi sekadar KOMISI/COMMITTEE):**
- `facilityManagerReq` (PEMBANGUNAN/BPMJ/SA) & `isTreasurerReq` (Bendahara/BPMJ/SA) di `index.mjs` (sejajar dengan `church-p1.mjs`).
- `canManageChurchDuty` (THL/Panji/BPMJ/SA): peran penatalayan **scope CHURCH** (`THL_STEWARDSHIP`/`THL_MDS`/`PANJI`) hanya bisa dibuat/diubah/dijadwalkan oleh pengelola jemaat; scope UNIT tetap KOMISI/COMMITTEE.

**2. Kas unit otomatis:**
- `server/lib/church-cash.mjs` — katalog `UNIT_ACCOUNTS` (KAS-JEMAAT + 6 unit + PETTY-BZP) + `toCsv`/`csvCell`/`monthRange`.
- `server/seed-church-cash.mjs` (+ npm `db:seed:church-cash[:staging|:prod]`) & endpoint `POST /api/church/cash/accounts/ensure` (Bendahara) — idempotent; menautkan `BzpSetting.pettyCashAllowanceAccountId` ke `PETTY-BZP`.

**3. Laporan CSV:**
- `GET /api/church/reports/cash.csv?month=YYYY-MM` (Bendahara) & `GET /api/church/reports/bookings.csv` (pengelola fasilitas). Tombol unduh di panel Keuangan & Fasilitas.

**Verifikasi staging:** 9 akun kas dibuat (balance 0) ✓; `ensure` idempotent (`created=0`) + petty BZP tertaut ✓; `cash.csv`/`bookings.csv` header benar ✓; guard: KOMISI Pemuda bikin peran **THL_MDS → 403**, peran **LITURGIA → 201 (UNIT)** ✓ (data uji dibersihkan). `lint` bersih ✓ **562 test** hijau ✓ `build` OK ✓

### Next (opsional)
1. Laporan bulanan ringkas di Dasbor BPMJ (tren bulanan).
2. Ekspor PDF (bukan hanya CSV).

## Current — F3.6: Rapikan visibilitas nav per peran/tenant (27 Sep 2026)

**Latar:** audit ulang matriks nav menemukan 5 kebocoran. Diperbaiki:

1. **Panel Divisi per divisi** — `PortalLayout` kini memfilter `div-*` (nav + sidebar) lewat `filterDivisionTabs(defs, allowedDivisionTabs, isSuperadmin)`; KOMISI/COMMITTEE hanya melihat divisi yang diikuti (API tetap `requireDivision`).
2. **BZP** — `div-benzarpr.portals: ['jemaat','youth']` (hilang dari men/women/teen/kids/kolom/community).
3. **Modul jemaat: pengurus vs anggota** — `church-facilities` & `church-finance` → `CHURCH_ROLES.leaders` (SUPERADMIN/BPMJ/KOMISI/COMMITTEE); Stewardship/MDS/Keamanan/Anggota/Pengurus Unit tetap semua baca.
4. **Dasbor BPMJ** — `roles: ['SUPERADMIN','BPMJ']`.
5. **Redirect hub → portal unit** — di Portal Jemaat, pengguna tanpa peran jemaat tetapi ber-unit/BIPRA diarahkan ke host unitnya (`hubRedirectHost`), sadar prod/staging. `gehc.page/#/portal` bagi pengguna Pemuda kini mendarat di `youth.gehc.page`.

**Helper murni:** `filterDivisionTabs` (portal-nav-config), `hubRedirectHost`/`unitHostForTenant`/`unitHostForPortal` (portal-profiles).

**Verifikasi:** tes baru (visibilitas BZP, Fasilitas/Keuangan pengurus, Dasbor BPMJ, filter divisi, redirect hub) ✓ `lint` bersih ✓ **556 test** hijau ✓ `build` OK ✓ staging `8e5f363` ✓ (cek browser staging terhalang Basic Auth; logika diuji unit).

### Next
1. Guard tulis per-unit jemaat (`canAccessChurchUnit`) — opsional.
2. Kas Unit otomatis + laporan bulanan/ekspor (opsional).

## Current — P4: Panji Yosua + Dasbor BPMJ (26 Sep 2026)

**Schema (migrasi `server/_migrate-panji.cjs`):** tabel `incident_logs` (`title, category, severity, occurredAt, location, description, actionTaken, reporterUserId, eventId, status(OPEN|HANDLED|CLOSED), handledById, handledAt`).

**API:**
- `GET/POST/PATCH /api/church/incidents` — lapor insiden (semua login); Penanganan (HANDLED/CLOSED) hanya Panji Yosua/BPMJ/SA (`canAccessChurchUnit('PANJI')`).
- Pos jaga memakai penatalayan: divisi **`PANJI`** kini ber-scope CHURCH (`ServiceRole.scope`).
- `GET /api/church/bpmj/dashboard` (SUPERADMIN/BPMJ/KOMISI) — anggota per BIPRA & jumlah kolom, kas total + BZP lunas, booking/dana aktif, insiden terbuka, petugas mendatang, campaign aktif, warta terbaru.

**UI:** nav grup **Jemaat** → **Keamanan (Panji Yosua)** (laporan insiden + pos jaga) & **Dasbor BPMJ**; panel `ChurchSecurityPanel` + `BpmjDashboardPanel`.

**Verifikasi staging:** buat insiden → `OPEN` → `HANDLED` ✓; peran `PANJI` → `scope=CHURCH` otomatis ✓; dasbor → 267 anggota, 5 baris BIPRA, insiden terbuka 1, warta 1 ✓ (data uji dibersihkan). `lint` bersih ✓ **549 test** hijau ✓ `build` OK ✓

### Catatan: fase P0–P4 `docs/product/church-portal.md` **selesai** (portal jemaat lengkap: unit & struktur, fasilitas & keuangan, BZP→Bendahara, THL stewardship+MDS, Panji Yosua, kategorial/Kolom, dasbor BPMJ).

### Next (opsional/pengembangan lanjutan)
1. Guard tulis per-unit jemaat (`canAccessChurchUnit('THL'|'PANJI'|...)`) alih-alih SUPERADMIN/KOMISI.
2. Kas Unit otomatis per unit (akun `KAS_UNIT` + petty cash BZP sudah tersedia).
3. Laporan bulanan/ekspor (PDF/CSV) untuk BPMJ & Bendahara.

## Current — P3: THL (Stewardship + MDS) (26 Sep 2026)

**Schema (migrasi `server/_migrate-thl-scope.cjs`):** `ServiceRole.scope` enum `ServiceScope { UNIT | CHURCH }` default `UNIT`; divisi `THL_STEWARDSHIP` & `THL_MDS` otomatis ber-scope CHURCH.

**API (perluasan penatalayan):**
- `GET /api/penatalayan/roles` — dukung `?scope=`; **bawaan = UNIT** (pemuda) kecuali diminta CHURCH atau divisi THL.
- `GET/POST/PATCH /api/penatalayan/roles` — menerima `scope` (THL dipaksa CHURCH); divisi baru `THL_STEWARDSHIP`/`THL_MDS` diizinkan.
- `GET /api/penatalayan/board?scope=CHURCH&division=THL_MDS` — jadwal petugas jemaat; **bawaan UNIT** agar board Pemuda tak berubah.

**UI:** nav grup **Jemaat** → **Stewardship (THL)** & **MDS (Multimedia)**; panel `ChurchDutyPanel` (peran + jadwal + konfirmasi/selesai). MDS memakai mesin penatalayan yang sama (division `THL_MDS`), galeri/Drive tetap lewat Integrasi.

**Verifikasi staging:** buat peran `THL_MDS` → `scope=CHURCH` otomatis ✓; jadwalkan petugas → tampil di board `scope=CHURCH&division=THL_MDS` ✓; board bawaan (UNIT) tetap 30 peran & **tanpa** THL ✓ (data uji dibersihkan). `lint` bersih ✓ **549 test** hijau ✓ `build` OK ✓

### Next
1. **P4** — Panji Yosua (`IncidentLog`, pos jaga) + dasbor BPMJ lintas unit.
2. (Opsional) guard THL berbasis unit jemaat (`canAccessChurchUnit('THL')`) untuk tulis.

## Current — P2: BZP di bawah Bendahara (26 Sep 2026)

**Schema (migrasi `server/_migrate-bzp-bendahara.cjs`):**
- `BzpSetting.pettyCashAllowanceAccountId` — akun petty cash BZP (di bawah Bendahara).
- `Campaign.fundingRequestId` — tautan campaign ke pengajuan dana.

**API:**
- `GET /api/church/bzp/overview` (Bendahara/BPMJ/SA) — total penjualan lunas, jumlah pesanan, donasi per status, campaigns (+`fundingRequestId`), petty cash, distribusi BZP.
- `PATCH /api/church/bzp/petty-cash` (Bendahara/BPMJ/SA) — set akun petty cash BZP.
- `POST /api/church/bzp/distribute` (Bendahara/BPMJ/SA) — buat `Distribution` (source `BZP_SALES`/`BZP_CAMPAIGN` → target unit).
- `PUT /api/benzar/settings` kini menerima `pettyCashAllowanceAccountId` **hanya** bila pemanggil Bendahara/BPMJ/SA; `POST/PATCH /api/benzar/campaigns` menerima `fundingRequestId`.

**UI:** panel **Keuangan** mendapat bagian **BZP → Bendahara** (ringkasan penjualan/donasi, penyetelan petty cash, dan formulir distribusi ke unit).

**Verifikasi staging:** `overview` (penjualan lunas 300k, 3 pesanan) ✓; set petty cash ke akun baru ✓; `distribute` → `Distribution PROPOSED BZP_SALES` ✓; campaign menerima `fundingRequestId` ✓; overview mencerminkan keduanya ✓ (data uji dibersihkan). `lint` bersih ✓ **549 test** hijau ✓ `build` OK ✓

### Next
1. **P3** — THL (Stewardship + MDS): `ServiceRole.scope(UNIT|CHURCH)`, kalender petugas jemaat, MDS memakai ulang galeri/Drive.
2. **P4** — Panji Yosua (`IncidentLog`, pos jaga) + dasbor BPMJ lintas unit.
3. Alur campaign → FundingRequest → penjualan → Distribution kini bisa dirangkai lewat panel Keuangan.

## Current — P1: Fasilitas & Keuangan (portal jemaat) (26 Sep 2026)

**Model data (7 tabel, migrasi `server/_migrate-church-p1.cjs`):** `facilities`, `facility_bookings`, `maintenance_logs`, `cash_accounts`, `cash_transactions`, `funding_requests`, `distributions` — sesuai `docs/product/church-portal.md` §5. npm `db:migrate:church-p1[:staging|:prod]` + wiring `db-migrate-local`.

**API (`server/routes/church-p1.mjs`), RBAC:**
- Fasilitas/pemeliharaan: pengelola = SUPERADMIN | BPMJ | anggota unit **PEMBANGUNAN**.
- Keuangan (kas/transaksi/pengajuan/distribusi): **Bendahara** | BPMJ | SUPERADMIN.
- Pengajuan (booking/funding) boleh semua pengguna login; unit diambil dari host (`unitOfTenant`).
- Rute: `/api/church/facilities`, `/bookings` (+setujui/tolak/invoice/lunas), `/maintenance`, `/cash/accounts` (+saldo), `/cash/transactions`, `/funding` (+approve/reject/disburse/settle), `/distributions`. Buku kas otomatis tercatat saat booking lunas (IN) & dana dicairkan (OUT).

**UI:** nav grup **Jemaat** → **Fasilitas & Penyewaan** (`church-facilities`) + **Keuangan** (`church-finance`); panel `ChurchFacilitiesPanel` & `ChurchFinancePanel`; i18n id/en + guide.

**Verifikasi staging (end-to-end):** buat fasilitas → booking (SUBMITTED→APPROVED) → terbitkan invoice → **tandai lunas** (kas IN 500k) → ajukan dana 200k → approve → **cairkan** (kas OUT) → saldo akun `1.000.000 + 500.000 − 200.000 = 1.300.000` ✓ (data uji dibersihkan). `lint` bersih ✓ **549 test** hijau ✓ `build` OK ✓

### Next
1. **P2** — BZP di bawah Bendahara (`BzpSetting.pettyCashAllowanceAccountId`, `Campaign.fundingRequestId`, alur campaign → FundingRequest → penjualan → Distribution).
2. **P3** — THL (Stewardship + MDS). 3. **P4** — Panji Yosua + kategorial/Kolom + dasbor BPMJ lintas unit.
4. Kas Unit (akun `KAS_UNIT`) kini bisa dibuat lewat panel Keuangan.

## Current — F3.5.2–F3.5.5: Modul unit generik (Anggota, Kolom, Pengurus) (26 Sep 2026)

**Pendekatan:** satu set modul unit **generik** yang melayani semua unit (Kaum Bapa/Ibu, Remaja, Anak, Kolom, Komunitas, Pemuda), bukan enam modul terpisah.

**Yang dibangun:**
- `server/lib/unit-members.mjs` — `unitMemberWhere(tenantId,{kolomId})` (kategorial = BIPRA; Kolom = `kolomId`; jemaat/community = semua), `canSeeMemberPii(roles)` (SUPERADMIN/BPMJ/KOMISI/COMMITTEE), `memberSelect(pii)`.
- Endpoint baru:
  - `GET /api/unit/members?q=&kolomId=` — daftar anggota unit aktif (kontak hanya bila pengurus).
  - `GET /api/church/kolom` (+ jumlah anggota), `POST /api/church/kolom`, `PATCH /api/church/kolom/:id`, `GET /api/church/kolom/:id/members`.
- Klien: nav **"Anggota Unit"** (`unit-members`, semua portal) + **"Kolom & Wilayah"** (`kolom`, portal Jemaat & Kolom) + **"Pengurus Unit"** (F3.5.1). Panel `UnitMembersPanel` (cari nama; kontak bila pengurus) & `KolomPanel` (kelola kolom + lihat anggota). i18n id/en + guide.

**Deferred (dicatat, alasan):** modul khas per unit — kelas/kurikulum Remaja & Anak, grup minat Komunitas, **Kas Unit** (menunggu fase **P1 Keuangan**). Fondasi yang dipakai semuanya (anggota + pengurus + kegiatan ter-scope) sudah ada.

**Verifikasi staging:** `/api/unit/members` → men 10 (BAPAK), women 3 (IBU), youth 134 (PEMUDA), hub 267 (semua) ✓; `pii=true` untuk pengurus ✓; `/api/church/kolom` → 5 kolom (7/7/2/6/1 anggota) + daftar anggota ✓; POST kolom → `kol-99` dibuat lalu dibersihkan ✓. `lint` bersih ✓ **546 test** hijau ✓ `build` OK ✓

### Next
1. **Kas Unit** setelah **P1 Keuangan** (akun `KAS_UNIT`).
2. Modul khas Remaja/Anak (kelas + kurikulum + absensi) & Komunitas (grup minat) bila diperlukan.
3. (Opsional) hub `#/portal` mengarahkan pengguna Pemuda ke `youth.gehc.page`.

## Current — F3.5.1: Pengurus Unit (26 Sep 2026)

**Yang dibangun:**
- `StrukturMember.tenantId` (kolom baru, nullable, index) — memperluas struktur gereja ke per-unit. Migrasi idempotent `server/_migrate-struktur-tenant.cjs` (ALTER + retag: divisi Panca Tugas Pemuda → `tenant-youth`; sisanya → `tenant-jemaat`); npm `db:migrate:struktur-tenant[:staging|:prod]` + wiring `db-migrate-local`.
- `GET /api/db/struktur` — difilter `withTenant(req)` (unit → unit+jemaat; jemaat → semua).
- `POST /api/db/sync-struktur` — kini **per-tenant**: upsert menyegel `tenantId` aktif; tolak baris milik tenant lain (`canAccessTenant`); hapus hanya baris tenant itu (hub juga baris legacy `null`).
- Nav baru **"Pengurus Unit"** (`unit-pengurus`, grup Struktur, semua portal) + `UnitPengurusPanel` (tambah/edit/hapus baris; baca-saja untuk non-pengurus). i18n id/en + guide.

**Verifikasi staging:** `/api/db/struktur` → youth 39, men 10 (jemaat saja), hub 39 ✓; tulis sync di `staging-men` → men 11, youth tetap 39; cleanup `removed=1` → men 10 ✓. `lint` bersih ✓ **541 test** hijau ✓ `build` OK ✓

### Next
1. **F3.5.2** — Modul Kolom (data KK + ibadah Kolom).
2. **F3.5.3** — Kaum Bapa & Kaum Ibu. 3. **F3.5.4** — Remaja & Anak. 4. **F3.5.5** — Komunitas.
5. (Opsional) hub `#/portal` mengarahkan pengguna Pemuda ke `youth.gehc.page`.

## Current — F3.5.0: Tier anggota (MEMBER) + nav dasar (26 Sep 2026)

**Keputusan pemilik:** ikut semua rekomendasi `docs/product/unit-portals.md` — keanggotaan **opsi B** (implisit via BIPRA/Kolom, tanpa ubah enum DB), roadmap F3.5 bertahap.

**Yang dibangun:**
- `server/lib/tenant-map.mjs` — `TENANT_BIPRA` (kebalikan) + `isUnitMember(user, tenantId)`: kategorial via `users.bipra`; `tenant-districts` via `kolomId`; jemaat/community bukan tier keanggotaan.
- `server/index.mjs` `/api/auth/me` — menambah `membership: { isMember, tenantId, bipra, kolomId }`.
- Klien: `User.membership`; `UserRole` + `'MEMBER'` (sintetis, bukan enum DB); `portal-routes` `MEMBER ↔ 'anggota'`; `roles.ts` presedensi/label MEMBER.
- `portal-nav-config.ts` — `'MEMBER'` masuk `CHURCH_ROLES.all` + dashboard → nav dasar: Info Event, Kegiatan, Info & Peluang, Dashboard, Akun.
- `AppContext.tsx` — bila tidak ada peran scoped **tetapi** `membership.isMember` → role efektif `MEMBER`; `roleMissing` dimatikan.

**Verifikasi staging (user uji BAPAK tanpa peran unit):** `staging-men` → `roles=[]`, `isMember=true` (→ tier MEMBER, portal terbuka); `staging-youth`/`staging-women` → `isMember=false` (tetap terkunci) ✓. `lint` bersih ✓ **541 test** hijau ✓ `build` OK ✓ (user uji dihapus setelah verifikasi).

### Next
1. **F3.5.1** — Pengurus Unit (struktur per unit).
2. **F3.5.2** — Modul Kolom (data KK + ibadah Kolom).
3. **F3.5.3** — Kaum Bapa & Kaum Ibu (+ Kas Unit setelah P1 Keuangan).
4. **F3.5.4** — Remaja & Anak. 5. **F3.5.5** — Komunitas.
5. (Opsional) hub `#/portal` mengarahkan pengguna Pemuda ke `youth.gehc.page`.

## Current — F3.4: Data ter-scope per unit (26 Sep 2026)

**Yang dibangun:**
- `server/lib/tenant-scope.mjs` (baru) — `activeTenantId(req)`, `isJemaatScope`, `tenantWhere(req)` (unit → `{ tenantId: { in: [unit, 'tenant-jemaat'] } }`; jemaat → `null`), `withTenant`, `tenantForWrite(req)`, `canAccessTenant(req, rowTenantId)`.
- **Daftar/list difilter, detail per-id dibiarkan** (deep link tetap jalan). Penulisan baru menyegel `tenantId` aktif.
- Diterapkan pada:
  - `GET /api/events` (`server/index.mjs`) — Prisma + fallback raw SQL.
  - `server/routes/church-calendar.mjs` — publik + daftar + create/patch/delete + generate (via `canAccessTenant`).
  - `server/routes/church-programs.mjs` — daftar + create/patch.
  - `server/routes/content-public.mjs` — `/api/content/public`, `/api/testimonials/public` (+ daftar admin) difilter; create konten/testimoni & aktivitas event menyegel tenant.
  - `POST /api/events` + draf konten event (`server/index.mjs`) — tenant dari host.
- Tes: `tests/unit/tenant-scope.test.ts`.

### Catatan/perilaku
- **Jemaat (hub)** melihat semua; **unit** melihat data unitnya + data jemaat.
- Data lama bertanda `tenant-youth` (event, konten, kalender) → muncul di **Pemuda** & **Jemaat**, **tidak** di unit lain (men/women/teen/kids) sampai dibuatkan konten/event unit.
- `Group`/`UserRole` tidak difilter (domain Pemuda) — dapat ditambah bila unit punya kelompok sendiri.

### Next
1. **F3.5** — modul khas unit (Kaum Bapa/Ibu, Anak, Kolom) + opsi keanggotaan (`MEMBER`).
2. (Opsional) hub `#/portal` mengarahkan pengguna Pemuda ke `youth.gehc.page`.

## Current — F3.3: Migrasi peran per BIPRA + scoping ketat (26 Sep 2026)

**Yang dibangun:**
- `server/lib/tenant-map.mjs` (baru) — `BIPRA_TENANT` (PEMUDA→youth, REMAJA→teen, ANAK→kids, BAPAK→men, IBU→women), `JEMAAT_ROLES=[SUPERADMIN,BPMJ]`, `UNIT_LEAD_ROLES=[KOMISI,COMMITTEE,ALUMNI]`, `tenantForBipra()`.
- `server/_migrate-roles-per-tenant.cjs` (baru, idempotent, dry-run default) — (1) **pindah** peran jemaat (SUPERADMIN/BPMJ) → `tenant-jemaat`; (2) **gandakan** peran unit-lead (KOMISI/COMMITTEE/ALUMNI) ke tenant sesuai `users.bipra` (groupId dikosongkan); (3) MENTOR/CO_MENTOR/MENTEE dibiarkan (khusus Pemuda). npm: `db:migrate:roles-per-tenant[:staging|:prod]`.
- `server/lib/tenant-roles.mjs` — scoping kini **ketat** (fallback longgar dihapus).
- Tes: `tests/unit/tenant-map.test.ts` + update `tenant-roles.test.ts`.

**Dijalankan di staging:** 16 peran jemaat dipindah, 1 COMMITTEE digandakan (REMAJA→tenant-teen).

**Verifikasi staging (login nyata):** youth+stevania → `KOMISI+MENTOR@tenant-youth` ✓; men+meyke(BPMJ) → `BPMJ@tenant-jemaat` (lintas unit) ✓; men+stevania → **`[]`** (ketat, terkunci) ✓; teen+putri(REMAJA) → `COMMITTEE@tenant-teen` ✓; hub+meyke → `BPMJ@tenant-jemaat` ✓.

### Catatan/perilaku (penting)
- Portal **unit hanya untuk peran unit itu / jemaat / SUPERADMIN**. User yang hanya punya peran Pemuda **tidak** bisa membuka portal unit lain (mis. `men`) — sesuai pilihan "ketat".
- **`gehc.page/#/portal` (hub = Portal Jemaat)** kini hanya untuk peran jemaat (BPMJ/SUPERADMIN). Pengguna Pemuda memakai `youth.gehc.page`.
- Belum ada peran dasar keanggotaan (opsi `MEMBER` ditunda) — anggota tanpa peran tetap tanpa akses portal.

### Next
1. **F3.4** — data ter-scope (`tenantScope()` pada 7 tabel ber-`tenantId`).
2. **F3.5** — modul khas unit (+ opsi peran `MEMBER`/keanggotaan bila diinginkan).
3. (Opsional) hub `#/portal` mengarahkan pengguna Pemuda ke `youth.gehc.page`.

## Current — F3.2: Identitas ter-scope per unit (26 Sep 2026)

**Yang dibangun:**
- `server/lib/tenant-roles.mjs` (baru) — `JEMAAT_TENANT_ID`, `rolesInTenant(roles, tenantId)`, `applyTenantScope(user, tenantId)`. Peran berlaku di unit bila milik tenant itu, atau `tenant-jemaat` (payung lintas unit), atau SUPERADMIN.
- `server/auth.mjs` — `attachUser` kini menetapkan `req.activeTenantId` (dari host) dan meng-scope `req.authUser.roles` ke tenant itu; `rolesAll` menyimpan seluruh peran; konteks sesi (`activeRole`/`activeNamespace`) tetap dihitung dari seluruh peran.
- Efek: **semua** `requireRole()`/`globalRoles()`/cek `r.role` otomatis menjadi **per-unit** tanpa mengubah ~363 call-site.
- `server/index.mjs` `/api/auth/me` — mengembalikan `user.rolesAll` + `rolesScoped` (lewat objek user).
- `src/types.ts` + `src/services/authApi.ts` — `User.rolesAll` & `User.rolesScoped` (mapping dari API).
- **Fallback aman** (sementara): bila user tak punya peran di tenant aktif → peran tidak difilter (`rolesScoped:false`), mencegah unit terkunci sebelum migrasi peran (F3.3).
- Tes: `tests/unit/tenant-roles.test.ts`.

**Verifikasi:** `lint` bersih ✓ test hijau ✓ `build` OK ✓

### Next
1. **F3.3** — migrasi peran per BIPRA (youth→tenant unit sesuai `User.bipra`; BPMJ/Bendahara → `tenant-jemaat`) → lalu **hapus fallback** agar scoping ketat.
2. **F3.4** — `tenantScope()` pada 7 tabel ber-`tenantId`.
3. **F3.5** — modul khas unit.

## Current — F3.1: Portal per unit aktif (26 Sep 2026)

**Keputusan pemilik (F3-full):** tiap domain = portal sendiri. Keanggotaan via **BIPRA**; peran **bertingkat per jenis unit**; **BPMJ/Bendahara/SUPERADMIN lintas unit**; data **unit terfilter, jemaat lihat semua**. Roadmap: F3.1 aktivasi host → F3.2 identitas ter-scope → F3.3 migrasi peran per BIPRA → F3.4 data ter-scope → F3.5 modul khas unit.

**F3.1 dibangun:**
- `tenant-jemaat` (payung) di `src/data/initialData.ts`; semua tenant unit `is_active: true`.
- `src/lib/portal-profiles.ts`: profil `jemaat` → `tenantId:'tenant-jemaat'`; helper `tenantIdForHost(host)`.
- `server/lib/host-context.mjs`: hub → `tenantId:'tenant-jemaat'`.
- `src/main.tsx`: **semua host unit** (`youth`/`teen`/`kids`/`men`/`women`/`districts`/`community`) membuka `<App/>` (portal); cabang `UnitComingSoon` dihapus (file disimpan).
- `src/context/AppContext.tsx`: `currentTenantId` diturunkan dari host (hub→jemaat, unit→tenant unit); filter peran **longgar** (tenant aktif + jemaat + SUPERADMIN, fallback semua peran) sampai F3.2 mengetatkan.
- `src/data/churchUnits.ts` + `ChurchHub.tsx`: semua unit **Aktif** + `unitPortalUrl()` (tautan prod/staging otomatis).
- `src/lib/host-context.ts`: `isStagingHost` (klien) untuk URL staging.

**Verifikasi:** `lint` bersih ✓ test hijau ✓ `build` OK ✓ Staging: `staging-men…` dst. membuka portal (Lingkup: Kaum Bapa) ✓ (diisi setelah deploy).

### Next
1. **F3.2** — identitas ter-scope di server (`activeTenantId` + filter `req.authUser.roles` + `rolesAll` untuk role picker).
2. **F3.3** — migrasi peran per BIPRA (youth→tenant unit; jemaat→`tenant-jemaat`).
3. **F3.4** — `tenantScope()` pada 7 tabel ber-`tenantId`.
4. **F3.5** — modul khas unit.

### Catatan
- Tanpa F3.2, peran belum dipisah di server (KOMISI mana pun dianggap sama) & data belum ter-scope.

## Current — Staging host paritas domain (26 Sep 2026)

**Tujuan:** staging kini punya **host paritas** dengan produksi, sehingga bisa dibandingkan *apple-to-apple*.

| Peran | Staging | Produksi |
|---|---|---|
| Hub | `staging.gehc.page` | `gehc.page` |
| Unit | `staging-<unit>.gehc.page` (youth/teen/kids/men/women/districts/community) | `<unit>.gehc.page` |

**Yang dibangun:**
- `src/lib/host-context.ts` + `server/lib/host-context.mjs` (mirror): `STAGING_HUB_HOST='staging.gehc.page'`, prefix `staging-`; `isHubHost`/`resolveHostUnit` mengenali host staging; fallback tak dikenal tetap Pemuda.
- `src/lib/portal-profiles.ts`: override `?portal=` hanya untuk host **tak dikenal** (`isKnownHost`); host berstruktur (gehc.page, staging-*.gehc.page) tidak bisa di-override.
- `scripts/staging-hosts.mjs` (baru) — daftar host; `deploy-staging.mjs` & `sync-staging.mjs` **loop alias** ke semua host + legacy `staging-gehcpage.vercel.app`; verifikasi kirim `x-vercel-protection-bypass` bila `VERCEL_AUTOMATION_BYPASS_SECRET` ada.
- Docs: `docs/tech/staging-parity.md` + `AGENTS.md`.

**Infra terpasang (sekali):**
- DNS Cloudflare: 8 CNAME DNS-only (`staging`, `staging-youth/teen/kids/men/women/districts/community`) → target Vercel.
- Vercel: 8 domain ditambahkan ke project `gehc.page` + alias ke deployment staging.

**Verifikasi:** `lint` bersih ✓ **519 test** hijau ✓ `build` OK ✓ 8 host staging `/api/version` = `486391c` (preview) ✓ Browser: `staging.gehc.page` → badge **Lingkup: Jemaat** (modul Pemuda absen, `org-hierarchy`/`integrations` tampil); `staging-youth.gehc.page` → **Lingkup: Pemuda** (Divisi lengkap) ✓

**Proteksi:** Password Protection Vercel butuh paket Pro (gagal 428) → dipakai **Basic Auth tingkat aplikasi** untuk host staging (`server/index.mjs`, env `STAGING_BASIC_AUTH` = `user:password`). Berlaku untuk host staging paritas, alias legacy `staging-gehcpage.vercel.app`, dan URL preview CLI `gehcpage-<hash>-gehc.vercel.app`; **host produksi tidak terpengaruh**. Kredensial ada di `.env` (lokal, gitignored) & Vercel env Preview. **Rotasi terakhir diterapkan 26 Sep 2026.**

**Verifikasi:** `lint` bersih ✓ **520 test** hijau ✓ `build` OK ✓ Staging: `staging.gehc.page` **401 tanpa kredensial / 200 dengan kredensial** ✓ browser (header Basic) → badge **Lingkup: Jemaat** + nav jemaat ✓ Prod `youth.gehc.page` tetap **200** ✓ commit `08ceee3` di prod & staging ✓

### Next
1. Tambah origin staging di Google Console (opsional, untuk login Google di host staging; login password/demo sudah jalan).
2. Tentukan jadwal rotasi kredensial staging.

### Commands
```powershell
npm run deploy:staging          # deploy + alias ke semua host staging
npm run staging:sync            # selaraskan staging = main
npm run dns:list                # DNS Cloudflare
# kredensial staging (Basic Auth): lihat STAGING_BASIC_AUTH di .env
```


## Current — Portal per domain: F1 profil portal + tag nav (26 Sep 2026)

**Keputusan pemilik:** jemaat = payung; Pemuda salah satu BIPRA. Tiap domain/subdomain punya **portal sendiri** (jemaat, youth, men, women, kids, kolom, …). Modul jemaat **tampil di kedua portal** dengan **lingkup** berbeda (Jemaat = seluruh BIPRA+Kolom; Pemuda = hanya pemuda) — kecuali modul admin jemaat (`org-hierarchy`, `integrations`) yang khusus portal Jemaat, dan modul Pemuda (Beyonders/5 Divisi) yang tetap khusus Pemuda. Hub `gehc.page` = **Portal Jemaat**.

**F1 yang dibangun (nav-only, tanpa ubah API/RBAC/data):**
- `src/lib/portal-profiles.ts` — `PortalId` (jemaat/youth/men/women/teen/kids/kolom/community), `PORTAL_PROFILES`, `portalIdForHost` (hub→jemaat; host tak dikenal→youth), `resolvePortalId` (host + override `?portal=` **non-produksi**), `portalScopeOf`, `isProductionHost`.
- `src/lib/portal-nav-config.ts` — field `portals?: PortalId[]` pada `PortalNavItemDef`; tagging seluruh `BASE_NAV` (10 item Pemuda-only, 2 item Jemaat-only, sisanya semua portal); `buildPortalNavItems`/`buildPortalSidebarItems` menerima `portalId` (tanpa argumen = perilaku lama, backward-compatible).
- `src/hooks/usePortalProfile.ts` — host → profil portal (SSR-safe) + override uji `?portal=jemaat`.
- `src/components/portal/PortalLayout.tsx` — badge **"Lingkup: Jemaat/Pemuda"** di sidebar; nav + panel divisi/unit difilter per portal.
- i18n: `portal.portalNames` + `layout.scopePrefix` (id/en).

**Tooling data (request pemilik):** `server/_copy-prod-to-staging.cjs` + npm `db:copy:prod-to-staging[:apply]` — tarik **data PROD → STAGING** (manifest tabel otomatis dari `prisma/schema.prisma`, dry-run default, `--truncate` FK-off, `--apply`), **passwordHash diganti** `DEMO_PASSWORD` (akun prod tidak bisa login di staging), kecualikan tabel rahasia/opsional (operator/secret/push/ai-config/blob avatar). Staging kini berisi data produksi terakhir + akun demo.

**Verifikasi:** `lint` bersih ✓ **515 test** hijau (baru: `portal-profiles.test.ts`, `portal-nav-config.test.ts`) ✓ `build` OK ✓ Staging (`9b5bd2e`): portal **Jemaat** → badge "Lingkup: Jemaat", modul Pemuda (Liturgia/Didaskalia/Monitoring/Regenerasi) **absen**, `org-hierarchy`/`integrations` tampil ✓ portal **Pemuda** → Divisi lengkap, badge "Lingkup: Pemuda" ✓

### Next
1. **Verifikasi staging oleh pemilik** → bila setuju: merge branch ke `main` (prod).
2. **F2** — pindahkan modul JEMAAT ke slot portal Jemaat (komponen sama) + pintasan.
3. **F4/scope** — filter data per portal (`scope` JEMAAT|BIPRA|KOLOM) + peran jemaat netral.
4. **P1** — Fasilitas & Penyewaan + Keuangan (sesuai `docs/product/church-portal.md`).

### Commands
```powershell
npm run db:copy:prod-to-staging          # dry-run (baca prod)
npm run db:copy:prod-to-staging:apply    # truncate + tulis ke staging
npm run db:seed-users:staging            # pulihkan akun demo
npm run lint; npm run test; npm run build
git push origin cursor/church-portal-f1-portal-profiles
npm run deploy:staging                   # working tree -> staging-gehcpage.vercel.app
```


## Current — Portal Jemaat: fondasi P0 (25 Sep 2026)

**Keputusan pemilik:** portal jemaat di **hub `gehc.page`** (tanpa subdomain baru); unit/posisi berbasis **`division` + `position`** (tanpa enum `Role` baru); keuangan **cashbook sederhana**; penyewaan **booking + invoice manual**; **satu BZP** di bawah Bendahara (+ petty cash allowance); urutan **P0 → Fasilitas+Keuangan → BZP/Bendahara → THL → Panji/Kolom**.

**Dokumen desain:** `docs/product/church-portal.md` (tujuan, org, RBAC, model P1–P4, API, nav, fase, data yang diminta).

**P0 yang dibangun:**
- `src/lib/church-org.ts` + `server/lib/church-org.mjs` — katalog 4 unit: **PEMBANGUNAN** (Ketua/Bendahara/Kostor/Asisten Kostor; Fasilitas & Penyewaan · Pemeliharaan), **THL** (Stewardship · MDS), **TECHTEAM**, **PANJI**.
- `server/lib/church-access.mjs` — `churchUnitsOf`, `canAccessChurchUnit`, `isChurchLeader`, `isBendahara`, `requireChurchUnit`.
- Endpoint: `GET /api/me/church-units`, `GET /api/church/org`.
- Client: `useMyChurchUnits` + tab sidebar grup **"Jemaat" → Unit & Struktur Jemaat** (`church-org`) + `ChurchOrgPanel` (unit, sub-divisi, posisi, pengurus/posisi terbuka) + i18n id/en + guide.
- Seed `server/seed-church-org.mjs` (11 posisi terbuka) — dijalankan ke **staging & prod**; npm scripts `db:seed:church-org[:staging|:prod]`.
- Perbaikan: reset tab menu menunggu `myDiv/myChurch.loading` selesai (deep-link tidak ter-reset).

**Verifikasi:** `lint` bersih ✓ **498 test** hijau ✓ `build` OK ✓ API staging: 4 unit (11 anggota) ✓ Browser (SUPERADMIN): sidebar **JEMAAT › Unit & Struktur Jemaat** tampil; panel memuat 4 unit + posisi (Kostor/Asisten Kostor) + posisi terbuka ✓ Prod & staging = `e4b824c` ✓

### Next
1. **P1** — Fasilitas & Penyewaan + Keuangan (kas, transaksi, petty cash, pengajuan dana, distribusi) sesuai `docs/product/church-portal.md`.
2. Lengkapi data pengurus tiap unit (menggantikan baris "Posisi Terbuka") + daftar Kolom & tarif sewa.


## Current — Info & Peluang: caption WA + deep link per warta (25 Sep 2026)

**Ditambahkan:**
- **Caption siap-kirim WhatsApp** (auto + bisa disunting/disimpan): kolom baru `internal_warta.caption`; bila kosong dipakai caption otomatis (judul, kategori, ringkasan, deadline, sharer+nama, link, hashtag `#InfoPeluang #GEHCYouth`).
- **Deep link per warta**: `https://youth.gehc.page/#/portal/<ns>/internal-warta?item=<id>` → panel **auto-membuka detail**. Namespace tidak divalidasi per peran, jadi aman dibagikan ke peran mana pun (wajib login).
- **Tombol admin** (Superadmin/Komisi/Committee) di kartu & modal detail: **Salin caption** dan **Kirim ke WhatsApp** (`wa.me/?text=`, tujuan dipilih manual). Editor punya **textarea Caption (opsional)** + **pratinjau caption otomatis**.
- Helper baru `src/lib/warta-caption.ts` (`buildWartaCaption`, `wartaAbsoluteUrl`), pakai `whatsappShareUrl`/`copyText` yang sudah ada.

**Migrasi:** `server/_migrate-internal-warta-caption.cjs` (ALTER `caption`) — dijalankan ke **staging & prod**; bootstrap DDL + `db-migrate-local` + npm scripts diperbarui.

**Verifikasi:** `lint` bersih ✓ **498 test** hijau (baru: `warta-caption.test.ts`) ✓ `build` OK ✓ Staging: create warta → **deep link `?item=<id>` membuka detail otomatis**, tombol **Salin caption** & **Kirim WA** tampil (admin) ✓ Residu uji dibersihkan ✓ Prod & staging = `f6b920a` ✓

**Catatan:** WA teks tidak melampirkan file → caption memuat link ke warta; PDF diunduh dari halaman (login).

### Next
1. Prod: publikasikan warta → **Salin caption** → tempel/bagikan ke grup WA.
2. (Opsional) Tombol khusus ke nomor/grup WA tetap bila diperlukan.


## Current — Info & Peluang: migrasi tabel PROD (25 Sep 2026)

**Masalah:** di prod muncul `Prisma.InternalWarta.create() … The table internal_warta does not exist`.
**Penyebab:** saat pengerjaan hanya migrasi **staging** + setup folder Drive (staging & prod) yang dijalankan; **migrasi tabel prod belum**.
**Perbaikan (tanpa perubahan kode):**
- `npm run db:migrate:internal-warta:prod` → `internal_warta` dibuat (17 kolom).
- `npm run db:setup:internal-warta-folder:prod` → folder `1KenbF30ObmMuFk1bARROLKh2SnI3Lw6y` tersimpan di `channel_links` (`INTERNAL_WARTA`/`FOLDER`).
- Verifikasi unggah Drive prod: upload+delete PDF uji ke folder tersebut → **OK**.

Prod siap: silakan ulangi **Info & Peluang → Buat Warta → Publikasikan**.


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

## Episode: Kartu publik #/events — pola + grup serving, judul 2 baris (16 Okt 2026, main `0133375`)

Done:
- `GET /api/events/landing` bawa `venue{eventId,serviceType,kind}` + `worship{patternCode/Name,sessionTitle,status}` (publik-aman, tanpa config/accessCode) + `serving` nyata; fallback sesi via `sessionDate`.
- `EventsTimeline` full card: judul split tema/tanggal (`splitThemeDate`, `text-balance`), baris tanggal penuh, meta bawah jam saja (`fmtTimeWib`), box tengah `EventMiddleInfo` (SERVING → nama grup Penanggung+Tuan Rumah; MENTORING → label Komisi + Tim Kerja; BAKUTAU → hidden; fallback `service-schedule` bila serving nyata belum ada).
- Test `event-dates.test.ts` (+5: split + time). Lint bersih, 1179 test hijau (1 flaky `lazy-routes ChurchHub timeout`, tak terkait), build OK.
- Commit `0133375` → push `main` (prod) + `staging:sync` (branch staging + deploy `gehcpage-kzg6ege7p` + 9 alias staging).

Next:
- Cek visual `https://staging-youth.gehc.page/#/events` (desktop 1440px + HP 360px): box tengah terisi, pola muncul bila sesi Didaskalia tertaut eventId/tanggal.
- Bila pola kosong: tautkan `WorshipSession.eventId` (atau samakan `sessionDate` hari event).
- QA prod `https://youth.gehc.page/#/events` setelah deploy main selesai.

Commands:
```powershell
git log --oneline -3   # 0133375 di atas
npm run staging:sync   # sudah jalan (deploy + alias); sisa 3 alias dipasang manual via vercel alias set
```

## Episode: Kartu #/events tweak proporsi — panel kanan gabung (16 Okt 2026, main `e339d93`)

Done (lint bersih, 18 test hijau, build OK):
- `EventsTimeline`: 3 kolom → 2 kolom; `EventMiddleInfo` pindah ke panel kanan (`lg:w-72`, `self-end`) di atas countdown; kiri `max-w-2xl`; padding HP `p-6`.
- Box: hanya nama pola + badge status (Segera/Dibuka/Berlangsung/Penutup/Selesai); `sessionTitle` mentah tidak dirender.
- `Countdown`: label `whitespace-nowrap`, gap 3→2 (tidak wrap di panel sempit).
- Commit `e339d93` → push `main` ✓ (prod auto-deploy). Branch `staging` = `main` ✓ (push sukses).

Staging sync SELESAI (setelah `vercel login`):
- Deploy preview `gehcpage-lakmut63h` sukses, 9/9 alias staging menunjuk deployment baru.
- Verifikasi `/api/version`: main = staging = `e339d93` ✓ sama.
## Episode: Movie Breakdown 11 blok + selaraskan kontrol/peserta/layar (16 Okt 2026, belum commit)

Minta (5 concern): (1) rundown 11 blok (Registrasi 5 mnt s/d Foto 5 mnt); (2) tahapan kontrol vs peserta inkonsisten + Likert #3 spoiler + hapus Deep Sharing ganti afirmasi; (3) Reset ke Draft hapus total isi audiens; (4) undian tampil nama+grup + hasil Lesson Learned di layar, rename chip card; (5) timer hanya Likert Awal, film tanpa timer + overlay tenang + audio bioskop, M3 buka Likert Akhir + chip serentak. Plus error Gate AKHIR OPEN saat DRAFT.

Ubah (kode, lint bersih, 1190 test hijau + 1 flaky pre-existing lazy-routes ChurchHub):
- Seed server/_seed-worship-patterns.cjs: BEDAH_FILM 15 fase+2 paralel -> 11 blok (155 mnt = 65+durasi), playbook S1/S3/S4/S5/S6/S7 + naskah monolog siap baca per blok; defaultDurationMin 170->155. Dok pola-ibadah-hari-H.md + worship-patterns.md selaras.
- src/lib/session-engine.ts: segmen film 6->5 (likert-awal -> nonton -> likert-akhir -> lesson-learned -> kesaksian, deep dihapus); likert-akhir: [likert,chips]; maju ikut gate postOpen bukan countdown; FilmProgress.deepFilled -> postOpen.
- Likert: bedah-film-case-for-christ.mjs #3 tanpa spoiler. Draft tambah section affirm (Q1-3 + likert-low/high); server filmAffirm() + affirmations di payload + affirmation di POST likert/PUT notes; peserta tampil kartu afirmasi instan (Likert + tiap Q).
- Reset keras server/routes/worship.mjs (reset): hapus responses/votes/notes + testimony/screening/phase/fgd/gate (soal+chip master + draft dipertahankan); guard 409 AKHIR dibuka saat DRAFT/LIKERT_OPEN; UI confirm ganda.
- Kontrol: M0 (timer 5 mnt fase M0) -> M1 Mulai Film ikuti film (matikan phase) -> M3 Buka Likert AKHIR + Lesson Learned -> M4 Undi + Kesaksian; heading Chip words -> Lesson Learned. Fase M0 300 dtk (session-stage.mjs FILM_PHASES + mentoring.ts SessionPhase).
- Layar: finale film gabungan (delta + Lesson Learned + roda nama&grup); timer disembunyi saat film (kecuali LIKERT_OPEN); screening tanpa countdown -> kartu tenang + tombol Nada bioskop (WebAudio). Peserta: kartu countdown M0, screening Tayang, HP tetap bisa jawab.
- Test: session-engine (segmen/widget/M0/phase), worship-session-draft (affirm 5 field, anti-spoiler, filmAffirm), seed/playbook via reseed.

Akar error screenshot: reset lunak tak hapus jawaban+gate + filmSetRounds tanpa guard -> pil centang hantu + Gate AWAL CLOSED AKHIR OPEN saat DRAFT. Teratasi Episode C + guard.

Next (belum jalan):
- git add file episode ini saja (JANGAN -A, sesi paralel aktif) -> commit -> push + npm run staging:sync (1 batch).
- npm run db:seed:worship:staging (pola 11 blok) -> QA staging event 17 Okt (M0 timer -> PRE+afirmasi -> M1 tenang -> 3Q+afirmasi -> M3 serentak -> POST+delta -> M4 undi 2 -> layar gabungan -> Reset hapus total).
- Patch teks Likert #3 sesi prod sesi-2026-10-17-bedah-film (PRE/POST) bila sudah Terapkan; db:seed:worship:prod bila rundown disetujui.

## Episode: Push main + staging sync bedah-film (16 Okt 2026, commit 184711d)

Done:
- Push main OK (b6efb7a..184711d) -> prod auto-deploy.
- npm run staging:sync OK: branch staging + deploy + verifikasi /api/version main = staging = 184711d (sama).
- 2 alias gagal dipasang (scope error, perlu manual): staging-community.gehc.page + staging-gehcpage.vercel.app.
- npm run vercel:gc dry-run: 3 deployment, 0 kandidat hapus.

Next:
- Pasang 2 alias manual via vercel alias set (atau dashboard).
- npm run db:seed:worship:staging (pola 11 blok) -> QA staging event 17 Okt.
- Patch teks Likert #3 sesi prod bila sudah Terapkan; db:seed:worship:prod bila rundown disetujui.

## Prod diterapkan penuh � Bedah Film 17 Okt (16 Okt 2026, sesi prod)

Done:
- Pola BEDAH_FILM di DB prod + staging: 11 blok, 155 mnt (seed prod + staging OK).
- Sesi prod sesi-2026-10-17-bedah-film di-Terapkan penuh (skrip one-off, setara Reset + Apply-draft): draft 5 section (film, likert-film, deep, affirm, lesson) + 5 afirmasi lengkap; soal Likert PRE+POST 5+5 (teks anti-spoiler); 10 chip Lesson Learned; screening fresh 112 mnt; gate bersih (likertRounds/phase/fgd/testimony/rounds null); data uji (10 jawaban/3 vote/4 catatan/undian lama) dihapus; status DRAFT.
- Staging: sesi sengaja TIDAK disentuh (status WRAPUP dari simulasi 16 Okt).
- server/lib/bedah-film-case-for-christ.mjs: section affirm (5 teks penuh 1Kor 15/Yoh 20/Kis 4) + test kurasi diperbarui; lint bersih, test terkait 46 hijau.

Next:
- QA di prod: kontrol 11 blok, M0 timer 5 mnt, PRE+afirmasi, M1 tenang, 3Q+afirmasi, M3 serentak, POST+delta, M4 undi, layar gabungan.

Update staging (16 Okt 2026, sesi prod):
- Branch staging = main = 783a605 (head saat ini; termasuk commit sesi paralel penatalayan: usulan multi-divisi mentor/co-mentor). Deploy+alias staging OK setelah `vercel login` ulang: deploy gehcpage-rjigk9gyq + 9/9 alias (termasuk staging-community.gehc.page + staging-gehcpage.vercel.app yang sebelumnya gagal). /api/version main = staging = 783a605 sama.
- DB staging: pola 11 blok OK + sesi staging di-reset+apply penuh (WRAPUP -> DRAFT, data uji dihapus, draft 5 section + affirm, PRE+POST 5+5, 10 chip, gate bersih). QA staging: staging-youth.gehc.page/#/mentoring/sesi-2026-10-17-bedah-film/kontrol.
