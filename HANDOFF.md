# GEHC Portal — Handoff

## Current — WA sesuai peran aktif + album kelompok tampil di publik (18 Sep 2026)

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
