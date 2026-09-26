# Portal Jemaat GMIM Eben Haezer Cikarang (GEHC.page)

> Desain besar pengembangan `gehc.page` dari portal pemuda menjadi **portal jemaat**.
> Status: **P0 sedang dibangun** · Pemilik: BPMJ / Tim Tech.

---

## 1. Tujuan & ruang lingkup

Mengembangkan `gehc.page` menjadi portal jemaat yang menaungi:

- **Ibadah & acara** jemaat + **warta**.
- **Unit pelayanan**: BPMJ + 4 unit (Departemen Pembangunan, THL, Tim Tech, Panji Yosua) + Pelsis BIPRA & Kolom.
- **Fasilitas & penyewaan** bangunan/ruang (Departemen Pembangunan).
- **Keuangan satu pintu** (Bendahara).
- **Benzarpreneurship (BZP)** di bawah Bendahara; PIC pemuda tetap.

**Non-tujuan (fase ini):** subdomain/tenant baru; pembukuan double-entry; pembayaran online penyewaan.

---

## 2. Prinsip

1. **Satu ruang, bertingkat** — hub `gehc.page` → `#/portal/<ns>` (ns = `bpmj` · `komisi` · `committee` · `superadmin`). Youth tetap `youth.gehc.page`.
2. **RBAC berbasis divisi** — unit & posisi disimpan di `StrukturMember.division` + `.position`; **tanpa menambah enum `Role`**.
3. **Keuangan satu pintu** — Bendahara sebagai hub dana; BZP mesin pemasukan; hasil distribusi ke unit yang butuh.
4. **Guard server** — `requireChurchUnit(code)` + `isBendahara()`; UI hanya lapisan tampilan (tidak boleh jadi satu-satunya penjaga).
5. **Non-destruktif** — migrasi idempotent; tidak menghapus data lama.

---

## 3. Struktur organisasi (target)

```
BPMJ — Ketua · Sekretaris · Bendahara
├─ Pelsis BIPRA (Men · Women · Youth · Teen · Kids)
├─ Kolom (teritorial)
├─ Departemen Pembangunan — Ketua · Bendahara · Kostor · Asisten Kostor
│    sub: Fasilitas & Penyewaan · Pemeliharaan
├─ THL (Tim Harmoni Liturgi) — Ketua · Koordinator
│    sub: Stewardship (penatalayanan jemaat) · MDS (Multimedia, Dokumentasi, Sound)
├─ Tim Tech — Ketua · Koordinator
│    sub: Web & Sistem · Operasional & Administrasi
├─ Panji Yosua — Ketua · Koordinator
│    sub: Keamanan Event · Penjagaan Rutin
└─ Benzarpreneurship (BZP) → di bawah Bendahara (PIC pemuda tetap)
```

Kode unit: `PEMBANGUNAN`, `THL`, `TECHTEAM`, `PANJI` — katalog di `src/lib/church-org.ts`.

---

## 4. Matriks RBAC ringkas

| Modul | BPMJ | Bendahara | Pembangunan | THL | Tim Tech | Panji | Komisi/Committee |
|---|---|---|---|---|---|---|---|
| Unit & Struktur | kelola | lihat | kelola unitnya | kelola unitnya | kelola | kelola unitnya | lihat |
| Fasilitas & Booking | setujui/laporan | lihat + invoice | kelola + setujui | — | — | — | lihat |
| Keuangan | lihat + setujui | **kelola** | ajukan | ajukan | ajukan | ajukan | lihat ringkas |
| BZP | lihat | **kelola** | — | — | — | — | lihat |
| Stewardship / MDS | lihat | — | — | **kelola** | — | — | lihat |
| Keamanan | lihat | — | — | — | — | **kelola** | lihat |

---

## 5. Model data

### P0 — tanpa tabel baru
Memakai `StrukturMember` (`division`, `subdivision`, `position`, `isOpenRole`), `OrgNode`/`OrgAssignment`, dan `RoleAssignment`.

### P1 — Fasilitas & Keuangan

- **`Facility`** — `id, code, name, kind(GEDUNG|RUANG|ALAT), capacity?, location?, hourlyRate?, dailyRate?, isActive, notes`
- **`FacilityBooking`** — `facilityId, title, purpose, unit, requesterUserId, contactPhone?, startAt, endAt, status(DRAFT|SUBMITTED|APPROVED|REJECTED|DONE|CANCELLED), rateAmount, invoiceNo?, invoiceIssuedAt?, paidAt?, paidAmount?, approverId?, approvedAt?, rejectReason?, notes`
- **`MaintenanceLog`** — `facilityId?, title, description, vendor?, costAmount, spentAt, unit, driveFolderId?`
- **`CashAccount`** — `code, name, unit, kind(KAS_GEREJA|KAS_UNIT|PETTY_CASH), openingBalance, isActive`
- **`CashTransaction`** — `accountId, direction(IN|OUT), amount, category, unit?, refType?(BOOKING|BZP_SALE|FUNDING|MANUAL), refId?, description, occurredAt, createdById, approvedById?, approvedAt?, proofFileId?`
- **`FundingRequest`** — `unit, title, description, amount, neededBy?, status(SUBMITTED|APPROVED|REJECTED|DISBURSED|SETTLED), requesterUserId, approverUserId?, approvedAt?, rejectReason?, disbursedAt?, accountId?, settleNote?`
- **`Distribution`** — `sourceType(BZP_CAMPAIGN|BZP_SALES|DONATION|OTHER), sourceRef?, targetUnit, amount, status(PROPOSED|APPROVED|PAID), decidedByUserId, decidedAt, note`

### P2 — BZP di bawah Bendahara
`BzpSetting.pettyCashAllowanceAccountId?`; `Campaign.fundingRequestId?`; alur campaign → `FundingRequest` → penjualan → `Distribution` ke unit.

### P3 — THL (Stewardship + MDS)
`ServiceRole.scope(UNIT|CHURCH)` (+ division `THL_STEWARDSHIP` / `THL_MDS`); kalender petugas jemaat; MDS memakai ulang galeri/Drive.

### P4 — Panji Yosua + Kategorial/Kolom
`IncidentLog`; pos jaga (`ServiceSchedule` role `PANJI_*`); pengelolaan `Kolom`; dasbor BPMJ lintas unit.

---

## 5b. Fase portal per-domain (F1–F3)

Selain fase P0–P4 di atas (modul jemaat), ada jalur **portal per domain** agar tiap
subdomain punya portalnya sendiri:

- **F1** ✓ — profil portal + tag nav (`portals[]`): hub `gehc.page` = Portal **Jemaat**; `youth` = Portal **Pemuda**; override `?portal=` hanya di host tak dikenal.
- **F2** (nanti) — pindahkan modul jemaat ke slot portal Jemaat + pintasan.
- **F3.1** ✓ — **aktivasi host**: `tenant-jemaat`, semua unit URL langsung membuka portalnya, tenant & branding dari host, hub tetap landing.
- **F3.2** ✓ — **identitas ter-scope**: `req.activeTenantId` dari host; `req.authUser.roles` difilter per tenant (peran jemaat lintas unit: BPMJ/Bendahara/SUPERADMIN); `rolesAll` untuk role picker; `server/lib/tenant-roles.mjs`. Fallback longgar sementara sampai F3.3.
- **F3.3** ✓ — **migrasi peran per BIPRA**: peran jemaat (SUPERADMIN/BPMJ) → `tenant-jemaat`; peran unit-lead (KOMISI/COMMITTEE/ALUMNI) digandakan ke tenant `User.bipra`; MENTOR/CO_MENTOR/MENTEE tetap Pemuda. Scoping peran **ketat** (fallback longgar dihapus). `server/_migrate-roles-per-tenant.cjs`, `server/lib/tenant-map.mjs`.
- **F3.4** ✓ — **data ter-scope**: `tenantScope` (`server/lib/tenant-scope.mjs`); unit → `tenantId IN (unit, jemaat)`; jemaat → semua. Daftar difilter, detail per-id dibiarkan. Tabel diterapkan: `EventProgram`, `ChurchCalendarEntry`, `ChurchProgram`, `ContentItem`, `Testimonial` (Group/UserRole = domain Pemuda).
- **F3.5** — **modul khas unit** (Kaum Bapa/Ibu, Anak, Kolom).

Keputusan: keanggotaan via **BIPRA** (PEMUDA→youth, BAPAK→men, IBU→women, REMAJA→teen, ANAK→kids; Kolom→districts); peran **bertingkat per jenis unit**; **BPMJ/Bendahara/SUPERADMIN lintas unit**.

---

## 6. Permukaan API (rencana)

- **P0**: `GET /api/church/org`, `GET /api/me/church-units`.
- **P1**: `/api/church/facilities`, `/api/church/bookings`, `/api/church/maintenance`, `/api/church/cash/accounts`, `/api/church/cash/transactions`, `/api/church/funding`, `/api/church/distributions`.
- **P2–P4**: `/api/church/bzp/*`, `/api/church/mds/*`, `/api/church/security/*`.

---

## 7. Navigasi & halaman

Grup sidebar **"Jemaat"**:

| Tab | Isi | Visibilitas |
|---|---|---|
| `church-org` | Unit & Struktur Jemaat | BPMJ, Tim Tech, semua unit (lihat) |
| `church-facilities` | Fasilitas & Penyewaan | Pembangunan, Bendahara, BPMJ |
| `church-finance` | Keuangan (kas, transaksi, pengajuan, distribusi) | Bendahara, BPMJ |
| `church-stewardship` | Stewardship Jemaat | THL |
| `church-mds` | MDS (media/arsip) | THL |
| `church-security` | Keamanan | Panji |
| `church-districts` | Kategorial & Kolom | BPMJ, Komisi |
| `church-reports` | Laporan lintas unit | BPMJ |

Visibilitas per unit/posisi via hook `useMyChurchUnits`.

---

## 8. Drive & notifikasi

- Folder Drive bertag unit: `Pembangunan [UNIT]`, `THL [UNIT]`, `Tech [UNIT]`, `Panji [UNIT]`, `Keuangan [PRIVAT]`.
- Notifikasi push per unit/posisi (mis. pengajuan dana, booking disetujui, jadwal petugas) + ringkasan ke BPMJ.

---

## 9. Fase

| Fase | Isi | Catatan |
|---|---|---|
| **P0** | Fondasi: katalog unit + guard + nav/shell + seed posisi | tanpa migrasi |
| **P1** | Fasilitas & Penyewaan + Keuangan (cashbook) | migrasi baru |
| **P2** | BZP → Bendahara + sinergi dana event | ubah guard |
| **P3** | THL (Stewardship + MDS) | perluas ServiceRole |
| **P4** | Panji Yosua + Kategorial/Kolom + Laporan | migrasi baru |

Tiap fase: migrasi idempotent, seed per-env, `lint/test/build`, verifikasi staging → prod, update `HANDOFF.md`.

---

## 10. Risiko

- **P2 mengubah guard BZP** — usul: Bendahara + BPMJ + KOMISI; PIC pemuda tetap.
- **Data nyata dibutuhkan** sebelum go-live: daftar **Kolom**, nama pengurus unit, tarif sewa fasilitas, WA PIC, batas petty cash.

---

## 11. Data yang diperlukan dari pengurus

1. Daftar **Kolom** (nomor, nama, wilayah).
2. Nama pejabat per unit (Ketua/Bendahara/Kostor/Asisten Kostor; THL; Tim Tech; Panji Yosua).
3. Perkiraan **tarif sewa** ruang/gedung & jenis fasilitas yang disewakan.
4. Default tarif/petty cash (mis. batas petty cash pemuda).
