# GEHC Portal — Handoff Template

## 2. Current priority — Portal Rationalization + Demographics

**Goal:** Portal selaras per role, tanggal lahir + usulan BIPRA/HUT, satu pipeline onboarding.

### Done
- **birthDate** di User + migration `db:migrate:birth-date`
- **demographics.mjs** — umur, HUT, suggest BIPRA (Bapak/Ibu suggest-only)
- **Profil** — input tanggal lahir wajib untuk contact complete; chip usulan BIPRA
- **OnboardingGatePortal** — gabung WAITING_POOL + PENDING
- **Nav** — filter per role, hapus Waitlist + RBAC demo, rename Jethro menus
- **Onboarding** — 2 tab (Menunggu Profil | Menunggu Role), link ke Jemaat
- **Jemaat** — filter HUT 30 hari, konfirmasi BIPRA suggest, kolom umur
- **Legacy** — waitlist assign 410, bridge script `db:bridge:waitlist`, JoinPage default Google
- **Tests** — `tests/birth-date-bipra.spec.ts`

### Commands
```powershell
npm run db:migrate:birth-date
npm run db:bridge:waitlist   # optional: migrasi WaitlistEntry lama
npm run dev
npx playwright test tests/birth-date-bipra.spec.ts
```

### Key files
| File | Role |
|---|---|
| `server/demographics.mjs` | Age, BIPRA suggest, HUT |
| `src/components/portal/OnboardingGatePortal.tsx` | Unified gate portal |
| `src/components/portal/PortalLayout.tsx` | Role-based nav |
| `src/components/portal/YouthGEHCList.tsx` | Jemaat + HUT + BIPRA |
