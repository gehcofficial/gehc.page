# Platform Operator — GEHC.page

Akun bootstrap Tim Tech terpisah dari jemaat (`PlatformOperator` table).

## Per environment

| Env | Operator | Password |
|-----|----------|----------|
| Local / Staging | `ops-staging@gehc.demo` (seed) | `DEMO_PASSWORD` / `password123` |
| Production | Bootstrap manual | Vault — rotate kuartal |

## Commands

```powershell
npm run db:migrate:platform-operators   # idempotent — tidak DROP data
npm run db:seed:operator:staging        # buat jika belum ada; tidak rotate password
npm run operator:ensure:prod            # pastikan 2 email prod ada; tidak rotate hash
npm run operator:bootstrap:prod         # production, sekali (skip jika email sudah ada)
```

Migrasi CJS `db:migrate:local*` **tidak boleh** menghapus `platform_operators`. Password break-glass hanya berubah jika `OPERATOR_ROTATE=true` pada bootstrap.

## Auth

- **Passkey/WebAuthn** — login utama di `#/admin`
- **Break-glass** — password lokal, rate-limited
- **Platform Admin** — grant ke `User` existing; login portal Google + link Admin

## Env vars

```
OPERATOR_SESSION_SECRET=   # terpisah dari SESSION_SECRET
WEBAUTHN_RP_ID=            # default dari APP_URL hostname
WEBAUTHN_ORIGIN=           # default APP_URL origin
WEBAUTHN_MOCK=true         # staging/E2E only
PLATFORM_RBAC_LEGACY=true  # hormati UserRole.SUPERADMIN lama (default)
OPERATOR_SEED_EMAIL=ops-staging@gehc.demo
```

## Production rules

- Jangan seed `@gehc.demo` di prod
- `SUPERADMIN_EMAILS` kosong di prod (auto-grant disabled)
- Satu operator root + break-glass di vault
