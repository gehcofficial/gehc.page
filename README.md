# GEHC.page — Portal Ekosistem Pemuda GMIM Eben Haezer Cikarang

Public landing (English-first, ID toggle) + internal portal untuk sistem mentoring "Beyonders":
10 kelompok pemuridan dengan mesin regenerasi **Jethro Engine**, RBAC 8 level
berbasis Google SSO, dan media tersinkron Google Drive.

## Menjalankan Lokal

```bash
npm install

# Paritas dengan staging (disarankan):
cp .env.staging.example .env.staging   # isi secret TiDB/Google/Drive
npm run env:sync                       # .env.staging → .env + override localhost
npm run env:check                      # audit DATABASE_URL, demo flag, dll.

npm run dev      # server + Vite middleware (port 8787)
# atau: npm run dev:staging  # langsung baca .env.staging (tanpa salin ke .env)
```

Verifikasi: buka `http://localhost:8787/api/health` → `{"ok":true}`.

Login demo (butuh `DATABASE_URL` staging + `ENABLE_DEMO_PERSONAS=true`): `tech@gehc.demo` / `password123`.

## Konfigurasi (.env)

### Paritas lokal ↔ staging

| File | Peran |
|---|---|
| `.env.staging` | Sumber credential cluster staging; dipakai `db:*:staging` dan mirror Vercel |
| `.env` | Dev lokal — generate via `npm run env:sync` dari `.env.staging` |
| `.env.staging.example` | Template commit-safe (tanpa secret) |

**Harus sama** antara `.env` dan `.env.staging`: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `ENABLE_DEMO_PERSONAS`, `GDRIVE_ROOT_FOLDER_ID`, dll.

**Harus beda** (override lokal otomatis via `env:sync`):

| Variabel | Nilai lokal |
|---|---|
| `PORT` | `8787` |
| `CORS_ORIGIN` | `http://localhost:8787,http://localhost:3000` |
| `APP_URL` | `http://localhost:8787` |

Google Cloud Console — Authorized JavaScript origins wajib mencakup `http://localhost:8787`, `http://localhost:3000`, dan `https://staging-gehcpage.vercel.app` (lihat `drive-integration.md` §8).

Salin `.env.example` → `.env` hanya jika belum punya `.env.staging`. Prefer workflow: `.env.staging.example` → `.env.staging` → `npm run env:sync`.

| Blok | Variabel kunci | Dokumentasi |
|---|---|---|
| Database | `DATABASE_URL` (TiDB Cloud via Prisma) | script `db:*` di package.json |
| Google SSO | `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `SUPERADMIN_EMAILS` | `drive-integration.md` §8 |
| Demo staging | `ENABLE_DEMO_PERSONAS=true` (**jangan di produksi**) | `userflow.md` §2 |
| Google Drive | `GDRIVE_ROOT_FOLDER_ID` + service account JSON | **`drive-integration.md`** |

⚠️ File JSON service account & semua `.env*` (kecuali `*.example`) sudah di-gitignore — jangan pernah commit.

## Skrip Penting

| Perintah | Fungsi |
|---|---|
| `env:sync` / `env:check` | salin staging→lokal & audit paritas env |
| `dev:staging` | jalankan server memakai `.env.staging` langsung |
| `db:migrate:staging` / `db:migrate:prod` | deploy migrasi Prisma per environment |
| `db:seed` / `db:seed:staging` | data awal grup & struktur |
| `db:seed-users:staging` | akun dummy pantatugas (multi-role demo) |
| `db:seed:attendance:staging` | absensi 8 minggu + pemicu Jethro |
| `lint` / `build` | typecheck & build produksi |

## Dokumentasi

- `revision-v2-beyonders.md` — arsitektur & algoritma regenerasi (sumber produk)
- `pantatugas.md` — struktur organisasi lima fungsi + sub-divisi
- `userflow.md` — persona, RBAC, alur pengguna
- `drive-integration.md` — setup & kebijakan akses Google Drive
- `roadmap.md` / `tech.stack.md` — status teknis
