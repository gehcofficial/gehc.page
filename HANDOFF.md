# GEHC Portal — Handoff Template

## 1. How to use this file

When context hits **~70–80%** or you start a **new episode** (different feature/bug):

1. Open this file and copy the **Quick copy template** (section 3) into a **new Cursor chat**.
2. Fill in the blanks from section 2 (current priority) and your last session.
3. Attach only **2–3 key files** if needed — not whole logs or `server/index.mjs` dumps.
4. One chat = one episode. Don't continue a bloated thread.

---

## 2. Current priority — Onboarding Pipeline + Jethro Placement Review

**Goal:** End-to-end newcomer flow: WaitingPool sync → admin pipeline → Jethro batch review → commit = role-assign parity → Youth GEHC tab.

### Done
- **Migration:** `placement_batches` / `placement_items` — `npm run db:migrate:placement`
- **Jethro UI:** import `JethroPlacementReview` di `PortalLayout.tsx`
- **Bulk approve:** TiDB-safe CASE WHEN SQL di `jethro-placement.mjs`
- **Commit parity:** `GroupMember`, `isBeyonders`, `COMENTOR`→`CO_MENTOR`, real `assignmentId` via `role-assign.mjs`
- **WaitingPool sync:** `onboarding-sync.mjs` hooks on profile/gifttest/join
- **Portal gating:** `onboardingStatus=WAITING_POOL` → `RestrictedPortal` (App.tsx + sync on signup)
- **Admin UI:** Youth GEHC tab pakai `GET /api/waiting-pool?status=ROLE_ASSIGNED`; wizard Role + link Jethro
- **Engine metadata:** `newcomerGender`, `newcomerGiftsTop5`, `newcomerMaturityScore` + gift normalize ID→EN
- **Tests:** `tests/onboarding-jethro.spec.ts` (API assertions)

### Next (optional)
- Bridge legacy `WaitlistEntry` → `WaitingPool`
- WhatsApp reminder integration (masih placeholder)
- Real `maturityScore` dari absensi

### Key files
| File | Role |
|---|---|
| `server/onboarding-sync.mjs` | Sync WaitingPool dari user profile/gifts |
| `server/jethro-placement.mjs` | Batch CRUD, bulk approve, commit |
| `server/role-assign.mjs` | Shared role-assign + GroupMember |
| `server/gift-normalize.mjs` | Map karunia ID (giftBank) → EN (engine) |
| `src/components/portal/WaitingPoolPanel.tsx` | 3-tab onboarding admin |
| `src/components/portal/JethroPlacementReview.tsx` | Review + commit batch |
| `server/_migrate-jethro-placement.cjs` | Migration placement tables |

### Quick start new chat — **COPY INI**

```
GEHC Youth Portal handoff — fresh context.

Episode: verify onboarding + Jethro placement end-to-end
Goal: Seed → pipeline → Jethro batch → commit → Youth GEHC tab
Done last session:
- db:migrate:placement + jethro bulk approve/commit fix
- onboarding-sync hooks + WaitingPoolPanel tab alignment
- engine metadata + gift normalize + onboarding-jethro.spec.ts
Blocked on: [isi jika migration/DB error]
Next step: npm run db:migrate:placement && npm run db:seed:onboarding → npm run dev → test pipeline

Stack: Vite/React/TS + Express + TiDB/Prisma
Credentials: tech@gehc.demo / password123
Run: npm run env:sync && npm run dev → http://localhost:8787
Attach: jethro-placement.mjs, WaitingPoolPanel.tsx
```

---

## 3. Chat management rules

- **One chat per episode** — placement algo, address form, auth fix = separate chats.
- **New chat at ~70–80% context** — don't wait until the model forgets earlier decisions.
- **Don't paste huge logs** — summarize errors in 3–5 lines; attach the relevant file only.
- **Don't split `server/index.mjs`** — all API routes stay in one file (~4800 lines).
- **TiDB: no sequential Prisma loops** — use bulk SQL (see §6).

---

## 4. Stack & commands

| Layer | Tech |
|---|---|
| Frontend | Vite + React + TypeScript |
| Backend | Express ESM (`server/index.mjs`) |
| DB | TiDB Cloud (MySQL) + Prisma |
| AI | Vercel AI SDK (OpenAI + Groq fallback) |

```powershell
npm run env:sync && npm run env:check
npm run db:migrate:placement
npm run db:seed:onboarding
npm run dev                    # http://localhost:8787
npx playwright test tests/onboarding-jethro.spec.ts
```

Demo login: `tech@gehc.demo` / `password123`

---

## 5. Branch conventions

- Feature branches: `cursor/<feature>-<hash>`
- Base: `staging`
- Don't force-push `main`/`staging`

---

## 6. TiDB / Prisma quirks (CRITICAL)

- Serverless TiDB drops TCP after ~2–5 sequential queries
- **Never** sequential `user.update()` in for-loops — use CASE WHEN bulk SQL
- Prisma ESM import hangs in standalone scripts — use `.cjs` for migrations/seeds
- JSON null filter broken — raw SQL: `WHERE gifts_top5 IS NULL`
- Stop dev server before `npx prisma generate` on Windows (EPERM)

---

## 7. Test credentials

| Role | Email | Password |
|---|---|---|
| Superadmin | tech@gehc.demo | password123 |
| Tenant | tenant-bapak | — |

---

## 8. Episode log (recent)

| Date | Episode | Outcome |
|---|---|---|
| 2026-08 | Profil Phase 1 UX | Full profile segments, church data request |
| 2026-08 | Onboarding + Jethro | WaitingPool sync, placement commit parity, E2E |
