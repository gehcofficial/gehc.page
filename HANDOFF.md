# GEHC Portal — Handoff

## Current — Hub gehc.page + multi-unit (pool) subdomain + registrasi sadar-asal (12 Sep 2026)

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
