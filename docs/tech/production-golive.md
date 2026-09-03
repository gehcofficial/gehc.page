# Production go-live — GEHC.page

Staging (`https://staging-gehcpage.vercel.app`) dan production **sengaja beda** di data, secret, dan seed. Yang harus sama: **kode + schema**.

Production URL: `https://gehcpage.vercel.app` (Vercel Production = git `main`). Jangan pakai `npm run deploy:staging` untuk prod.

## 1. Env Vercel Production

Filter **Production** (bukan Preview). Wajib beda dari staging:

| Key | Production |
|-----|------------|
| `DATABASE_URL_PRODUCTION` (atau `DATABASE_URL`) | Cluster TiDB `youthgehc` — **bukan** branch/staging |
| `APP_URL` | `https://gehcpage.vercel.app` |
| `CORS_ORIGIN` | `https://gehcpage.vercel.app` (+ custom domain jika ada) |
| `SESSION_SECRET` | Kuat, **beda** dari staging |
| `OPERATOR_SESSION_SECRET` | Kuat, **beda** dari `SESSION_SECRET` dan dari staging |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Client OAuth yang whitelist domain prod |
| `GDRIVE_ROOT_FOLDER_ID` | Root Drive **production** |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | SA yang di-share ke root prod |
| `WEBAUTHN_MOCK` | **jangan** `true` (hapus / `false`) |
| `SUPERADMIN_EMAILS` | **kosong** (auto-grant mati) |
| `REGISTRATION_OPEN` | sesuai kebijakan Komisi |
| Opsional | `GEMINI_API_KEY`, `BAKU_TAU_WA_GROUP_URL`, `GEHC_MAP_URL`, `GITHUB_PUBLISH_*` |

Lokal: `.env.production` (gitignore) hanya untuk script `*:prod`.

`VERCEL_ENV=production` membuat server memilih `DATABASE_URL_PRODUCTION` (`server/db.mjs`).

## 2. Google OAuth + WebAuthn

Google Cloud Console — OAuth Web client:

- Authorized JavaScript origins: `https://gehcpage.vercel.app` (+ custom domain)
- Authorized redirect URIs: `https://gehcpage.vercel.app/api/auth/google/callback`

`WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` ikut hostname prod, atau biarkan default dari `APP_URL`.

## 3. Database

```powershell
npm run db:migrate:prod
# jika kolom CJS belum ikut:
npm run db:migrate:local:prod
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
- Drive/visual tidak mengarah ke folder staging

## Jangan

- Seed `*@gehc.demo` atau `WEBAUTHN_MOCK=true`
- Menyalin `DATABASE_URL` / Drive root / `APP_URL` dari Preview ke Production
- Menjalankan `db:reset:bakutau-regs` di prod tanpa permintaan eksplisit
