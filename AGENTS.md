# AGENTS.md — GEHC.page Agent Playbook

## Project

**GEHC.page** — public landing + Beyonders mentoring portal for GMIM Eben Haezer Cikarang Youth.

- Staging: `https://staging-gehcpage.vercel.app`
- Local: `npm run dev:all` (API `:8787` + Vite `:3000`)

## Branch strategy

- `main` — production-ready
- `cursor/<episode-slug>` — feature work

## Dev commands

```powershell
npm run dev:all          # API + frontend (peringatan jika DB belum sinkron)
npm run db:migrate:local   # setelah clone/pull — sinkronkan schema TiDB
npm run db:schema:check    # cek kolom wajib tanpa mengubah DB
npm run lint             # tsc --noEmit
npm run test             # vitest unit tests
npm run test:e2e         # Playwright E2E
npm run db:migrate:staging
npm run db:seed-users:staging
```

## RBAC rules

- **Never bypass** `requireRole()` on server endpoints.
- Nav gating in `PortalLayout.tsx` is UI-only; API must enforce independently.
- 8 portal roles: SUPERADMIN, BPMJ, KOMISI, COMMITTEE, MENTOR, CO_MENTOR, MENTEE, ALUMNI.
- Demo accounts: `*@gehc.demo` (see `server/seed-users.ts`).

## Database

- TiDB Cloud via Prisma — **never** run destructive prod commands without explicit user request.
- **Lokal:** `npm run db:migrate:local` (bukan `db:migrate` penuh pada DB yang sudah ada).
- Staging: `.env.staging` / `DATABASE_URL_STAGING`
- Production: `.env.production` only for `db:migrate:prod`
- Panduan lengkap: [`docs/tech/database-migrations.md`](docs/tech/database-migrations.md)

## Commit style

```
feat(scope): short description.
fix(scope): ...
refactor(scope): ...
test: ...
```

## Handoff

After each episode, update [`HANDOFF.md`](HANDOFF.md) with Done / Next / Commands.

## Documentation index

See [`docs/README.md`](docs/README.md).

## Key files

| Area | Path |
|------|------|
| Portal nav + RBAC UI | `src/components/portal/PortalLayout.tsx` |
| Auth context | `src/context/AuthContext.tsx` |
| Server API | `server/index.mjs` |
| Vercel entry | `api/index.mjs` (re-exports server app) |
| Prisma schema | `prisma/schema.prisma` |
| Roles | `src/lib/roles.ts`, `docs/product/userflow.md` |
