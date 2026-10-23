# Panel BOD Youth (Tim Kerja)

Satu pintu masuk mobile-first untuk **BOD Tim Kerja Youth** + **SUPERADMIN** di portal Pemuda (`youth.gehc.page`). Divisi (HOD/anggota) **tidak** melihat panel ini.

## Pemetaan fitur → tab Panel BOD

| Tab baru | Fitur | Lokasi lama | API / komponen |
|----------|--------|-------------|------------------|
| **Penatalayan** | Buat/salin tautan BOD per event, status slot per role, assign & minta divisi | Tab event → Penatalayan (`EventPenatalayanPanel`), nav **Tautan Penatalayan** (`PenatalayanBodLinkPanel`) | `POST /api/penatalayan/bod-links`, `GET …/token/:token`, assign, request-division |
| **Antrean Divisi** | Antrean request PENDING lintas divisi, papan jadwal | **Penatalayan** board di monitoring / koordinator | `GET /api/penatalayan/requests`, `GET /api/penatalayan/board`, `GET …/division-inbox` |
| **Caption WA** | Caption penatalayan: header Tuan Rumah + Penanggung Jawab, dua tautan absolut (`&domain=HOST` / `&domain=RESPONSIBLE`), daftar peran per domain, link Kotak Masuk Divisi | Tab Caption / event penatalayan | `GET /api/penatalayan/bod-links/token/:token/caption` → `{ caption, links }` |
| **Rundown Penuh** | Rundown pola ibadah semua divisi (BOD-only di Pemuda) | **Pola & Sesi** Didaskalia → katalog; `WorshipPatternCatalog` + `canViewFullWorshipRundown` | Pola pekan / `WorshipPatternCatalog` |
| **Sesi Hari-H** | Briefing (pencatat, undian urutan), kontrol Creative Lab / Didaskalia | **Pola & Sesi** → sub-tab Kontrol (`MentoringControl`), layar briefing di `MentoringScreen` | Sesi mentoring + `ControlRoomPanel` agregator |

## Fitur BOD terkait (tetap di luar panel, atau link dari panel)

| Fitur | RBAC / cek | Lokasi saat ini |
|--------|------------|-----------------|
| Tema & generate rencana ibadah | `isBodTimkerja` + Komisi + Didaskalia | `ServicePlanPanel` |
| Grup WA minggu serving | `isBodTimkerja` | `ServingWeekChannelCard` |
| Kanal WA BOD | `COMMITTEE` + `isBodTimkerja` | nav `wa-channels` |
| Approval swap penatalayan | `isServiceApprover` (BOD + HOD + Didaskalia) | alur request penatalayan |
| Siklus serving (urutan) | BOD / Komisi / Superadmin | `serving-cycle` API |
| Rundown filter divisi | Non-BOD hanya baris divisinya | `filterRundownPhases` |
| Ruang kontrol agregat hari-H | read-only lintas divisi | `ControlRoomPanel` di workspace event |

## Navigasi & redirect

- Nav baru: **`panel-bod`** — *Panel BOD* (Youth only).
- **Tautan Penatalayan** (`penatalayan-tautan`): BOD Tim Kerja + SUPERADMIN diarahkan ke **Panel BOD → tab Penatalayan** (query `token` dipertahankan).
- Mentor/co-mentor tetap memakai **Tautan Penatalayan** langsung.
- Satu token per event; query **`domain=HOST`** atau **`domain=RESPONSIBLE`** memfilter slot di halaman tautan. Mentor grup host hanya mengisi peran Koinonia/Diakonia; mentor penanggung hanya Liturgia/Didaskalia/Marturia. SUPERADMIN / BOD tetap akses penuh.

## Rotasi & sinkron (Ibadah Mingguan)

- Pasangan grup diturunkan dari **`resolveServingPairForWeek`** (panel event, routing, caption, tautan BOD).
- Selisih `cycle_index` pada baris future (bukan swap) **diselaraskan otomatis** saat `GET /api/serving-assignments` + audit `SERVING_CYCLE_INDEX_AUTO_HEAL`.
- Badge **perlu sinkron** hanya untuk: **GESER** belum dipindah, **tukar** antar-grup, atau idx GESER yang masih salah setelah pindah. Rebase manual memakai `buildExpectedCycleIndexMap` (GESER mengonsumsi slot; LIBUR/ALIH/GABUNGAN tidak).

## Akses

- `canAccessYouthBodPanel`: portal `youth` + (`isBodTimkerja` atau `SUPERADMIN` / email `SUPERADMIN_EMAILS`).
- Server: endpoint tautan BOD tetap memakai `canManageBodLink` / `isPenatalayanSuperadmin` (branch RBAC).

## Tab final (rilis episode ini)

1. Penatalayan  
2. Antrean Divisi  
3. Caption WA  
4. Rundown Penuh  
5. Sesi Hari-H  
