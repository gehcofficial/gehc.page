# Database Migrations — GEHC.page (TiDB + Prisma)

GEHC memakai **dua jalur migrasi** yang saling melengkapi:

| Jalur | Kapan dipakai | Perintah |
|-------|---------------|----------|
| **CJS idempotent** (disarankan lokal) | Setelah clone, pull, atau error "column does not exist" | `npm run db:migrate:local` |
| **Prisma migrate deploy** | Staging/prod dengan riwayat `_prisma_migrations` lengkap | `npm run db:migrate:staging` / `db:migrate:prod` |

`db:migrate:local` / `:staging` / `:prod` **tidak boleh** `DROP TABLE`. Khusus `platform_operators`: hanya buat tabel jika belum ada + `ALTER` kolom baru. Akun break-glass (`superadmin@gehc.page`, `admin@gehc.page`) tidak ikut seed/rotate. Setelah migrate: `npm run operator:ensure:prod` (buat jika hilang, tidak ganti password). File Prisma `17_platform_operators` historis masih berisi DROP — **jangan dijalankan ulang**; CJS sudah tidak membaca file itu.

Untuk menyamakan **seluruh** tabel/kolom cluster prod dengan branch staging (tanpa hapus data): `npm run db:schema:sync-from-staging` (dry-run) lalu `:apply`.

> **Jangan** jalankan `npm run db:migrate` (`prisma migrate deploy`) pada database lokal yang sudah ada tapi belum pernah di-baseline — bisa bentrok dengan migrasi `0_init`.

---

## Quick start (developer lokal)

```powershell
npm install
# salin .env dari .env.example atau npm run env:sync

npm run db:migrate:local   # sinkronkan kolom/tabel wajib
npm run dev:all
```

`dev:all` akan memperingatkan jika schema belum sinkron.

---

## Perintah

| Perintah | Fungsi |
|----------|--------|
| `npm run db:migrate:local` | Jalankan semua `server/_migrate-*.cjs` + `prisma generate` |
| `npm run db:migrate:local:staging` | Sama, pakai `.env.staging` |
| `npm run db:migrate:local:prod` | Sama, pakai `.env.production` |
| `npm run db:schema:check` | Cek read-only — kolom/tabel wajib ada? |
| `npm run db:schema:check:prod` | Sama, pakai `.env.production` |
| `npm run db:migrate:profile` | Hanya profil fase 1 (`major_other`, dll.) |
| `npm run db:migrate:church-request` | Tabel permintaan ubah data gereja |
| `npm run db:migrate:placement` | Jethro placement (opsional; bisa gagal FK di DB lama) |
| `npm run db:migrate:birth-date` | Kolom `users.birth_date` |
| `npm run db:migrate:church-calendar` | Tabel `church_calendar_entries` |
| `npm run db:migrate:event-venue` | Venue & `event_date` EventProgram + koreksi zona waktu BAKU TAU |
| `npm run db:migrate:local` | Termasuk `_migrate-event-questions.cjs` — bank soal event |
| `npm run db:migrate:staging` | Prisma deploy ke staging (**bukan** pengganti local) |
| `npm run db:migrate:prod` | Prisma deploy ke produksi — **hanya dengan persetujuan eksplisit** |

---

## Urutan migrasi lokal (`db:migrate:local`)

1. `_migrate-profile-phase1.cjs` — `work_industry`, `work_role`, `major_other`, `recreational_suggestions`
2. `_migrate-profile-church-request.cjs` — `profile_church_data_requests`
3. `_migrate-jethro-placement.cjs` — placement batches *(opsional)*
4. `_migrate-birth-date.cjs` — `users.birth_date`
5. `_migrate-org-hierarchy.cjs` — org tree + `membership_kind`
6. `_migrate-waiting-pool.cjs` — tabel `waiting_pool` (onboarding pipeline)
7. `_migrate-e10-bakutau.cjs` — domisili, `whatsapp_group_url`, `claim_token`
8. `_migrate-bakutau-venue.cjs` — patch lokasi BAKU TAU di `content_items`
9. `_migrate-user-avatars.cjs` — avatar + `struktur_members.user_id`
10. `_migrate-struktur-multirole.cjs` — `struktur_members.role` / `role_order` / `group_id`
11. `_migrate-role-assigned-notif.cjs` — enum `notifications.type` + `ROLE_ASSIGNED`
12. `_migrate-event-questions.cjs` — bank soal event, assignment, jawaban

Scripts tambahan:

| Script | Fungsi |
|--------|--------|
| `npm run db:migrate:org-hierarchy` | Org nodes saja |
| `npm run db:migrate:e10-bakutau` | Kolom BAKU TAU / domisili |
| `npm run db:seed:org-tree` | Seed pohon CHURCH + BIPRA + YOUTH + KOLOM (BPMJ ke Jemaat) |
| `npm run db:seed:org-tree:staging` | Sama ke staging |
| `npm run db:seed:org-tree:prod` | Sama ke prod (BPMJ ke Jemaat + BIPRA) |
| `npm run db:seed:beyonders-houses:staging` | 10 rumah Beyonders kosong ke staging |
| `npm run db:seed:beyonders-houses:prod` | 10 rumah Beyonders kosong (tanpa anggota) |
| `npm run db:schema:check:staging` | Cek schema TiDB staging |
| `npm run db:backfill:org-assignments` | Link RoleAssignment lama → OrgAssignment |
5. `prisma generate`

Semua script CJS **idempotent**: aman dijalankan berulang; hanya menambah yang belum ada.

---

## Decision tree

```
Baru clone / pertama kali setup?
  → npm run db:migrate:local
  → npm run dev:all

Baru git pull & ada perubahan prisma/schema.prisma?
  → npm run db:migrate:local
  → restart dev:all

Error Prisma: "column X does not exist"?
  → npm run db:schema:check
  → npm run db:migrate:local

Auth gagal memuat user + error kolom?
  → npm run db:migrate:local

Staging deploy?
  → npm run db:migrate:staging (setelah review)

Production?
  → HANYA saat diminta eksplisit: npm run db:migrate:prod
```

---

## Menambah migrasi baru (episode berikutnya)

1. Update `prisma/schema.prisma`
2. Tambah `prisma/migrations/NN_nama/migration.sql` (dokumentasi resmi)
3. Tambah `server/_migrate-nama.cjs` idempotent (untuk TiDB lokal/staging yang tidak pakai migrate history)
4. Daftarkan di `scripts/db-migrate-local.mjs` (`STEPS` array)
5. Jika kolom wajib untuk boot: tambah ke `scripts/check-db-schema.mjs` (`REQUIRED_USER_COLUMNS` / `REQUIRED_TABLES`)
6. Tambah npm script `db:migrate:nama` di `package.json`
7. `npx prisma generate`

---

## Environment

| Env | File | Migrasi disarankan |
|-----|------|-------------------|
| Lokal | `.env` | `db:migrate:local` |
| Staging | `.env.staging` | `db:migrate:local:staging` atau `db:migrate:staging` |
| Production | `.env.production` | `db:migrate:prod` — hanya manual |

---

## Troubleshooting

### `prisma migrate status` — semua migrasi "not applied"

Database dibuat dengan `db push` / seed tanpa `_prisma_migrations`. Untuk development harian, pakai **`db:migrate:local`**, bukan `db:migrate` penuh.

### `major_other` / `birth_date` tidak ada

```powershell
npm run db:migrate:local
```

### Placement migration gagal (foreign key)

Fitur Jethro placement batch — opsional untuk dev umum. `db:migrate:local` tetap lanjut; perbaiki placement terpisah jika diperlukan.

### Setelah migrasi, masih error

```powershell
npx prisma generate
# restart server
npm run dev:all
```
