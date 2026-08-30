# GEHC Portal — Handoff Template

## 1. How to use this file

When context hits **~70–80%** or you start a **new episode** (different feature/bug):

1. Open this file and copy the **Quick copy template** (section 3) into a **new Cursor chat**.
2. Fill in the blanks from section 2 (current priority) and your last session.
3. Attach only **2–3 key files** if needed — not whole logs or `server/index.mjs` dumps.
4. One chat = one episode. Don't continue a bloated thread.

---

## 2. Current priority — Profil Saya Phase 1 UX (full)

**Goal:** Profil self-service lengkap — header, status hidup, karunia wizard, minat search, domisili Wilayah.id.

### Done
- **Header:** avatar + email read-only, pisah data gereja (admin) vs self-service
- **Kontak & alamat:** gender, HP, `AddressForm` Wilayah.id (ID + luar negeri)
- **Status hidup:** sekolah / kuliah / kerja (multi); kerja = nama + industri + jabatan; jurusan "Lainnya" = input bebas
- **Karunia:** `ProfileGiftsSection` + `GiftTestWizard` (bukan textarea JSON); CTA di `RestrictedPortal`
- **Minat:** search + chip + **Lainnya…** → admin approve di Direktori Jemaat
- **Kontak darurat:** nama, hubungan, HP, alamat opsional
- **DB:** `work_industry`, `work_role`, `major_other`, `recreational_suggestions`
- **Env:** `npm run env:sync` / `env:check`, `npm run db:migrate:profile`, `npm run db:migrate:church-request`
- **Request data gereja:** user ajukan ubah nama/BIPRA/kolom → admin approve di Direktori
- **Tests:** `tests/profile-phase1.spec.ts`

### Next (optional)
- E2E alamat cascade di Profil + Direktori admin
- Filter provinsi di dashboard
- Institution suggest dari profil (user)

### Key files
| File | Role |
|---|---|
| `src/components/portal/MyProfilePanel.tsx` | Profil utama (5 segmen) |
| `src/components/portal/ProfileGiftsSection.tsx` | Tes karunia wizard |
| `src/components/portal/ProfileRecreationalSection.tsx` | Minat + suggest |
| `src/components/portal/AddressForm.tsx` | Domisili ID/INTL |
| `server/profile-fields.mjs` | Validasi + segments |
| `server/_migrate-profile-phase1.cjs` | Migration kolom phase 1 |
| `src/components/portal/YouthGEHCList.tsx` | Admin direktori + approve minat |

### Quick start new chat — **COPY INI**

```
GEHC Youth Portal handoff — fresh context.

Episode: test Profil Saya Phase 1 end-to-end
Goal: Verifikasi 5 segmen profil + suggest minat + admin approve
Done last session:
- Merge PR #1 Phase 1 UX ke branch lokal
- ProfileGiftsSection, ProfileRecreationalSection, migration phase 1
- env:sync scripts + db:migrate:profile
Blocked on: [isi jika migration/DB error]
Next step: npm run db:migrate:profile → npm run dev → test semua segmen

Stack: Vite/React/TS + Express + TiDB/Prisma
Credentials: tech@gehc.demo / password123
Run: npm run env:sync && npm run dev → http://localhost:8787
Attach: MyProfilePanel.tsx, profile-fields.mjs
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
