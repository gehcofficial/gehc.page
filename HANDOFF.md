# GEHC Portal — Handoff

## 1. How to use this file

When context hits **~70–80%** or you start a **new episode**:

1. Copy the **Quick copy template** (section 3) into a **new Cursor chat**.
2. Fill blanks from section 2 if something changed since last update.
3. Attach **2–3 key files** only — not whole logs or `server/index.mjs` dumps.
4. One chat = one episode.

---

## 2. Current state (updated 2026-08-30)

### Priority untuk chat berikutnya

**Pilih satu episode** (jangan campur):

| Episode | Goal | Status |
|---|---|---|
| **A — Merge & deploy Profil UX Phase 1** | Review + merge PR #1, jalankan migrasi DB staging | PR open |
| **B — E2E address + profil** | Playwright `tests/address-flow.spec.ts`, `tests/profile-phase1.spec.ts` | Partially on branch `cursor/profil-ux-phase-1-77c7` |
| **C — Admin Direktori alamat** | Edit alamat jemaat di YouthGEHCList, filter provinsi dashboard | Belum |
| **D — Polish staging deploy** | Merge PR #3 env parity, sync Vercel env vars | PR open |

### Done (sesi terakhir)

**Local dev unblock**
- Fix crash `npm run dev`: export `calculateGiftDiversity` di `server/engine.mjs` (commit `63f426f`, merged ke `main` + `staging`).

**Paritas env lokal ↔ staging** (PR #3 → `staging`)
- `npm run env:sync` — `.env.staging` → `.env` + override localhost + backup `.env` lama
- `npm run env:check` — audit shared vars, cegah prod DB di lokal
- `npm run dev:staging` — secret staging + override localhost (cross-platform)
- `.env.staging.example`, README, `drive-integration.md` §8 (OAuth origins)

**Profil UX Phase 1** (PR #1 → `staging`, draft)
- Header profil (avatar, email read-only, label admin)
- Status hidup: `workIndustry`, `workRole`, `majorOther`
- Karunia: `ProfileGiftsSection` + wizard (bukan JSON textarea)
- Minat: search + suggest API + admin approve
- Migrasi: `prisma/migrations/10_profile_work_rec_suggest/`
- E2E: `tests/profile-phase1.spec.ts`

**Wilayah.id address** (episode sebelumnya — done)
- Cascade ID + INTL, filter Direktori, bugs profil/demo session fixed

### Open PRs

| PR | Branch | Base | Isi |
|---|---|---|---|
| [#1](https://github.com/gehcofficial/gehc.page/pull/1) | `cursor/profil-ux-phase-1-77c7` | `staging` | Profil UX Phase 1 |
| [#3](https://github.com/gehcofficial/gehc.page/pull/3) | `cursor/env-local-staging-parity-77c7` | `staging` | Env parity scripts + docs |

### Local dev — workflow standar

```powershell
cd "D:\AISaerang Life\gehc.page"
git pull origin staging

# Setup env (sekali / saat secret berubah):
copy .env.staging.example .env.staging
# Isi .env.staging: DATABASE_URL (dengan TiDB user prefix!), GOOGLE_CLIENT_ID, dll.
npm run env:sync
npm run env:check

npm run dev
# → http://localhost:8787
# Health: http://localhost:8787/api/health
# Demo: tech@gehc.demo / password123 (butuh ENABLE_DEMO_PERSONAS=true + DB staging)
```

**Penting TiDB:** `DATABASE_URL` wajib format `mysql://<prefix>.<user>:<password>@gateway.../gehc_staging?sslaccept=strict`. Error `Missing user name prefix` = URL salah.

**Google OAuth origins** (Cloud Console): `http://localhost:8787`, `http://localhost:3000`, `https://staging-gehcpage.vercel.app`

### Deploy setelah merge Profil Phase 1

```bash
git pull origin staging
npm run db:migrate:staging
node server/_migrate-profile-phase1.cjs   # jika migrasi belum via prisma deploy
npx prisma generate
npx playwright test tests/profile-phase1.spec.ts
npm run deploy:staging
```

### Key files

| Area | Files |
|---|---|
| Env parity | `scripts/env-config.mjs`, `scripts/sync-env-from-staging.mjs`, `scripts/check-env-parity.mjs`, `.env.staging.example` |
| Profil UX | `src/components/portal/MyProfilePanel.tsx`, `ProfileGiftsSection.tsx`, `ProfileRecreationalSection.tsx`, `src/lib/profile.ts` |
| Address | `src/components/portal/AddressForm.tsx`, `server/profile-fields.mjs` |
| API | `server/index.mjs` (~4800 lines — jangan split) |
| Engine | `server/engine.mjs` (export `calculateGiftDiversity`) |

### Known issues / blockers

| Issue | Fix |
|---|---|
| `npm run dev` crash `calculateGiftDiversity` | `git pull origin staging` (sudah fixed) |
| TiDB `Missing user name prefix` | Perbaiki `DATABASE_URL` — tambah prefix user TiDB Cloud |
| Cursor GitHub App error | Install https://github.com/apps/cursor di org `gehcofficial` |
| Lokal beda staging | `npm run env:sync && npm run env:check` |

---

## 3. Quick copy template — **COPY INI ke chat baru**

```
GEHC Youth Portal handoff — fresh context.

Repo: gehcofficial/gehc.page | base branch: staging
Run: npm run env:sync && npm run env:check && npm run dev → http://localhost:8787
Demo: tech@gehc.demo / password123 | tenant: tenant-bapak

Episode: [pilih A/B/C/D dari HANDOFF.md §2]
Goal: [satu kalimat]
Done last session:
- npm run dev fix (calculateGiftDiversity export) — merged
- Env parity: env:sync, env:check, dev:staging (PR #3)
- Profil UX Phase 1 (PR #1 draft): header, hidup, karunia wizard, minat suggest
- Wilayah.id address flow done
Blocked on: [isi jika ada]
Next step: [satu langkah konkret]

Stack: Vite/React/TS + Express (server/index.mjs) + TiDB/Prisma
Priority: [Wilayah.id / Profil / Env / E2E — NOT Google Maps]
Attach: [2-3 file relevan saja]
Baca: HANDOFF.md
```

---

## 4. Chat management rules

- **One chat per episode** — placement, address, profil, env = terpisah.
- **New chat at ~70–80% context**.
- **Don't paste huge logs** — 3–5 baris error + file relevan.
- **Don't split `server/index.mjs`** — semua route API tetap satu file.
- **TiDB: no sequential Prisma loops** — bulk SQL only (§6).

---

## 5. Stack & commands

| Layer | Tech |
|---|---|
| Frontend | Vite + React + TypeScript (`src/`) |
| Backend | Express ESM (`server/index.mjs`, `server/auth.mjs`) |
| DB | TiDB Cloud + Prisma (`prisma/schema.prisma`) |
| Auth | Google SSO + demo personas (`ENABLE_DEMO_PERSONAS`) |
| Deploy staging | Vercel → `staging-gehcpage.vercel.app` |

```bash
npm run env:sync              # .env.staging → .env (+ backup)
npm run env:check             # audit paritas
npm run dev                   # :8787 (Vite middleware)
npm run dev:staging           # secret staging + override localhost
npm run db:migrate:staging    # migrasi ke TiDB staging
npm run db:seed-users:staging # akun demo @gehc.demo
npm run deploy:staging        # Vercel preview + alias
npx playwright test           # E2E
npm run lint                  # tsc --noEmit
```

**Conventions:** `wrap(async (req,res)=>{})` · `requireRole(...)` · portal components flat di `src/components/portal/`.

---

## 6. TiDB quirks (critical)

- Serverless **drops TCP** after ~2–5 sequential queries → hangs.
- **Never** `prisma.user.update()` in for-loops — use single `CASE WHEN` bulk UPDATE.
- Standalone scripts: use **CJS** (`.cjs`) — Prisma ESM import hangs.
- JSON null filter broken → raw SQL: `WHERE gifts_top5 IS NULL`.
- `DATABASE_URL` TiDB Cloud **wajib user prefix** di connection string.

---

## 7. Environment files (ringkas)

| File | Peran |
|---|---|
| `.env.staging` | Sumber secret staging (+ mirror Vercel) — **gitignored** |
| `.env` | Dev lokal — generate via `npm run env:sync` — **gitignored** |
| `.env.staging.example` | Template commit-safe |
| `.env.production` | Hanya `db:*:prod` — **jangan di lokal** |

Shared (sama): `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ENABLE_DEMO_PERSONAS`, `SESSION_SECRET`, `GDRIVE_*`  
Lokal only (beda): `PORT=8787`, `CORS_ORIGIN=localhost:8787+3000`, `APP_URL=http://localhost:8787`

---

## Historical

<details>
<summary>Gift seeding & placement (archived)</summary>

- Seed: `server/seed-youth-gehc.cjs`, `server/_gifts*.cjs`
- Placement: `server/engine.mjs`, `server/jethro-ai.mjs`
- E2E: `tests/full-flow.spec.ts`
- State: `node server/_dbstate.cjs`

</details>

<details>
<summary>Wilayah.id address episode (archived — done)</summary>

- `AddressForm.tsx`, `profile-fields.mjs`, filter Direktori + badge ID/INTL
- Bugs fixed: profile reload loop, demo session, stale form state

</details>
