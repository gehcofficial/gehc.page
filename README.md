# GEHC.page — Portal Ekosistem Pemuda GMIM Eben Haezer Cikarang

Public landing (English-first, ID toggle) + internal portal untuk sistem mentoring "Beyonders":
10 kelompok pemuridan dengan mesin regenerasi **Jethro Engine**, RBAC 8 level
berbasis Google SSO, dan media tersinkron Google Drive.

## Menjalankan Lokal

```bash
npm install

# Isi .env (lihat bagian Konfigurasi di bawah), lalu sinkronkan schema TiDB:
npm run db:migrate:local

npm run server   # API Express (port 8787) — Drive, TiDB, Auth, Jethro
npm run dev      # Frontend Vite (port 3000)
# atau sekaligus:
npm run dev:all
```

Verifikasi: buka `http://localhost:8787/api/health` → `{"ok":true}`.

> Error kolom tidak ada (`major_other`, dll.)? Lihat [`docs/tech/database-migrations.md`](docs/tech/database-migrations.md).

## Konfigurasi (.env)

Salin `.env.example` → `.env`, lalu isi sesuai kebutuhan:

| Blok | Variabel kunci | Dokumentasi |
|---|---|---|
| Database | `DATABASE_URL` (TiDB Cloud via Prisma) | script `db:*` di package.json |
| Google SSO | `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `SUPERADMIN_EMAILS` | — |
| Demo staging | `ENABLE_DEMO_PERSONAS=true` (**jangan di produksi**) | `docs/product/userflow.md` §2 |
| Google Drive | `GDRIVE_ROOT_FOLDER_ID` + service account JSON | **`docs/tech/drive-integration.md`** |

⚠️ File JSON service account & semua `.env*` sudah di-gitignore — jangan pernah commit.

## Skrip Penting

| Perintah | Fungsi |
|---|---|
| `db:migrate:local` | sinkronkan schema TiDB lokal (kolom/tabel wajib) — **jalankan setelah clone/pull** |
| `db:schema:check` | cek apakah DB sudah sinkron dengan Prisma |
| `db:migrate:staging` / `db:migrate:prod` | deploy migrasi Prisma per environment |
| `db:seed` / `db:seed:staging` | data awal grup & struktur |
| `db:seed-users:staging` | akun dummy pantatugas (multi-role demo) |
| `db:seed:attendance:staging` | absensi 8 minggu + pemicu Jethro |
| `lint` / `build` / `test` / `test:e2e` | typecheck, unit tests, E2E, build produksi |

## Dokumentasi

Lihat [`docs/README.md`](docs/README.md) — index lengkap.

- [`docs/product/revision-v2-beyonders.md`](docs/product/revision-v2-beyonders.md) — arsitektur & algoritma regenerasi
- [`docs/product/pantatugas.md`](docs/product/pantatugas.md) — struktur organisasi lima fungsi
- [`docs/product/userflow.md`](docs/product/userflow.md) — persona, RBAC, alur pengguna
- [`docs/tech/drive-integration.md`](docs/tech/drive-integration.md) — setup Google Drive
- [`docs/tech/database-migrations.md`](docs/tech/database-migrations.md) — migrasi TiDB lokal & staging
- [`AGENTS.md`](AGENTS.md) — agent playbook
