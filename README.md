# GEHC.page — Portal Ekosistem Pemuda GMIM Eben Haezer Cikarang

Public landing (English-first, ID toggle) + internal portal untuk sistem mentoring "Beyonders":
10 kelompok pemuridan dengan mesin regenerasi **Jethro Engine**, RBAC 8 level
berbasis Google SSO, dan media tersinkron Google Drive.

## Menjalankan Lokal

```bash
npm install

# Isi .env (lihat bagian Konfigurasi di bawah), lalu:
npm run server   # API Express (port 8787) — Drive, TiDB, Auth, Jethro
npm run dev      # Frontend Vite (port 3000)
```

Verifikasi: buka `http://localhost:8787/api/health` → `{"ok":true}`.

## Konfigurasi (.env)

Salin `.env.example` → `.env`, lalu isi sesuai kebutuhan:

| Blok | Variabel kunci | Dokumentasi |
|---|---|---|
| Database | `DATABASE_URL` (TiDB Cloud via Prisma) | script `db:*` di package.json |
| Google SSO | `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `SUPERADMIN_EMAILS` | — |
| Demo staging | `ENABLE_DEMO_PERSONAS=true` (**jangan di produksi**) | `userflow.md` §2 |
| Google Drive | `GDRIVE_ROOT_FOLDER_ID` + service account JSON | **`drive-integration.md`** |

⚠️ File JSON service account & semua `.env*` sudah di-gitignore — jangan pernah commit.

## Skrip Penting

| Perintah | Fungsi |
|---|---|
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
