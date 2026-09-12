# Production go-live — GEHC.page

Staging (`https://staging-gehcpage.vercel.app`) dan production **sengaja beda** di data, secret, dan seed. Yang harus sama: **kode + schema**.

Production URL: `https://youth.gehc.page` (Vercel Production = git `main`). `https://gehc.page` = **hub gereja** (statis); `www.gehc.page` → **308 redirect** ke `gehc.page`. Jangan pakai `npm run deploy:staging` untuk prod.

## Host = tenant (pool multi-unit)

Satu repo, satu Vercel project, satu DB. Unit ditentukan dari hostname:

| Host | Unit | `tenantId` | `defaultBipra` |
|---|---|---|---|
| `gehc.page` / `www` | Hub | — | `null` (netral) |
| `youth.gehc.page` | Pemuda | `tenant-youth` | `PEMUDA` |
| `teen.gehc.page` | Pra Remaja | `tenant-teen` | `REMAJA` |
| `kids.gehc.page` | Anak | `tenant-kids` | `ANAK` |
| `men.gehc.page` | P/KB | `tenant-men` | `BAPAK` |
| `women.gehc.page` | W/KI | `tenant-women` | `IBU` |
| `districts.gehc.page` | Kolom | `tenant-districts` | `null` |
| `community.gehc.page` | Komunitas | `tenant-community` | `null` |
| `*.vercel.app`, localhost | fallback Pemuda | `tenant-youth` | `PEMUDA` |

Registrasi mengikuti host: hub → `WAITING_POOL` + `bipra=null` + tanpa role unit; unit → `bipra` unit + role unit. Logika: `server/lib/host-context.mjs` (server) & `src/lib/host-context.ts` (frontend) — **jaga sinkron**.

Seed tenant: `npm run db:seed:tenants:staging` / `:prod`.

## 1. Env Vercel Production

Filter **Production** (bukan Preview). Wajib beda dari staging:

| Key | Production |
|-----|------------|
| `DATABASE_URL_PRODUCTION` (atau `DATABASE_URL`) | Cluster TiDB `youthgehc` — **bukan** branch/staging |
| `APP_URL` | `https://youth.gehc.page` |
| `CORS_ORIGIN` | `https://youth.gehc.page` (boleh tambah `https://gehcpage.vercel.app` selama transisi QR lama) |
| `SESSION_SECRET` | Kuat, **beda** dari staging |
| `OPERATOR_SESSION_SECRET` | Kuat, **beda** dari `SESSION_SECRET` dan dari staging |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Client OAuth yang whitelist domain prod |
| `GDRIVE_ROOT_FOLDER_ID` | Root Drive **production** |
| `CRON_SECRET` | Acak 32+ char — Vercel Cron kirim Bearer otomatis |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | SA yang di-share ke root prod |
| `WEBAUTHN_MOCK` | **jangan** `true` (hapus / `false`) |
| `SUPERADMIN_EMAILS` | **kosong** (auto-grant mati) |
| `REGISTRATION_OPEN` | sesuai kebijakan Komisi |
| Opsional | `GEMINI_API_KEY`, `BAKU_TAU_WA_GROUP_URL`, `GEHC_MAP_URL`, `GITHUB_PUBLISH_*` (tombol Publish di portal) |

GitHub **repo** secrets (bukan Vercel): `GDRIVE_ROOT_FOLDER_ID` tetap staging; tambah `GDRIVE_ROOT_FOLDER_ID_PRODUCTION` untuk publish ke `main`.

Lokal: `.env.production` (gitignore) hanya untuk script `*:prod`.

`VERCEL_ENV=production` membuat server memilih `DATABASE_URL_PRODUCTION` (`server/db.mjs`).

## 2. Google OAuth + WebAuthn

Google Cloud Console — OAuth Web client:

- Authorized JavaScript origins: `https://youth.gehc.page` (+ `https://gehcpage.vercel.app` selama transisi)
- Authorized redirect URIs: `https://youth.gehc.page/api/auth/google/callback`

`WEBAUTHN_RP_ID=gehc.page` (agar passkey berlaku lintas subdomain) / `WEBAUTHN_ORIGIN=https://youth.gehc.page`. Daftarkan ulang passkey `#/admin` di domain baru — passkey lama (`gehcpage.vercel.app`) tidak berlaku.

## 3. Database

```powershell
npm run db:migrate:prod
# jika kolom CJS belum ikut:
npm run db:migrate:local:prod
npm run db:schema:check:prod
# pohon jabatan (slot Assign Role / undangan staff) — bukan akun demo:
npm run db:seed:org-tree:prod
npm run db:seed:beyonders-houses:prod
```

Jangan `db:seed-users:staging` / akun `@gehc.demo` di prod.

## 4. Deploy kode

Merge ke `main` → Vercel Production build. Bukan alias Preview.

## 5. Operator (sekali)

```powershell
npm run operator:bootstrap:prod
```

Simpan break-glass di vault. Buka `#/admin` di prod → passkey → grant Platform Admin ke staf tech.

## 6. Drive

Root prod terpisah; share SA sebagai Content Manager.

```powershell
npm run drive:provision:prod
npm run drive:seed-visuals:prod   # jika visual publik dari Drive
```

Script mencetak root yang dipakai — cek sebelum lanjut. Panduan: [`drive-integration.md`](drive-integration.md) §9.

## 7. Smoke (akun nyata, bukan demo)

- `GET /api/auth/config` → `configured: true`
- Login Google jemaat → cookie sesi
- `#/admin` break-glass + passkey (bukan mock)
- Landing + `#/event/bakutau`
- Portal nav sesuai role nyata
- `#/admin` Orang & Provision: undang Beyonders (pilih rumah) dan staf (pilih slot) — tanpa error Prisma `onboarding_status`
- Drive/visual tidak mengarah ke folder staging

## 8. DNS (Cloudflare)

Zone `gehc.page` dikelola di **Cloudflare** (NS `coleman`/`serenity.ns.cloudflare.com`). Helper: `scripts/cloudflare-dns.mjs` (butuh `CF_API_TOKEN` scope `Zone → DNS → Edit` + `Zone → Zone → Read`).

```powershell
npm run dns:list
npm run dns:upsert -- --type CNAME --name youth --content 8e88b9e05f2e1e25.vercel-dns-017.com --ttl 300 --apply
```

Record aktif (semua **DNS-only**, jangan proxy di Cloudflare) — `@`, `www`, `youth`, `teen`, `kids`, `men`, `women`, `districts`, `community` semuanya CNAME ke target Vercel `8e88b9e05f2e1e25.vercel-dns-017.com`:

| Type | Name | Content |
|---|---|---|
| CNAME | `@` | target Vercel (CNAME flattening Cloudflare) |
| CNAME | `www` | target Vercel |
| CNAME | `youth` … `community` | target Vercel yang sama |

Registrasi subdomain di Vercel: `vercel domains add <sub>.gehc.page gehc.page` (semua di project `gehc.page`).

Redirect `www` → apex diatur di Vercel (bukan DNS); `gehc.page` **tidak** di-redirect (serve hub):

```powershell
vercel api /v9/projects/gehc.page/domains/www.gehc.page -X PATCH -F redirect=gehc.page -F redirectStatusCode=308 --scope gehc
# hapus redirect apex (serve hub): body {"redirect":null,"redirectStatusCode":null}
vercel api /v9/projects/gehc.page/domains/gehc.page -X PATCH --input clear.json --scope gehc
```

Ganti target DNS bila project Vercel berubah: `vercel domains verify <domain> --format=json` → pakai `recommended.records`.

## Jangan

- Seed `*@gehc.demo` atau `WEBAUTHN_MOCK=true`
- Menyalin `DATABASE_URL` / Drive root / `APP_URL` dari Preview ke Production
- Menjalankan `db:reset:bakutau-regs` di prod tanpa permintaan eksplisit
