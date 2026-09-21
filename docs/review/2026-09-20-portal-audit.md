# Audit Portal GEHC.page — 20 Sep 2026

> **Status:** analisis & usulan. **Tidak ada** perubahan kode, endpoint, nav, atau database dari dokumen ini.
> Semua eksekusi dilakukan terpisah setelah Anda meninjau checklist di bagian 11.
> Matriks nav↔API yang sudah ada tetap berlaku: [`docs/tech/nav-api-parity.md`](../tech/nav-api-parity.md) — dokumen ini melengkapinya dengan penilaian kebutuhan, pola akses, dan prioritas.

**Cara membaca:** setiap temuan menyertakan bukti `file:line`. Kotak `[ ]` di bagian 11 adalah checklist keputusan Anda.

---

## 1. Ringkasan eksekutif

### 1.1 Angka kunci

| Metrik | Nilai | Sumber |
|---|---|---|
| Komponen portal | **94 file** | `src/components/portal/` |
| Destinasi nav (sidebar) | **26** + 1 route-only (`pwa-settings`) | `src/lib/portal-nav-config.ts:27-56` |
| Registrasi endpoint | **456** (GET 183 · POST 179 · PATCH 44 · DELETE 37 · PUT 13) | `server/index.mjs` + `server/routes/*` |
| Endpoint tanpa guard middleware | **143** (63 punya cek inline `req.authUser`, **80 tanpa cek apa pun**) | hasil pemindaian |
| Pemanggilan `fetch` manual | **480** (+11 `authedFetch`) | `src/**` |
| Hook react-query | **6 `useQuery`, 0 `useMutation`** | `src/hooks/`, `src/app/QueryProvider.tsx:4-8` |
| Panel > 30 KB | **15 file** (terbesar 101 KB & 96 KB) | `src/components/portal/` |
| Endpoint 0-referensi di `src/` | **±50** (kandidat arsip) | Lampiran B |

### 1.2 Sepuluh temuan teratas

| # | Temuan | Tingkat | Dampak |
|---|---|---|---|
| 1 | 3 endpoint **tulis** publik tanpa auth sama sekali (`sync-batches`, `migrate/events`, `seed/events`) dan 0 referensi di frontend | **P0** | Siapa pun bisa menulis/migrasi data |
| 2 | Endpoint **baca** publik mengekspos data internal: absensi + nama anggota + pencatat, riwayat transisi mentor, notulen rapat | **P0** | Kebocoran data pribadi anggota |
| 3 | Lock UI mati (`const isAllowed = true;`) → badge "terkunci" tidak pernah muncul; gating nav murni kosmetik | **P0** | Ilusi keamanan; UI tidak jujur soal hak |
| 4 | 4 destinasi untuk satu domain "Orang" di KOMISI (people, youth-gehc, onboarding, jethro-placement) | **P2** | Beban kognitif; staf inti punya 21 tab |
| 5 | `AppContext` memuat `/api/db/struktur` + `/api/content/public` + `/api/db/groups` di **setiap** load (publik & portal) | **P1** | Payload besar untuk semua pengunjung |
| 6 | `/api/notifications` di-poll tiap **30 detik** tanpa henti selama portal terbuka | **P1** | Beban server & baterai |
| 7 | 7 UI berbeda menampilkan kalender/kegiatan (5 komponen kalender) | **P2** | Pengguna bingung "yang benar yang mana" |
| 8 | 2 CMS warta (`ManageWeeklyInfo` vs `WartaPublikTab`) menulis data yang sama dari 2 tempat | **P2** | Risiko dua editor saling menimpa |
| 9 | 480 `fetch` manual vs 6 `useQuery` & 0 `useMutation` → tidak ada cache/retry/invalidasi konsisten | **P1** | Data sering dobel-request, state tidak sinkron |
| 10 | 15+ lokasi N+1 (loop `await` per baris) di jalur tulis massal & Drive | **P1** | Endpoint lambat saat data bertambah |

### 1.3 Yang diminta dari Anda

1. Setujui **P0** (keamanan) untuk dikerjakan lebih dulu — beberapa butuh keputusan produk (mana yang memang publik).
2. Setujui **susunan nav baru per peran** (bagian 5) atau tandai bagian yang tidak cocok.
3. Tentukan apakah endpoint 0-referensi (Lampiran B) boleh **dihapus** atau harus **diarsipkan dengan guard**.

---

## 2. Cakupan & metode

**Cakupan:** seluruh `src/components/portal/` (94 file), `src/lib/portal-nav-config.ts`, `src/components/portal/PortalLayout.tsx`, `server/index.mjs`, `server/routes/*` (35 file), `server/lib/*`, serta lapisan data klien (`src/hooks/`, `src/app/QueryProvider.tsx`, `src/context/AppContext.tsx`).

**Metode:** analisis statis — pemetaan nav & gating, inventaris endpoint + guard, pelacakan pemanggil tiap endpoint dari `src/`, pencarian duplikasi/N+1/polling, lalu **verifikasi manual baris kode** untuk setiap temuan P0.

**Batasan yang harus diketahui:**

- Semua temuan P0 di dokumen ini sudah **dicek baris kode satu per satu** (bukan hanya hasil pencarian otomatis).
- Beberapa kandidat dari pemindaian otomatis **dibuang** karena ternyata sudah aman (mis. `POST /api/titles/suggest`, `/api/institutions/suggest`, `/api/recreational/suggest` punya cek `req.authUser` inline; `PATCH /api/pastoral-care/:id/resolve` punya otorisasi per-baris via `canSeeNote` + Komisi). Yang tersisa di bagian 7 adalah yang benar-benar tanpa cek.
- Belum ada uji runtime (Playwright tidak tersedia di sesi ini); angka perilaku (polling, over-fetch) berasal dari kode, bukan trafik produksi.
- Jumlah endpoint dihitung dari registrasi rute; rute yang di-mount bersyarat tidak dihitung ganda.

---

## 3. Inventaris nav per peran

### 3.1 Master 26 destinasi

Sumber: `src/lib/portal-nav-config.ts:27-56`; render: `src/components/portal/PortalLayout.tsx:710-835`.

| # | id | Label | Grup | Peran | Komponen (ukuran) |
|---|---|---|---|---|---|
| 1 | `account` | Akun Saya | Utama | semua | `AccountHub` (4 KB) |
| 2 | `event-info` | Info Event | Utama | semua | `EventInfoPanel` (14 KB) |
| 3 | `kegiatan` | Kegiatan | Utama | semua | `IbadahMingguanPanel` (14 KB) |
| 4 | `dashboard` | Dashboard & Ringkasan | Utama | COMMITTEE, MENTOR, CO_MENTOR, MENTEE, ALUMNI | `PortalDashboard` (22 KB) |
| 5 | `people` | Orang & Undangan | Komunitas | KOMISI | `PeopleInvites` (19 KB) |
| 6 | `onboarding` | Onboarding Pipeline | Komunitas | KOMISI | `WaitingPoolPanel` (37 KB) |
| 7 | `jethro-placement` | Review Penempatan | Komunitas | KOMISI, COMMITTEE, BPMJ | `JethroPlacementReview` (37 KB) |
| 8 | `youth-gehc` | Jemaat | Komunitas | KOMISI | `YouthGEHCList` (96 KB) |
| 9 | `catalog` | Katalog Minat/Kampus/Gelar | Komunitas | KOMISI | `CatalogReviewPanel` (39 KB) |
| 10 | `org-hierarchy` | Kelola Hirarki | Komunitas | KOMISI | `OrgHierarchyPanel` (17 KB) |
| 11 | `groups-monitoring` | Monitoring Kelompok* | Komunitas | 6 peran | `ManageGroupsMonitoring` (101 KB) |
| 12 | `beyonders-leaders` | Pemimpin 10 Rumah | Komunitas | KOMISI, COMMITTEE, BPMJ | `BeyondersLeadersPanel` (11 KB) |
| 13 | `pastoral-care` | Portal Doa | Komunitas | 5 peran | `PastoralCareBoard` (30 KB) |
| 14 | `jethro` | Regenerasi Kelompok | Komunitas | KOMISI, BPMJ | `JethroEngine` (19 KB) |
| 15 | `content-weekly` | Kelola Warta Pemuda | Konten | COMMITTEE | `ManageWeeklyInfo` (19 KB) |
| 16 | `content-activities` | Kelola Agenda Kegiatan | Konten | COMMITTEE | `ManageActivities` (18 KB) |
| 17 | `content-testimonials` | Kelola Testimoni | Konten | KOMISI | `ManageTestimonials` (18 KB) |
| 18 | `announcements` | Pengumuman | Konten | 6 peran | `AnnouncementComposer` (15 KB) |
| 19 | `kesaksian` | Kesaksian | Komunitas | MENTEE | `MenteeKesaksianPanel` (6 KB) |
| 20 | `media-guide` | Panduan Media (Drive) | Konten | KOMISI, COMMITTEE | `MediaGuidePanel` (17 KB) |
| 21 | `struktur` | Struktur Organisasi | Struktur | COMMITTEE | `ManageStruktur` (38 KB) |
| 22 | `events` | Program & Event | Kerja | KOMISI, COMMITTEE, BPMJ | `EventWorkspacePanel` (52 KB) |
| 23 | `divisions` | Panel Divisi (6 divisi) | Kerja | KOMISI, COMMITTEE | `DivisionWorkspacePanel` (101 KB) |
| 24 | `wa-channels` | Kanal WhatsApp | Kerja | KOMISI, COMMITTEE, BPMJ | `WhatsAppChannelsPanel` (12 KB) |
| 25 | `integrations` | Integrasi Google Drive | Sistem | KOMISI | `ManageIntegrations` (32 KB) |
| 26 | `church-info` | Info Gereja | Sistem | SUPERADMIN, BPMJ, KOMISI | `ManageChurchInfo` (25 KB) |

\* Label `groups-monitoring` dinamis: "Monitoring Kelompok Binaan" (mentor), "Monitoring Kelompok Saya" (mentee), "Monitoring 10 Kelompok" (lainnya) — `portal-nav-config.ts:102-106`.

Route-only (tanpa entri sidebar, tetap bisa diakses via tautan langsung): `pwa-settings` → `PWASettingsPanel` (`PortalLayout.tsx:832`; sengaja disembunyikan per `portal-nav-config.ts:54-55`).

### 3.2 Beban per peran

| Peran | Jumlah | Daftar (urutan tampil) |
|---|---|---|
| **SUPERADMIN** | **26** | semua destinasi |
| **KOMISI** | **21** | event-info, kegiatan, people, onboarding, jethro-placement, youth-gehc, catalog, org-hierarchy, groups-monitoring, beyonders-leaders, pastoral-care, jethro, events, divisions, wa-channels, integrations, church-info, media-guide, content-testimonials, account, announcements |
| **COMMITTEE** | **15–16** | event-info, kegiatan, dashboard, groups-monitoring, beyonders-leaders, pastoral-care, jethro-placement, content-weekly, content-activities, struktur, events, divisions, wa-channels*, media-guide, account, announcements |
| **BPMJ** | **11** | event-info, kegiatan, jethro-placement, beyonders-leaders, jethro, groups-monitoring, events, wa-channels, church-info, account, announcements |
| **MENTOR** | **7** | event-info, kegiatan, dashboard, groups-monitoring, pastoral-care, account, announcements |
| **CO_MENTOR** | **7** | idem MENTOR |
| **MENTEE** | **7** | event-info, kegiatan, dashboard, groups-monitoring, kesaksian, pastoral-care, account |
| **ALUMNI** | **4** | account, event-info, kegiatan, dashboard |
| **Sedang onboarding** | **2** | event-info, account |

\* `wa-channels` untuk COMMITTEE hanya jika BOD Tim Kerja (`portal-nav-config.ts:125`).

### 3.3 Anomali yang perlu diputuskan

1. **KOMISI & BPMJ tidak punya Dashboard**, padahal Dashboard berisi kartu personal (kanal WhatsApp saya, tugas pelayanan saya, ulang tahun) yang relevan untuk semua peran — `portal-nav-config.ts:31` vs `:94`, `:99`.
2. **`dashboard` tetap dicantumkan di override KOMISI & BPMJ** (`:94`, `:99`) tapi difilter keluar → entri mati yang menyesatkan pembaca kode.
3. **`announcements` tidak ada di daftar override mana pun** → selalu ditempel di paling bawah, setelah `account` (`:138-140`). Akibatnya MENTOR/CO_MENTOR melihat "Pengumuman" di posisi terakhir, bukan di grup Konten.
4. **`groups-monitoring` muncul untuk MENTEE** dengan 8 sub-tab penuh (Form input, Riwayat, Anggota, Pohon keluarga, Absensi, Doa, Jadwal, Album) — sub-tab tulis memang diblokir di dalam, tapi secara UI mentee melihat 8 pilihan.
5. **Lock UI mati**: `PortalLayout.tsx:475` menetapkan `isAllowed = true` sehingga cabang badge terkunci (`:513-517`, `:545-549`) tidak pernah tercapai.

---

## 4. Penilaian kebutuhan per panel

Kolom **Rekomendasi** hanya berisi: **Pertahankan**, **Gabung**, **Sembunyikan dari peran tertentu**, atau **Read-only-kan**. **Tidak ada usul menghapus fitur** — semua panel Anda tandai wajib dipertahankan.

### 4.1 Orang & keanggotaan

| Panel | Peran sekarang | Overlap dengan | Rekomendasi |
|---|---|---|---|
| `YouthGEHCList` (96 KB) | KOMISI | `PeopleInvites`, `ManageGroupsMonitoring→Anggota`, `AccessGroupsPanel` | **Pertahankan sebagai sumber data jemaat**; jadikan sub-tab "Jemaat" di destinasi Orang |
| `PeopleInvites` (19 KB) | KOMISI | `YouthGEHCList`, `AccessGroupsPanel`, `ProvisionInviteWizard` | **Gabung** → sub-tab "Akun & Undangan" |
| `WaitingPoolPanel` (37 KB) | KOMISI | `JethroPlacementReview`, `PlacementChoiceModal` | **Gabung** → sub-tab "Pipeline Onboarding" |
| `JethroPlacementReview` (37 KB) | KOMISI, COMMITTEE, BPMJ | `WaitingPoolPanel`, `JethroEngine` | **Gabung** → sub-tab "Review Penempatan" di destinasi Regenerasi |
| `ManageGroupsMonitoring` (101 KB) | 6 peran | `AttendancePanel`, `GroupAlbumsPanel`, `PenatalayanCalendar`, `GroupPrayerNotes` | **Pertahankan**; **sembunyikan sub-tab tulis** untuk MENTEE/ALUMNI |
| `BeyondersLeadersPanel` (11 KB) | KOMISI, COMMITTEE, BPMJ | `RegenerationWizard` (nested), `JethroEngine` | **Pertahankan**; pindahkan `RegenerationWizard` ke destinasi Regenerasi agar tidak ada 2 pintu regenerasi |
| `OrgHierarchyPanel` (17 KB) | KOMISI | `ManageStruktur`, `OrgSlotPicker`, `RoleAssignmentWizard` | **Gabung** dengan `ManageStruktur` → satu destinasi "Struktur & Hirarki" |
| `CatalogReviewPanel` (39 KB) | KOMISI | — (3 tab internal: minat/kampus/gelar) | **Pertahankan** |
| `AccessGroupsPanel`, `ProvisionInviteWizard` | admin shell + portal | `PeopleInvites` | **Pertahankan** (dipakai `#/admin`), tapi jangan tampilkan ganda di portal |

### 4.2 Kegiatan & kalender

| Panel | Peran sekarang | Overlap dengan | Rekomendasi |
|---|---|---|---|
| `IbadahMingguanPanel` (14 KB) → `KegiatanCalendar` (36 KB) | semua | `EventWorkspacePanel→Kalender`, `YouthCalendarPanel` | **Pertahankan** sebagai destinasi "Kegiatan" untuk semua peran |
| `EventInfoPanel` (14 KB) | semua | `IbadahMingguanPanel`, `EventSelfAnswersCard` | **Gabung** ke destinasi "Kegiatan" sebagai sub-tab "Info & Pendaftaran" |
| `YouthCalendarPanel` (3 KB) | via `events`/`dashboard` | `ChurchYearCalendarPanel` (hanya wrapper tipis) | **Gabung** — hapus wrapper, panggil `ChurchYearCalendarPanel` langsung |
| `ChurchCalendarPanel` (15 KB) | via `events→Payung` | `ChurchYearCalendarPanel` | **Pertahankan** tapi beri label jelas ("Program/Payung") agar tidak tertukar dengan kalender gerejawi |
| `ChurchYearCalendarPanel` (17 KB) | via `events→Kalender`, dashboard | `YouthCalendarPanel` | **Pertahankan** |
| `PenatalayanCalendar` (21 KB) | via `groups-monitoring→Jadwal`, divisi | `ServicePlanPanel` | **Pertahankan** (konteks kelompok) |
| `ServicePlanPanel` (55 KB) | via `events→Ibadah` | `IbadahMingguanPanel`, `PenatalayanCalendar` | **Pertahankan**; jelaskan di UI bahwa ini perencanaan rotasi, bukan jadwal harian |
| `ManageActivities` (18 KB) | COMMITTEE | `EventsTimeline` (publik) | **Pertahankan** |

### 4.3 Konten & publikasi

| Panel | Peran sekarang | Overlap dengan | Rekomendasi |
|---|---|---|---|
| `ManageWeeklyInfo` (19 KB) | COMMITTEE | `WartaPublikTab` (26 KB, divisi DIDASKALIA) | **Gabung**: satu alur warta. Rekomendasi: `WartaPublikTab` jadi editor utama (sudah terhubung `ContentItem` saat PUBLISHED), `ManageWeeklyInfo` jadi sub-tab "Arsip/Umum" |
| `WartaPublikTab` + `WartaExportModal` | divisi DIDASKALIA | `ManageWeeklyInfo` | **Pertahankan** |
| `DidaskaliaStudioPanel` (37 KB) | divisi DIDASKALIA | `WartaPublikTab` | **Pertahankan** |
| `ManageTestimonials` (18 KB) | KOMISI (cms) + divisi (curate) | `MenteeKesaksianPanel` | **Pertahankan**; perjelas perbedaan: curate (staf) vs tulis (mentee) |
| `MenteeKesaksianPanel` (6 KB) | MENTEE | `ManageTestimonials` | **Pertahankan** |
| `AnnouncementComposer` (15 KB) | 6 peran | — | **Pertahankan**; pindahkan ke grup Konten |
| `MediaGuidePanel` (17 KB) | KOMISI, COMMITTEE | `ManageIntegrations` (status Drive) | **Gabung** status Drive-nya, atau beri label "Panduan" vs "Integrasi" yang tegas |
| `GroupAlbumsPanel` (16 KB) | via kelompok/divisi | `EventGalleryTab`, `EventArchiveGallery` | **Pertahankan** |
| `ManageChurchInfo` (25 KB) | SUPERADMIN, BPMJ, KOMISI | `ManageIntegrations`, `ManageStruktur` | **Pertahankan** |

### 4.4 Ibadah, pelayanan, doa

| Panel | Peran sekarang | Overlap dengan | Rekomendasi |
|---|---|---|---|
| `PenatalayanRolesEditor` (10 KB) | divisi LITURGIA/MARTURIA | `EventPenatalayanPanel` | **Pertahankan** (komponen vs penugasan) |
| `EventPenatalayanPanel` (18 KB) | via `events` | `PenatalayanRolesEditor`, `PenatalayanCalendar` | **Pertahankan** |
| `PastoralCareBoard` (30 KB) | 5 peran | `KegiatanCalendar` (lapisan Doa) | **Pertahankan**; sembunyikan tab "Laporan" untuk MENTEE |
| `WhatsAppChannelsPanel` (12 KB) | KOMISI, COMMITTEE, BPMJ | `MyChannelsCard`, `WhatsAppJoinCard`, `MenteeWelcomeCard` | **Pertahankan** (admin) — kartu personal tetap read-only |
| `BenzarStoreTab` (22 KB) | divisi BENZARPR | — | **Pertahankan** |

### 4.5 Akun, dashboard, profil

| Panel | Peran sekarang | Overlap dengan | Rekomendasi |
|---|---|---|---|
| `AccountHub` (4 KB) | semua | — | **Pertahankan**; jadikan rumah tunggal `PWASettingsPanel` |
| `MyProfilePanel` (34 KB) | semua | `YouthGEHCList` (edit admin), `ProfileChurchDataRequestPanel` | **Pertahankan**; pastikan staf mengarahkan perubahan ke queue request, bukan edit langsung |
| `ProfileChurchDataRequestPanel` (14 KB) | via profil + jemaat | `MyProfilePanel` | **Pertahankan** |
| `PortalDashboard` (22 KB) | 5 peran | — | **Pertahankan**; tambahkan untuk KOMISI & BPMJ |
| `OnboardingBanner`, `ProfileIncompleteBanner`, `EventProfileCompleteCard`, `ApplyPendingBakutau` | shell/event | saling tumpang tindih (4 prompt) | **Gabung** menjadi 1 "checklist kelengkapan" |
| `MenteeWelcomeCard`, `BakuTauWelcomeCard`, `InvitedWelcomeModal` | dashboard/event/shell | 3 welcome berbeda | **Gabung** menjadi 1 modal selamat datang kontekstual |
| `RolePickerScreen`, `PortalAccountSwitcher`, `AccountRolesSection` | shell/akun | 3 UI ganti peran | **Pertahankan** `PortalAccountSwitcher` + `AccountRolesSection`; `RolePickerScreen` hanya untuk login pertama |

### 4.6 Kerja & sistem

| Panel | Peran sekarang | Overlap dengan | Rekomendasi |
|---|---|---|---|
| `EventWorkspacePanel` (52 KB, 4 sub-tab) | KOMISI, COMMITTEE, BPMJ | `DivisionWorkspacePanel`, `ManageActivities` | **Pertahankan**; pindahkan sub-tab `ibadah` agar tidak duplikat dengan destinasi Kegiatan |
| `DivisionWorkspacePanel` (101 KB, 13 sub-tab) | KOMISI, COMMITTEE | `EventWorkspacePanel`, `EventCheckInTab`, `DidaskaliaStudioPanel` | **Pertahankan**; pecah file (bukan fitur) untuk pemeliharaan |
| `ManageStruktur` (38 KB) | COMMITTEE | `OrgHierarchyPanel` | **Gabung** → "Struktur & Hirarki" |
| `ManageIntegrations` (32 KB) | KOMISI | `MediaGuidePanel` | **Pertahankan** |
| `JethroEngine` (19 KB) + `JethroPlacementReview` (37 KB) + `RegenerationWizard` (29 KB) | KOMISI, BPMJ / +COMMITTEE | 3 pintu untuk domain regenerasi & penempatan | **Gabung** ke destinasi "Regenerasi" dengan 3 sub-tab |

---

## 5. Usulan susunan nav baru per peran

**Prinsip:**

1. **Maksimal 7 destinasi** untuk peran non-staf (MENTEE, MENTOR, CO_MENTOR, ALUMNI); staf inti boleh lebih.
2. Destinasi = **tujuan pengguna**, bukan = komponen. Domain yang sama digabung jadi 1 destinasi + sub-tab.
3. Tulis hanya muncul di destinasi yang memang pekerjaan staf.
4. Dashboard tersedia untuk **semua** peran (kartu personal murah dan relevan).
5. Grup sidebar tetap: **Utama · Komunitas · Konten · Kerja · Sistem**.

### 5.1 Usulan per peran

| Peran | Sekarang | Usulan | Delta |
|---|---|---|---|
| **MENTEE** | 7 | **5**: Beranda · Kegiatan · Kelompok Saya · Doa · Akun | −2 |
| **MENTOR / CO_MENTOR** | 7 | **6**: Beranda · Kegiatan · Kelompok Binaan · Doa · Pengumuman · Akun | −1 |
| **ALUMNI** | 4 | **4**: Beranda · Kegiatan · Info Event · Akun | 0 |
| **COMMITTEE** | 15–16 | **8**: Beranda · Kegiatan · Kelompok & Monitoring · Konten · Divisi & Event · Struktur & Hirarki · Doa · Akun | −8 |
| **BPMJ** | 11 | **8**: Beranda · Orang (Review Penempatan) · Regenerasi · Kelompok · Divisi & Event · Kanal WA · Info Gereja · Akun | −3 |
| **KOMISI** | 21 | **10**: Beranda · **Orang** (Akun & Undangan · Jemaat · Pipeline · Katalog) · Kelompok & Monitoring · **Regenerasi** (Regenerasi · Penempatan · Pemimpin Rumah) · Konten (Warta · Agenda · Testimoni · Media · Pengumuman) · Divisi & Event · Kanal WA · Doa · **Sistem** (Integrasi · Info Gereja · Hirarki) · Akun | −11 |
| **SUPERADMIN** | 26 | **11** (semua destinasi yang sama, hanya disusun ulang; akses penuh dipertahankan) | −15 |

### 5.2 Peta penggabungan (destinasi lama → destinasi baru)

| Destinasi baru | Menampung (sub-tab) |
|---|---|
| **Kegiatan** | Jadwal & Kalender (`IbadahMingguanPanel`/`KegiatanCalendar`) · Info & Pendaftaran (`EventInfoPanel`) |
| **Orang** | Akun & Undangan (`PeopleInvites`) · Jemaat (`YouthGEHCList`) · Pipeline Onboarding (`WaitingPoolPanel`) · Katalog (`CatalogReviewPanel`) |
| **Regenerasi** | Regenerasi & Mitosis (`JethroEngine`) · Review Penempatan (`JethroPlacementReview`) · Pemimpin 10 Rumah (`BeyondersLeadersPanel` + `RegenerationWizard`) |
| **Konten** | Warta (`WartaPublikTab`/`ManageWeeklyInfo`) · Agenda (`ManageActivities`) · Testimoni (`ManageTestimonials`) · Media (`MediaGuidePanel`) · Pengumuman (`AnnouncementComposer`) |
| **Struktur & Hirarki** | Bagan (`ManageStruktur` chart) · Tabel (`ManageStruktur` table) · Hirarki Org (`OrgHierarchyPanel`) |
| **Sistem** | Integrasi Drive (`ManageIntegrations`) · Info Gereja (`ManageChurchInfo`) |
| **Kelompok & Monitoring** | 8 sub-tab yang sudah ada, dengan sub-tab tulis disembunyikan untuk MENTEE/ALUMNI |

**Catatan implementasi:** penggabungan ini **tidak menghapus komponen apa pun** — hanya mengubah cara mereka dipasang (satu destinasi dengan sub-tab, memakai `ScrollTabBar` yang sudah ada). Estimasi: **M** (perlu penyesuaian `portal-nav-config.ts`, `PortalLayout.tsx`, dan uji paritas `docs/tech/nav-api-parity.md` + `tests/e2e/portal-nav-roles.spec.ts`).

---

## 6. Pola akses: read vs write

### 6.1 Distribusi endpoint

| Metode | Jumlah | Catatan |
|---|---|---|
| GET | 183 | mayoritas read |
| POST | 179 | sebagian hanya menghitung/menyiapkan data (mis. `/api/jethro/scan`, `/api/regeneration/preview`) |
| PATCH | 44 | update parsial |
| DELETE | 37 | hapus |
| PUT | 13 | replace penuh |

**Temuan pola:** sebagian POST hanya menghitung atau menyiapkan data tanpa menulis (`POST /api/jethro/scan` — `server/index.mjs:3439`; `POST /api/regeneration/preview` — `:1706`). Ini menyulitkan caching/CDN dan membuat semantik tidak konsisten. **Rekomendasi (P1):** pindahkan operasi baca ke GET dengan query param; sisakan POST untuk aksi yang mengubah state.

### 6.2 Guard yang ada

| Jenis guard | Jumlah | Arti |
|---|---|---|
| `requireRole(peran spesifik)` | 221 | paling ketat |
| `requireRole()` tanpa argumen | 65 | **semua pengguna login** (termasuk MENTEE/ALUMNI) |
| Guard platform (`requirePlatformRoot/Admin`) | 27 | admin platform |
| Tanpa guard middleware | 143 | 63 punya cek inline, **80 tanpa cek** |

`requireRole()` kosong = lolos selama login (`server/auth.mjs:225-236`; `if (roles.length === 0) return next();`).

**Konsekuensi yang perlu ditinjau (P0/P1):** endpoint berikut memakai `requireRole()` kosong sehingga **semua peran login** bisa memanggilnya, lalu difilter di dalam handler. Perlu dipastikan filter internalnya benar-benar menahan peran yang tidak berhak:

- Seluruh `/api/pastoral-care/*` (10 endpoint) — termasuk `POST /pray-bulk` dan `DELETE /:id/pray`.
- `POST /api/portal/ask` (AI assist) — `server/routes/portal-assist.mjs:25`.
- Seluruh `/api/service-swap-requests/*` (4 endpoint).
- `GET /api/warta`, `GET/PATCH/DELETE /api/warta/:id`, `GET/POST/PATCH/DELETE /api/gallery*`, `/api/division-meetings*`, `/api/penatalayan/schedules`, `/api/benzar/orders*`.

Yang sudah terverifikasi **aman** (jangan diubah): `PATCH /api/pastoral-care/:id/resolve` (otorisasi per-baris), `POST /api/titles/suggest`, `/api/institutions/suggest`, `/api/recreational/suggest` (cek `req.authUser` inline).

### 6.3 Tombol tulis pada peran baca

| Lokasi | Kondisi sekarang | Rekomendasi |
|---|---|---|
| `ManageGroupsMonitoring` sub-tab "Form input" | diblokir via `canWriteMonitoring` (`:229`, pesan `:917-924`) — **sudah benar** | Pertahankan pola ini; sembunyikan sub-tab-nya untuk mentee |
| `PastoralCareBoard` tab "Laporan" | semua peran login | Sembunyikan untuk MENTEE; sisakan "Daftar"/"Doa Minggu" |
| `DivisionWorkspacePanel` sub-tab `store`, `checkin`, `studio`, `warta` | tampil berdasarkan **divisi terpilih**, bukan peran | Tambahkan cek peran (staf divisi vs komisi) agar tidak tampil untuk yang tidak bertugas |

---

## 7. P0 — RBAC & keamanan

### 7.1 Endpoint TULIS publik tanpa auth sama sekali

Ketiganya **0 referensi** di `src/` (tidak dipanggil frontend) dan tidak punya cek inline:

| Endpoint | Bukti | Yang dilakukan |
|---|---|---|
| `POST /api/db/sync-batches` | `server/index.mjs:1501` | Upsert batch lalu **menghapus** batch lama |
| `POST /api/migrate/events` | `server/index.mjs:2095` | Menjalankan perintah **DDL/migrasi** per baris |
| `POST /api/seed/events` | `server/index.mjs:2250` | Menanam data event |

**Risiko:** siapa pun di internet bisa memicu penulisan/migrasi tanpa login.

**Snippet usulan (pilih salah satu):**

```js
// Opsi A — kunci total (paling aman, karena 0 referensi di frontend)
import { requireRole } from './auth.mjs';
app.post('/api/db/sync-batches', requireRole('SUPERADMIN'), wrap(async (req, res) => { /* … */ }));

// Opsi B — hapus rute sepenuhnya jika sudah tidak dipakai (lihat Lampiran B)
```

**Effort:** S · **Risiko:** rendah (tidak ada konsumen) · **Butuh izin DB:** tidak.

### 7.2 Endpoint BACA publik yang mengekspos data internal/PII

| Endpoint | Bukti | Data yang keluar | Konsumen | Usulan |
|---|---|---|---|---|
| `GET /api/db/groups/:id/attendance` | `index.mjs:1481` | Nama anggota + nama pencatat + tanggal absensi | Portal saja (`AttendancePanel.tsx:64`, `ManageGroupsMonitoring.tsx:468`) | **`requireRole()`** |
| `GET /api/db/groups/:id/batches` | `index.mjs:1430` | Riwayat batch/generasi | — | **`requireRole()`** |
| `GET /api/groups/:id/mentor-transitions` | `index.mjs:1534` | Riwayat transisi mentor | 0 referensi | **Hapus** atau `requireRole('KOMISI','COMMITTEE','BPMJ')` |
| `GET /api/events/:id/meetings` | `index.mjs:2996` | Notulen & jadwal rapat internal | Portal saja (`EventWorkspacePanel.tsx:341`, `DivisionWorkspacePanel.tsx:655`) | **`requireRole()`** |
| `GET /api/db/groups` | `index.mjs:1401` | **Semua** grup + **semua** anggota (id, avatar, nama) + batch | **Situs publik** (`GroupsCarousel`, `MarqueeStrip`, `GroupDetailPage`) | **Minimisasi field** + endpoint publik ramping terpisah |
| `GET /api/db/groups/:id/members` | `index.mjs:1441` | Semua anggota grup | Publik (`HeritageSection.tsx:45`) | Minimisasi: buang `user.id`, cukup `name` + `batchPeriod` |
| `GET /api/db/struktur` | `index.mjs:3345` | Struktur organisasi | Publik (`AppContext.tsx:326` → `StrukturSection`) | Pertahankan publik, **minimisasi field** (buang email/telepon bila ada) |
| `GET /api/drive/files/:fileId` | `index.mjs:2083` | Metadata file Drive | tidak jelas | Tinjau; pastikan policy Drive benar-benar diterapkan |
| `GET /api/events/:id/penatalayan` | `index.mjs:6866` | Jadwal pelayanan + nama petugas | Publik? | Tinjau apakah memang untuk publik; jika ya, batasi ke status CONFIRMED/DONE |

**Snippet usulan (minimisasi, bukan mengunci — agar halaman publik tetap jalan):**

```js
// SEBELUM — mengirim seluruh relasi
const allGroups = await prisma.group.findMany({
  include: { batches: true, members: { include: { user: { select: { id: true, avatar: true, name: true } } } } },
});

// SESUDAH — publik hanya butuh nama grup + jumlah anggota
const allGroups = await prisma.group.findMany({
  select: { id: true, name: true, _count: { select: { members: true } } },
});
// lalu tambahkan endpoint terpisah yang butuh auth untuk detail lengkap:
app.get('/api/db/groups/full', requireRole(), wrap(/* data lengkap */));
```

**Effort:** M (perlu menyesuaikan konsumen publik) · **Risiko:** sedang (jika salah, halaman publik pecah) · **Butuh izin DB:** tidak.

### 7.3 Lock UI mati

`PortalLayout.tsx:475` menetapkan `const isAllowed = true;` → cabang badge terkunci (`:513-517`, `:545-549`) tidak pernah dijalankan, sehingga UI tidak pernah memberi tahu pengguna bahwa suatu tab tidak untuknya.

**Snippet usulan:**

```tsx
// SESUDAH
const isAllowed = isTabAllowed(item.id); // fungsi sudah tersedia di file yang sama
```

**Effort:** S · **Risiko:** rendah (hanya presentasi) · **Catatan:** ini **bukan** pengganti RBAC server — API tetap harus menahan sendiri (sudah menjadi aturan di `AGENTS.md`).

### 7.4 Prinsip yang perlu ditegaskan

- Nav gating di klien = kosmetik. Setiap endpoint wajib menahan sendiri (`AGENTS.md` sudah menyatakan ini, tetapi 80 endpoint belum mematuhinya).
- `requireRole()` tanpa argumen sebaiknya **dilarang** untuk endpoint tulis; ganti dengan daftar peran eksplisit.

---

## 8. P1 — Efisiensi

### 8.1 Polling

| Lokasi | Interval | Target | Usulan |
|---|---|---|---|
| `PortalLayout.tsx:153` | **30 s** | `GET /api/notifications` | Naikkan ke 2–5 menit, atau ganti ke SSE/WebSocket/push (push sudah tersedia!) |
| `EventCheckInTab.tsx:109` | 8 s | `GET /api/events/{id}/check-ins` | Pertahankan (memang realtime saat hari-H), tapi hentikan saat tab tidak terlihat |
| `MediaGuidePanel.tsx:98` | 5 s | status publish | Pertahankan (berhenti sendiri saat selesai) |
| `useMediaSlots.ts:94` | 60 s | `GET /api/media/slots` | Naikkan ke 5–10 menit (`staleTime` juga) |

### 8.2 Over-fetch di setiap load

`AppProvider` membungkus seluruh aplikasi (`src/App.tsx:153`), sehingga **pengunjung publik** pun memuat:

| Endpoint | Bukti | Ukuran | Usulan |
|---|---|---|---|
| `/api/db/struktur` | `AppContext.tsx:326` | seluruh struktur | Lazy: muat saat `StrukturSection` dirender |
| `/api/content/public` | `AppContext.tsx:347` | seluruh konten publik | Lazy per halaman |
| `/api/db/groups` | `AppContext.tsx:368` | semua grup + semua anggota | Lazy + minimisasi field (lihat 7.2) |
| `/api/media/slots` | `App.tsx:149` | media slots | Pertahankan (dipakai di mana-mana) |

Portal juga selalu memuat `/api/notifications` + `/api/auth/me` + 5 endpoint dashboard tanpa memandang peran (`PortalDashboard`).

**Snippet usulan (lazy hydration):**

```ts
// AppContext: jangan fetch saat boot; sediakan pemuat eksplisit
const loadGroups = useCallback(async () => {
  if (groupsRef.current) return groupsRef.current;
  const r = await fetch('/api/db/groups');
  const d = await r.json();
  groupsRef.current = d.groups || [];
  return groupsRef.current;
}, []);
// komponen yang butuh memanggil loadGroups() di useEffect-nya sendiri
```

**Effort:** M · **Risiko:** sedang (banyak konsumen `AppContext`) · **Butuh izin DB:** tidak.

### 8.3 Duplikasi endpoint (data yang sama, banyak pintu)

| Data | Endpoint | Jumlah pemanggil di `src/` |
|---|---|---|
| Event | `/api/events`, `/api/events/landing`, `/api/events/upcoming`, `/api/events/:slug`, `/api/events/bakutau` | `/api/events` di **7 file** |
| Profil | `/api/me/profile` (GET/PATCH), `/api/auth/me` | **6 file** |
| Grup | `/api/db/groups`, `/api/groups`, `/api/org/nodes`, `/api/org/public-tree` | **5 file** |
| Channel | `/api/channel-links/scoped`, `/api/channel-links` | 3 file |
| Jadwal pelayanan | `/api/db/service-schedule`, `/api/serving-assignments`, `/api/penatalayan/schedules` | 3 file |
| Album grup | `/api/db/groups/:id/albums`, `/api/groups/:id/albums`, `/api/db/group-albums`, `/api/groups/albums` | 4 endpoint |
| Warta | `/api/warta`, `/api/warta/desk`, `/api/media/warta-album` | 3 endpoint |
| Ulang tahun | `/api/portal/birthdays`, `/api/portal/birthdays/upcoming`, `/api/jemaat/birthdays/upcoming` | 3 endpoint |
| BAKU TAU | `/api/events/baku-tau-4-0` dan `/api/events/bakutau` (duplikat persis) | 2 endpoint |

**Effort:** M–L · **Risiko:** sedang (perlu menjaga kompatibilitas).

### 8.4 Payload tanpa paginasi

| Endpoint | Bukti | Usulan |
|---|---|---|
| `GET /api/db/groups` | `index.mjs:1404-1413` | `take`/`skip` + `select` ramping |
| `GET /api/events` | `index.mjs:2347-2350` (include divisions + meetings) | Paginasi + hapus include yang tak perlu di daftar |
| `GET /api/users`, `GET /api/db/users`, `GET /api/jemaat` | `index.mjs:967`, `:4541`, `:5121` | Paginasi server (sebagian sudah punya pager di klien — `ListPager`) |
| `GET /api/db/groups/:id/batches`, `/:id/members`, `/:id/attendance` | `:1433`, `:1444`, `:1492` | `take` + filter tanggal wajib |
| `GET /api/kolom` | `:881` | Kecil, abaikan |
| Export jawaban | `event-questions.mjs:664` (`take: 5000`) | Streaming/CSV bertahap |

### 8.5 N+1 (loop `await` per baris)

15 lokasi terverifikasi — lihat Lampiran C. Yang paling berdampak: `POST /api/db/sync-batches` (`index.mjs:1506-1531`), `POST /api/db/sync-struktur` (`:3381-3402`), izin Drive per file (`drive-ownership.mjs:890`, `:1376`), bulk doa (`pastoral-care.mjs:431-448`), penempatan per user (`beyonders-leaders.mjs:470-477`).

**Snippet usulan (batch alih-alih loop):**

```js
// SEBELUM
for (const [i, m] of list.entries()) {
  await prisma.strukturMember.upsert({ where: { id: m.id }, create: {...}, update: {...} });
}

// SESUDAH — satu transaksi, satu round-trip
await prisma.$transaction(
  list.map((m, i) => prisma.strukturMember.upsert({ where: { id: m.id }, create: {...}, update: {...} }))
);
```

### 8.6 Lapisan data klien

| Fakta | Bukti | Usulan |
|---|---|---|
| Hanya **6 `useQuery`** dan **0 `useMutation`** untuk 94 komponen | `src/hooks/`, `src/app/QueryProvider.tsx` | Adopsi bertahap: mulai dari endpoint yang dipakai banyak panel (`/api/events`, `/api/me/profile`, `/api/db/groups`) |
| **480 `fetch` manual** (61 file portal pakai `useEffect` + `fetch`) | hasil pemindaian | Migrasi bertahap; prioritaskan yang duplikat |
| Default `staleTime` 30 s, `retry` 1, tanpa `gcTime` | `QueryProvider.tsx:4-8` | Set `gcTime` 5–10 menit; naikkan `staleTime` untuk data statis (struktur, katalog) |
| Error sering ditelan (`catch(() => {})`) | 35 lokasi | Minimal `console.warn` + state error agar bisa didiagnosis |

---

## 9. P2 — UX & penyederhanaan

| # | Temuan | Bukti | Usulan |
|---|---|---|---|
| 1 | 4 prompt kelengkapan profil berbeda | `OnboardingBanner`, `ProfileIncompleteBanner`, `EventProfileCompleteCard`, `ApplyPendingBakutau` | Gabung jadi 1 checklist |
| 2 | 3 welcome card/modal | `MenteeWelcomeCard`, `BakuTauWelcomeCard`, `InvitedWelcomeModal` | Gabung, pilih berdasarkan konteks |
| 3 | 3 UI ganti peran | `RolePickerScreen`, `PortalAccountSwitcher`, `AccountRolesSection` | Satu pola saja |
| 4 | 2 CMS warta | `ManageWeeklyInfo` vs `WartaPublikTab` | Satu editor utama (lihat 4.3) |
| 5 | 5 komponen kalender | `ChurchCalendarPanel`, `ChurchYearCalendarPanel`, `YouthCalendarPanel`, `PenatalayanCalendar`, `KegiatanCalendar` | Hapus wrapper `YouthCalendarPanel`, beri label pembeda |
| 6 | 2 wizard regenerasi | `JethroEngine` vs `RegenerationWizard` | Satu pintu (destinasi Regenerasi) |
| 7 | 2 uploader Drive | `DriveUploadButton` vs `DriveUploadPanel` | Satukan |
| 8 | File raksasa | `ManageGroupsMonitoring` 101 KB, `DivisionWorkspacePanel` 101 KB, `YouthGEHCList` 96 KB | Pecah file per sub-tab (tanpa mengubah fitur) |
| 9 | Label `announcements` di posisi terakhir untuk MENTOR | `portal-nav-config.ts:138-140` | Pindahkan ke grup Konten |
| 10 | 2 entri override mati (`dashboard` untuk KOMISI & BPMJ) | `portal-nav-config.ts:94`, `:99` | Hapus atau aktifkan dashboardnya |
| 11 | `kesaksian` (MENTEE) vs `content-testimonials` (KOMISI) bisa tertukar | label mirip | Perjelas: "Tulis Kesaksian" vs "Kelola Testimoni" |
| 12 | Halaman "Info Event" terasa duplikat "Kegiatan" bagi pengguna biasa | `event-info` + `kegiatan` sama-sama untuk semua peran | Gabung (bagian 5) |

---

## 10. Konsolidasi endpoint konkret

| Kebutuhan | Endpoint sekarang | Usulan | Catatan kompatibilitas |
|---|---|---|---|
| Detail grup (publik) | `GET /api/db/groups` (lengkap) | `GET /api/db/groups` (ramping) + `GET /api/db/groups/full` (auth) | Perbarui `AppContext`, `GroupsCarousel`, `GroupDetailPage` |
| Anggota grup | `GET /api/db/groups/:id/members` + `/api/portal/groups/:id/roster` + `/api/groups/:id/albums`-family | Sisakan 2: publik (tanpa nomor) & portal (dengan nomor, auth) | Roster sudah punya aturan privasi — jadikan satu-satunya jalur detail |
| Daftar event | `/api/events`, `/api/events/landing`, `/api/events/upcoming` | `/api/events?scope=public` (publik) & `?scope=portal` (portal) + `&limit=` | Pertahankan alias lama 1 rilis |
| Ulang tahun | 3 endpoint | `GET /api/birthdays?scope=` | — |
| Album grup | 4 endpoint | 2: publik (`/api/db/groups/:id/albums`) & portal (`/api/groups/:id/albums`) | — |
| Warta | `/api/warta`, `/api/warta/desk` | `/api/warta?view=desk` (desk) & `/api/warta` (daftar) | — |
| BAKU TAU | `/api/events/baku-tau-4-0` & `/api/events/bakutau` | Sisakan satu (alias) | Duplikat persis |
| Tulis batch | `sync-batches` (publik) | Hapus (0 referensi) | — |

---

## 11. Roadmap & checklist

### 11.1 P0 — Keamanan (kerjakan lebih dulu)

| # | Item | Dampak | Effort | Risiko | Izin DB | Bukti |
|---|---|---|---|---|---|---|
| P0-1 | [ ] Kunci/hapus `POST /api/db/sync-batches`, `/api/migrate/events`, `/api/seed/events` | Kritis | S | Rendah | Tidak | `index.mjs:1501/2095/2250` |
| P0-2 | [ ] `requireRole()` pada `/api/db/groups/:id/attendance`, `/:id/batches`, `/api/events/:id/meetings` | Tinggi | S | Rendah | Tidak | `index.mjs:1481/1430/2996` |
| P0-3 | [ ] Hapus/kunci `/api/groups/:id/mentor-transitions` (0 referensi) | Tinggi | S | Rendah | Tidak | `index.mjs:1534` |
| P0-4 | [ ] Minimisasi field `/api/db/groups` + `/api/db/groups/:id/members`; tambah endpoint auth untuk detail | Tinggi | M | Sedang | Tidak | `index.mjs:1401/1441` |
| P0-5 | [ ] Tinjau `/api/events/:id/penatalayan` & `/api/drive/files/:fileId` (memang publik?) | Sedang | S | Rendah | Tidak | `index.mjs:6866/2083` |
| P0-6 | [ ] Perbaiki lock UI (`isAllowed = true`) | Sedang | S | Rendah | Tidak | `PortalLayout.tsx:475` |
| P0-7 | [ ] Ganti `requireRole()` kosong → daftar peran eksplisit pada endpoint tulis (`pastoral-care/pray-bulk`, `service-swap-requests`, `gallery` write) | Tinggi | M | Sedang | Tidak | bagian 6.2 |

### 11.2 P1 — Efisiensi

| # | Item | Dampak | Effort | Risiko | Izin DB |
|---|---|---|---|---|---|
| P1-1 | [ ] Polling notifikasi 30 s → 2–5 menit atau push | Sedang | S | Rendah | Tidak |
| P1-2 | [ ] Lazy-load `/api/db/struktur`, `/api/content/public`, `/api/db/groups` dari `AppContext` | Tinggi | M | Sedang | Tidak |
| P1-3 | [ ] Paginasi `/api/db/groups`, `/api/events`, `/api/users`, `/api/db/users`, `/api/jemaat` | Tinggi | M | Sedang | Tidak |
| P1-4 | [ ] Hilangkan N+1 prioritas (sync-batches, sync-struktur, izin Drive, bulk doa, penempatan) | Sedang | M | Sedang | Tidak |
| P1-5 | [ ] Pindahkan operasi baca ber-POST ke GET | Sedang | M | Rendah | Tidak |
| P1-6 | [ ] Adopsi react-query untuk 3 endpoint paling duplikat + `useMutation` | Sedang | M | Sedang | Tidak |
| P1-7 | [ ] Konsolidasi endpoint duplikat (bagian 10) | Sedang | M–L | Sedang | Tidak |

### 11.3 P2 — UX & penyederhanaan

| # | Item | Dampak | Effort | Risiko | Izin DB |
|---|---|---|---|---|---|
| P2-1 | [ ] Terapkan susunan nav baru per peran (bagian 5) | Tinggi | M | Sedang | Tidak |
| P2-2 | [ ] Gabung 4 prompt kelengkapan → 1 checklist | Sedang | S | Rendah | Tidak |
| P2-3 | [ ] Gabung 3 welcome card → 1 modal kontekstual | Rendah | S | Rendah | Tidak |
| P2-4 | [ ] Satukan alur warta (1 editor utama) | Sedang | M | Sedang | Tidak |
| P2-5 | [ ] Hapus wrapper `YouthCalendarPanel`; beri label pembeda kalender | Sedang | S | Rendah | Tidak |
| P2-6 | [ ] Pecah 3 file > 90 KB per sub-tab | Sedang | M | Rendah | Tidak |
| P2-7 | [ ] Beri Dashboard untuk KOMISI & BPMJ; hapus entri override mati | Sedang | S | Rendah | Tidak |

### 11.4 Quick wins (bisa hari ini, dengan snippet)

1. **P0-1** — snippet di 7.1 (`requireRole('SUPERADMIN')` atau hapus rute).
2. **P0-2/P0-3** — tambahkan `requireRole()` pada 4 endpoint baca internal.
3. **P0-6** — satu baris: `const isAllowed = isTabAllowed(item.id);`
4. **P1-1** — satu baris: `setInterval(fetchNotifications, 180000);` (30 s → 3 menit).
5. **P2-7** — tambahkan `'dashboard'` ke `roles` untuk KOMISI/BPMJ (`portal-nav-config.ts:31`), lalu hapus entri override yang mati.

---

## 12. Lampiran A — endpoint publik tanpa guard

**A.1 Memang publik (biarkan):** `/api/auth/config`, `/api/wilayah/*`, `/api/auth/google`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/claim`, `/api/auth/local`, `/api/join`, `/api/join/local`, `/api/register/*`, `/api/waitlist*` (token), `/api/events/landing`, `/api/events/:slug`, `/api/events/upcoming`, `/api/events/public-archive`, `/api/church-calendar/public`, `/api/content/public`, `/api/gallery/public`, `/api/media/landing`, `/api/media/slots`, `/api/media/user-avatar/:userId`, `/api/media/warta-album`, `/api/testimonials/public`, `/api/db/service-schedule`, `/api/db/group-albums`, `/api/db/groups/:id/albums`, `/api/health`, `/api/version`, `/api/benzar/products*`, `/api/benzar/qris`, `/api/penatalayan/roles`, `/api/org/public-tree`, `/api/tenants*`, `/api/church-profile`, `/api/events/baku-tau-4-0*`, `/api/db/struktur`, `/api/drive/files`, `/api/drive/file/:id/content`, OAuth redirect, `/api/operator/auth/*`, `/api/platform/context`, cron (dengan `CRON_SECRET`).

**A.2 Perlu ditinjau:** `/api/db/groups`, `/api/db/groups/:id/members`, `/api/db/groups/:id/batches`, `/api/db/groups/:id/attendance`, `/api/groups/:id/mentor-transitions`, `/api/events/:id/meetings`, `/api/events/:id/penatalayan`, `/api/drive/files/:fileId`, `/api/events/baku-tau-4-0/stats`.

**A.3 Berbahaya (tulis tanpa auth):** `POST /api/db/sync-batches`, `POST /api/migrate/events`, `POST /api/seed/events`.

---

## 13. Lampiran B — endpoint 0 referensi di `src/` (kandidat arsip)

> Sebelum menghapus, jalankan ulang pencarian (path bisa dibentuk dinamis) dan pastikan tidak dipakai skrip/cron di luar `src/`.

`POST /api/admin/clean-staging` · `POST /api/didaskalia/rhb/upload` · `POST /api/didaskalia/studio/:ym/:wk/draft` · `POST /api/didaskalia/studio/:ym/:wk/sermon` · `POST /api/drive/ops/upload` · `PATCH /api/groups/:id/albums/:albumId/status` · `GET /api/benzar/orders/:id/files` · `POST /api/event-questions/requests/:id/approve|reject` · `GET /api/pending-approval` · `POST /api/waiting-pool/reset-status` · `POST /api/waiting-pool/clear-role-assigned` · `DELETE /api/org/assignments/:id` · `POST /api/institutions/remind` · `GET /api/auth/admin-check` · `GET /api/events/:eventId/analytics` · `GET /api/events/:eventId/divisions/:div/analytics` · `GET /api/drive/group-files/:groupName` · `GET /api/drive/test` · `GET /api/drive/policy` · `GET /api/db/status` · `POST /api/db/sync-batches` · `/api/groups/:id/mentor-transitions*` · `POST /api/regeneration/preview|apply` · `DELETE /api/drive/files/:fileId` · `GET /api/drive/files/:fileId` · `POST /api/migrate/events` · `POST /api/seed/events` · `PATCH /api/jethro/member/:id/role` · `POST /api/waitlist/:id/assign` · `GET /api/events/upcoming` · `POST /api/recreational/remind` · `GET /api/jemaat/birthdays/upcoming` · `POST /api/admin/users/:id/unlink` · `DELETE /api/admin/access-groups/members/:memberId` · `GET /api/users/:id/roles` · `POST /api/role-assignments/cleanup-duplicates` · `POST /api/role-assignments/bulk-delete` · `POST /api/admin/seed-gifts` · `GET /api/benzar/orders/my` · `POST /api/push/subscribe` · `POST /api/paw/send` · `GET /api/events/:slug/attendees` · `POST /api/events/:slug/register-auth`

Catatan: `/api/drive/*` sebagian dipanggil lewat `src/services/driveApi.ts` (prefiks `API_BASE`), jadi **bukan** 0-referensi sebenarnya — verifikasi manual wajib.

---

## 14. Lampiran C — lokasi N+1

| Lokasi | Pola |
|---|---|
| `server/index.mjs:949-958` | `users.map(async (u) => prisma.strukturMember.findFirst(...))` |
| `server/index.mjs:1232-1242` | per folder Drive: `await getFolderChain()` + `await resolveAccess()` |
| `server/index.mjs:1506-1531` | `for (const b of batches) await prisma.groupBatch.upsert(...)` |
| `server/index.mjs:3381-3402` | `for (const [i, m] of list.entries()) await prisma.strukturMember.upsert(...)` |
| `server/routes/events-public.mjs:89-99` | `Promise.all(evs.map(async e => eventSignupStats(...)))` — 1 query per event |
| `server/routes/content-public.mjs:221-226` | `Promise.all(foldersToLoad.map(async f => listFiles(f)))` |
| `server/routes/pastoral-care.mjs:431-448` | loop `canSeeNote()` + `create()` lalu loop `recomputePrayerSummary()` |
| `server/routes/beyonders-leaders.mjs:425-428` | `for (const gid of groupIds) await prisma.groupBatch.findFirst(...)` |
| `server/routes/beyonders-leaders.mjs:470-477` | `for (const userId of userIds) await placePerson(...)` |
| `server/routes/drive-ownership.mjs:890`, `:1376` | `for (const id of ids) await setPublicReader(drive, id)` |
| `server/routes/notif-cron.mjs:72,153,218` | per 100 user: `createMany` + `pushToUsers` |
| `server/routes/serving-assignments.mjs:149,315` | loop `servingSundays` dengan await |
| `server/routes/serving-cycle.mjs:85,146,154,181` | loop perubahan/pair dengan await |
| `server/routes/ministry-plans.mjs:417,463,559` | loop bertingkat minggu/kandidat |
| `server/routes/church-calendar.mjs:290,301` | loop tugas/bulan |

---

## 15. Lampiran D — catatan verifikasi

- **Sudah diverifikasi manual (baris kode):** seluruh item P0 (7.1–7.3), angka guard (`server/auth.mjs:225-236`), default react-query (`QueryProvider.tsx:4-8`), polling (`PortalLayout.tsx:153`), jumlah nav & peran (`portal-nav-config.ts`), dan konsumen publik `/api/db/groups`, `/api/db/struktur`, `/api/db/groups/:id/members`, `/api/db/groups/:id/attendance`, `/api/events/:id/meetings`.
- **Dibuang dari daftar temuan** karena ternyata sudah aman: `POST /api/titles/suggest` (`title-catalog.mjs:132-133`), `POST /api/institutions/suggest` (`index.mjs:752-753`), `POST /api/recreational/suggest` (`index.mjs:4930-4931`), `PATCH /api/pastoral-care/:id/resolve` (`pastoral-care.mjs:325-336`).
- **Belum diverifikasi runtime:** dampak nyata polling/over-fetch di produksi, dan apakah ada skrip eksternal yang memakai endpoint Lampiran B.
- **Tidak ada** perubahan kode/DB dalam penyusunan dokumen ini.
