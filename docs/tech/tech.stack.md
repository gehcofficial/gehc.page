# Tech Stack — GEHC Youth Ecosystem (gehc.page)

Dokumen teknologi, arsitektur, dan keputusan teknis repo `gehc.page`.

---

## 1. Ringkasan Proyek

**Aplikasi:** Portal ekosistem digital multi-tenant GMIM Eben Haezer Cikarang.
Tenant aktif: **Komisi Pelayanan Pemuda (Youth)** — landing publik + portal administrasi + mesin regenerasi kelompok.

**Jenis:** SPA React (Vite) + **API server Express** + **database TiDB Cloud**
(via Prisma). Data operasional kini bersumber dari TiDB; localStorage hanya
fallback demo.

---

## 2. Stack Inti

| Lapisan | Teknologi | Catatan |
|---|---|---|
| UI | React ^19 + TypeScript ~5.8 | SPA, router state-based (`activeView`/`publicTab`) |
| Styling | Tailwind CSS v4 | plugin `@tailwindcss/vite`, token di `src/lib/theme.ts` |
| Animasi | motion ^12 | reveal-on-scroll, hormat `prefers-reduced-motion` |
| API Server | Express 4 (`server/index.mjs`) | port 8787; proxy `/api` via Vite dev |
| Database | **TiDB Cloud Serverless** (MySQL-compatible) + Prisma 6 | migrasi berversi `prisma/migrations/0..2` |
| Auth | **Google Identity Services (SSO)** + cookie sesi HMAC httpOnly (`server/auth.mjs`) | verifikasi ID token via googleapis |
| AI | `@google/genai` — Narasi Jethro (`server/jethro-ai.mjs`, model `gemini-3.6-flash`) | env `GEMINI_MODEL` override |
| Google Drive | googleapis + **Service Account readonly**, policy engine per-role (`gdrive-policy.mjs`) | lihat `drive-integration.md` |
| E2E tooling | Playwright (terpasang, test menyusul) | |

---

## 3. Arsitektur

```
Vite SPA (3000) ──proxy /api──► Express (8787)
                                  ├── auth.mjs        SSO GIS → sesi HMAC → RBAC requireRole()
                                  ├── db.mjs          PrismaClient lazy (TiDB)
                                  ├── gdrive.mjs      Service Account + folder chain cache
                                  ├── gdrive-policy.mjs  zona [TAG] → resolveAccess per role
                                  ├── engine.mjs      "Jethro": kapasitas, idle, mitosis, split/merge
                                  └── jethro-ai.mjs   narasi Gemini atas snapshot engine
Database gehc (TiDB): tenants, users(+roles multi), groups(parent lineage),
group_members(status alumni), attendance_records, monitoring_records,
content_items, struktur_members(subdivision)
```

### Keputusan arsitektur penting

1. **Sumber kebenaran ganda yang disinkron**: entitas operasional di TiDB;
   UI publik/portal membaca API dengan fallback lokal. Mutasi struktur di
   portal auto-sync ke `/api/db/sync-struktur`.
2. **Multi-role**: satu akun boleh banyak `user_roles`; effective role =
   precedensi (`src/lib/roles.ts`), konteks bisa diganti via chips Navbar.
3. **Drive izin = konvensi nama folder `[TAG]`** diresolveserver-side;
   tamu hanya `[PUBLIK]`; audit drift DB↔Drive tersedia untuk SUPERADMIN.
4. **localStorage tetap dipakai** sebagai mode offline/demo dengan key
   berversi (`gehc_users_v2`, `gehc_struktur_v2`, …) — bukan lagi sumber utama.

---

## 4. Model Data Inti (Prisma)

- `User` + `UserRole[]` (role enum 8 level: SUPERADMIN…ALUMNI; groupId scoping)
- `Group` (+`parentGroupId` lineage mitosis, status ACTIVE/DORMANT/MERGED/ARCHIVED)
- `GroupMember` (familyRole MENTOR/COMENTOR/MENTEE; status ACTIVE/ALUMNI + jejak alumni)
- `AttendanceRecord` (unik per member+tanggal — dasar aturan idle 4 minggu)
- `Notification` (IDLE_FLAG / MITOSIS_ALERT / MERGER_SUGGESTION + status)
- `StrukturMember` (division pantatugas + subdivision extensible)
- `ContentItem`, `MonitoringRecord`, `Tenant`

---

## 5. RBAC

Server: middleware `requireRole(...roles)` + scoping grup pada endpoint absensi.
Klien: `canAccess()` memakai effective role. Matriks lengkap: `userflow.md` §1;
matriks Drive: `drive-integration.md` §4.

---

## 6. Keterbatasan Saat Ini

- Belum ada test otomatis (Playwright terpasang, file test menyusul).
- Routing masih state-based (tanpa URL/deep-link).
- Upload Drive (fase 2) belum dibangun — fase 1 read-only.
- Chunk JS >500 kB (code-splitting menyusul).