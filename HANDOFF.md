# GEHC Portal — Handoff

## Current — Katalog Minat & Kampus + reminder (4 Sep 2026)

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
