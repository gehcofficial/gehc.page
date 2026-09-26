# Paritas Staging ↔ Main

Staging memakai **host paritas** dengan produksi (hub + unit), sehingga bisa
dibandingkan *apple-to-apple*.

| Peran | Staging | Produksi |
|---|---|---|
| Hub | `staging.gehc.page` | `gehc.page` |
| Pemuda | `staging-youth.gehc.page` | `youth.gehc.page` |
| Remaja | `staging-teen.gehc.page` | `teen.gehc.page` |
| Anak | `staging-kids.gehc.page` | `kids.gehc.page` |
| Kaum Bapa | `staging-men.gehc.page` | `men.gehc.page` |
| Kaum Ibu | `staging-women.gehc.page` | `women.gehc.page` |
| Kolom | `staging-districts.gehc.page` | `districts.gehc.page` |
| Komunitas | `staging-community.gehc.page` | `community.gehc.page` |

Alias lama `staging-gehcpage.vercel.app` tetap dipasang (kompatibilitas tautan/QR)
dan berfungsi sebagai fallback Pemuda (host tak dikenal).

Deteksi host ada di `src/lib/host-context.ts` + `server/lib/host-context.mjs`
(pola: `staging` → hub; `staging-<unit>` → unit). Daftar host untuk deploy ada di
`scripts/staging-hosts.mjs` — **jaga tetap sinkron**.

## Setup sekali (Cloudflare + Vercel)

Target DNS Vercel: `8e88b9e05f2e1e25.vercel-dns-017.com` (DNS-only, jangan proxy).

```powershell
# 1) DNS (dry-run dulu, lalu tambah --apply)
npm run dns:upsert -- --type CNAME --name staging             --content 8e88b9e05f2e1e25.vercel-dns-017.com --ttl 300
npm run dns:upsert -- --type CNAME --name staging-youth       --content 8e88b9e05f2e1e25.vercel-dns-017.com --ttl 300
# … ulangi untuk staging-teen, staging-kids, staging-men, staging-women,
#   staging-districts, staging-community

# 2) Daftarkan domain ke project Vercel
vercel domains add staging.gehc.page gehc.page --scope gehc
vercel domains add staging-youth.gehc.page gehc.page --scope gehc
# … ulangi untuk tiap host staging

# 3) Deploy + pasang semua alias
npm run deploy:staging
```

## Proteksi akses (WAJIB — staging memuat data produksi)

Password Protection Vercel **butuh paket Pro**. Karena paket kami belum Pro, staging
dilindungi **Basic Auth tingkat aplikasi** untuk host staging (hub + unit).

Cara kerja (`server/index.mjs`):
- Bila env `STAGING_BASIC_AUTH` terisi (`user:password`) **dan** host request adalah
  host staging (`isStagingHost`), semua endpoint `/api/*` meminta Basic Auth (401 +
  `WWW-Authenticate`). Host produksi/tak dikenal tidak terpengaruh.
- Browser akan menampilkan prompt Basic saat memuat data portal; kredensial di-cache
  per origin sehingga cukup sekali per host.

Set kredensial (sekali):
```powershell
# Vercel — environment Preview
"gehc:<password>" | vercel.cmd env add STAGING_BASIC_AUTH preview --scope gehc
# Lokal (untuk skrip verifikasi / curl) — .env tidak ikut git
Add-Content .env 'STAGING_BASIC_AUTH=gehc:<password>'
```
Ganti password: `vercel env rm STAGING_BASIC_AUTH preview --scope gehc` lalu `env add`
ulang, dan **redeploy** staging (`npm run deploy:staging`) agar env baru terpakai.

Verifikasi:
```powershell
curl -H "Authorization: Basic <base64(user:password)>" https://staging.gehc.page/api/version
# tanpa header → 401 "Autentikasi staging diperlukan."
```

Catatan:
- Hanya `/api/*` yang dijaga Express; aset statis (HTML/JS) tetap publik, tetapi
  **tidak memuat PII** — seluruh data sensitif mengalir lewat `/api`.
- Login Google di host staging akan terblokir Basic; gunakan login password/demo.
- Cron Vercel berjalan di host produksi (tidak terpengaruh).
- Alternatif bila nanti upgrade ke Pro: aktifkan Password Protection Vercel +
  `VERCEL_AUTOMATION_BYPASS_SECRET` (header `x-vercel-protection-bypass`, sudah
  didukung `sync-staging.mjs`).

## Kenapa staging bisa tertinggal (drift)

`npm run deploy:staging` menjalankan `vercel deploy` dari **isi working tree saat itu**
(bukan otomatis dari git), lalu memasang alias ke hasil build itu. Akibatnya staging
adalah **snapshot build manual** — ia **tidak** ikut berubah setiap `main` di-push.

## Cara menyelaraskan (satu perintah)

```powershell
npm run staging:sync
```

Urutannya:
1. **Fast-forward branch git** `staging` = `main` (`git push origin main:staging`).
2. **Deploy preview** `vercel deploy --yes` (retry 5× — jaringan sering gagal).
3. **Pasang alias** ke semua host staging (`scripts/staging-hosts.mjs`) + legacy.
4. **Verifikasi**: membandingkan `/api/version` `staging.gehc.page` vs `youth.gehc.page`.

Opsi:

```powershell
npm run staging:sync -- --branch-only   # hanya push branch (tanpa deploy)
npm run staging:sync -- --no-deploy     # branch + verifikasi saja
npm run staging:sync -- --no-verify     # tanpa cek /api/version
npm run deploy:staging                  # deploy + alias saja (retry 5×)
```

## Kalau `vercel deploy` gagal (`fetch failed`)

```powershell
vercel.cmd deploy --yes
vercel.cmd alias set <URL_DEPLOYMENT> staging.gehc.page --scope gehc
vercel.cmd alias set <URL_DEPLOYMENT> staging-youth.gehc.page --scope gehc
# … tiap host di scripts/staging-hosts.mjs
```

(Prasyarat: `vercel login` + `vercel link` untuk project `gehc/gehc.page`.)

## Otomatis dari git (opsional)

Dashboard Vercel → project `gehc.page` → Settings → Domains → pada tiap host staging
→ **Edit** → **Git Branch** = `staging` → Save. Setelah itu `git push origin main:staging`
membuat staging ter-deploy otomatis.

## Verifikasi cepat

```powershell
# Basic Auth diperlukan untuk host staging (lihat bagian Proteksi)
$b = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:STAGING_BASIC_AUTH))
curl -H "Authorization: Basic $b" https://staging.gehc.page/api/version
curl -H "Authorization: Basic $b" https://staging-youth.gehc.page/api/version
curl https://youth.gehc.page/api/version
# `commit` ketiganya harus sama (build yang sama).
```

## Catatan database & OAuth

- Staging memakai **DB staging** (cluster TiDB terpisah). Menarik data produksi:
  `npm run db:copy:prod-to-staging` (dry-run) → `npm run db:copy:prod-to-staging:apply`
  → `npm run db:seed-users:staging` (pulihkan akun demo). **passwordHash diganti** —
  password akun produksi tidak berlaku di staging.
- **Google OAuth**: tambahkan origin `https://staging*.gehc.page` di Google Cloud Console
  (Authorized JavaScript origins + redirect) agar login Google jalan di host staging.
  Login password/demo tetap jalan tanpa ini.
- **Passkey/WebAuthn**: RP ID produksi `gehc.page`; host staging perlu RP sendiri
  (atau cukup andalkan login password).

```powershell
npm run db:migrate:local:staging     # migrasi idempoten (server/_migrate-*.cjs)
npm run db:migrate:staging           # prisma migrate deploy (folder prisma/migrations)
```
