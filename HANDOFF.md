# GEHC Portal — Handoff Template

## 1. How to use this file

When context hits **~70–80%** or you start a **new episode** (different feature/bug):

1. Open this file and copy the **Quick copy template** (section 3) into a **new Cursor chat**.
2. Fill in the blanks from section 2 (current priority) and your last session.
3. Attach only **2–3 key files** if needed — not whole logs or `server/index.mjs` dumps.
4. One chat = one episode. Don't continue a bloated thread.

---

## 2. Current priority — Test & polish Wilayah.id address

**Goal:** Verifikasi alur domisili end-to-end, perbaiki bug jika ada. **No Google Maps/Places.**

### Done (episode A — test & fix)
- Cascade Wilayah.id: provinsi → kab/kota → kecamatan → kelurahan (verified)
- Save ID + INTL, persist after reload
- Filter Domisili Indonesia / Luar negeri + badge (Indonesia / Singapura)
- Bugs fixed: profile infinite reload (`addToast` deps), demo session never bound, stale `setForm({...form, address})`, toast signature, trim nama wilayah

### Next (optional)
- E2E Playwright for address flow
- Filter provinsi di dashboard
- Admin edit alamat di Direktori (sudah wired, belum diuji mendalam)

### Key files
| File | Role |
|---|---|
| `src/components/portal/AddressForm.tsx` | UI domisili ID/INTL |
| `server/profile-fields.mjs` | Validasi + compose address |
| `server/index.mjs` | Wilayah proxy, jemaat filter |
| `src/components/portal/YouthGEHCList.tsx` | Admin direktori |
| `src/components/portal/MyProfilePanel.tsx` | Profil self-service |

### Quick start new chat — **COPY INI**

```
GEHC Youth Portal handoff — fresh context.

Episode: test & polish Wilayah.id address flow
Goal: Verifikasi domisili ID/INTL end-to-end, perbaiki bug jika ada
Done last session:
- AddressForm (Wilayah.id cascade + luar negeri) selesai
- MyProfilePanel + YouthGEHCList wired, filter domisili + badge
- Migration + prisma generate + dev server OK
Blocked on: [isi jika ada error saat test]
Next step: Test Profil saya + Direktori Jemaat, fix bug yang muncul

Stack: Vite/React/TS + Express (server/index.mjs) + TiDB/Prisma
Priority: Wilayah.id (NOT Google Maps). Baca HANDOFF.md
Credentials: tech@gehc.demo / password123 | tenant: tenant-bapak
Run: npm run dev → http://localhost:8787
Attach: AddressForm.tsx, profile-fields.mjs (jika bug alamat)
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
| Frontend | Vite + React + TypeScript (`src/`) |
| Backend | Express ESM (`server/index.mjs`, `server/auth.mjs`) |
| DB | TiDB Cloud + Prisma (`prisma/schema.prisma`) |
| AI | Vercel AI SDK (gpt-4o-mini + Groq fallback) |
| Auth | Google SSO + JWT session cookies |

```bash
npm run dev                    # dev server → :8787
node server/index.mjs          # alt start
npm run build                  # production build
npx playwright test            # E2E
node server/_seed-address-scope.cjs
npx prisma generate
node server/_dbstate.cjs       # check DB state
```

**Conventions:** `wrap(async (req,res)=>{})` handlers · `if (!req.authUser)` for auth · `requireRole('SUPERADMIN','KOMISI')` middleware · portal components in `src/components/portal/` (flat imports, no lazy load).

---

## 5. TiDB quirks (critical)

- Serverless **drops TCP** after ~2–5 sequential queries → hangs.
- **Never** `prisma.user.update()` in for-loops — use single `CASE WHEN` bulk UPDATE.
- Standalone scripts: use **CJS** (`.cjs`) — Prisma ESM import hangs.
- JSON null filter broken → raw SQL: `WHERE gifts_top5 IS NULL`.
- Pool exhaustion after ~80 sequential ops.

---

## Historical

<details>
<summary>Gift seeding & placement (archived — not current focus)</summary>

Earlier work on youth gift/placement data and bulk DB scripts. Useful for reference only.

- Seed scripts: `server/seed-youth-gehc.cjs`, `server/_gifts*.cjs` (MySQL/Prisma experiments)
- Placement: `server/engine.mjs`, `server/jethro-ai.mjs`
- E2E: `tests/full-flow.spec.ts`
- Check state: `node server/_dbstate.cjs`

TiDB rules above apply to all bulk gift/placement updates — never loop sequential Prisma writes.

</details>
