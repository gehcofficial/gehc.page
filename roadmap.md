# Roadmap — GEHC Youth Ecosystem (gehc.page)

Rencana pengembangan berdasarkan bukti di kode (badge tenant, dependensi terpasang, keterbatasan saat ini). Roadmap asli belum pernah didokumentasikan sebelumnya — dokumen ini menjadi baseline resmi pertama.

---

## Legenda Status

- ✅ Selesai · 🚧 Berjalan · 📋 Terencana (tersirat di kode) · 💡 Usulan baru

---

## Fase 0 — MVP Youth Portal ✅ *(saat ini)*

- ✅ Situs publik 5 halaman: Home, Warta, Kegiatan, Kelompok, Struktur.
- ✅ Portal administrasi 7 modul (Dashboard, Warta, Kegiatan, Monitoring, Struktur, RBAC, Integrasi).
- ✅ Multi-tenant arsitektur preview (5 tenant terdefinisi; Youth aktif).
- ✅ RBAC matrix 4 role (Superadmin/Committee/Mentor/Menti) dengan binding grup.
- ✅ Persistence localStorage + seed data demo + reset data.
- ✅ Design system editorial hangat + 10 identitas warna kelompok.
- ✅ **Branding "Beyonders"** — judul utama *"Beyond the Sunday Walk"*; sistem mentoring resmi bernama Beyonders.
- ✅ **Carousel 10 Kelompok Beyonders** sebagai landing utama + mini family tree (Mentor & Comentor) per kartu.
- ✅ **Halaman detail grup** — family tree lengkap (Mentor → Comentor → Mentee) + timeline sejarah regenerasi per batch.
- ✅ **Section Komisi Pemuda & Tim Kerja** — Badan Pengurus Inti + bidang/divisi tim kerja.
- ✅ **API server Express** (`server/`) — jembatan Google Drive & TiDB Cloud, graceful degradation saat env belum diisi.
- ✅ **Prisma ORM + schema TiDB** (`prisma/schema.prisma`) — 9 tabel: tenants, users, user_roles, groups, group_batches, group_members, monitoring_records, content_items, struktur_members.
- ✅ Data real retreat 2026 (mentor/comentor/mentee 10 grup) dari `Retreat Attendance_GEC YOUTH 2026.xlsx` → seed `INITIAL_GROUP_BATCHES`.

---

## Fase 1 — Fondasi Production 🚧 *(Berjalan — mayoritas selesai)*

Prioritas tertinggi agar aplikasi layak dipakai pengurus sungguhan:

1. **Backend & Database nyata** ✅ — **TiDB Cloud (MySQL) via Prisma**, cukup satu variabel `DATABASE_URL`:
   - ✅ Prisma schema + migrasi berversi (`0_init`, `1_rbac_mitosis`, `2_pantatugas_multirole`) ter-deploy ke **staging & prod** (dua cluster: `youthgehc` prod, branch `youthgehc_staging`).
   - ✅ API Express lengkap: groups/batches/members/attendance/sync + Jethro Engine + Auth.
   - ✅ Script npm per-environment: `db:migrate:staging|prod`, seed suite.
2. **Autentikasi & RBAC nyata** ✅ *(inti) / 📋 (approval flow)*:
   - ✅ Google SSO via GIS → verifikasi ID token server → cookie sesi HMAC httpOnly.
   - ✅ RBAC 8 level + **multi-role/rangkap jabatan** (precedensi + chips konteks).
   - ✅ Persona demo staging dari DB (`ENABLE_DEMO_PERSONAS`) + impersonate.
   - 📋 Self-registration berstatus PENDING → approval Komisi sebelum ACTIVE.
3. **Environment Staging** ✅ — branch cluster TiDB + `.env.staging` + script per-env; data dummy/seed hanya di staging.
4. **Jethro Engine (Regenerasi)** ✅ — kapasitas vs threshold 10, scan idle/mitosis/merger, split & merge dengan lineage, placement recommender, narasi AI Gemini, dasbor Komisi.
5. **Absensi mingguan** ✅ — input H/I/S/TK per anggota per tanggal (Mentor scoped grup binaan), sumber aturan idle.
6. **Struktur Pantatugas** ✅ — 5 fungsi + sub-divisi extensible, pohon interaktif landing, sync portal→TiDB.
7. **Google Drive role-gated** ✅ *(fase 1 read-only)* — Service Account + policy engine zona `[TAG]` di nama folder; **provisioning otomatis 36 folder dari TiDB** (`drive:provision`); audit sinkronisasi DB↔Drive untuk SUPERADMIN. Panduan: `drive-integration.md`.
7b. **Landing Story-First & Bilingual** ✅ — toggle EN|ID (default EN), copy naratif global, timeline kegiatan + countdown BAKU TAU 4.0 (5 Sep 2026 16:00 WIB), privasi nama publik (first name + inisial), pembersihan seluruh artefak prototype. Komite asli retreat 2026 (BOD + 7 PIC) di-seed ke struktur.
8. **Routing hash 4-route** ✅ — `#/beyonders · #/leaders · #/events · #/bulletin` (shareable + back-button, tanpa dependency). SEO/deep-link per-konten tetap 💡 (react-router saat go-live).
8b. **Join Flow & Gift Test** ✅ — waitlist dua tahap BAKU TAU, tes karunia internal 22 karunia (66 pernyataan), invite link personal/tim + approval Komisi, cached accounts.
9. **Testing otomatis** 💡 — unit test (Vitest) untuk engine/RBAC + E2E Playwright.
10. **CI/CD** 💡 — lint, build, test pada setiap push.

---

## Fase 2 — Ekosistem Bertumbuh 📋

11. **Upload Drive dari portal** 📋 — Marturia (dokumentasi) & Komisi (laporan): scope SA `drive`, endpoint multipart upload, kuota. Struktur folder fase 1 sudah mengantisipasi.
12. **Tenant Pria/Kaum Bapa (P/KB)** 📋 — replikasi ekosistem youth.
13. **Tenant Wanita/Kaum Ibu (W/KI)** 📋 — idem, komisi ibu.
14. **AI Gemini lanjutan** 🚧*(narasi jethro sudah jalan)*📋:
    - Asisten draf warta/renungan mingguan.
    - Ringkasan otomatis laporan monitoring → insight "suhu rohani" antar kelompok.

---

## Fase 3 — Jangkauan Lebih Luas 📋

15. **Komunitas & Rekreasional** 📋 — minat, bakat, musik, olahraga.
16. **Wilayah & Kolom Teritorial 1–12** 📋 — pemetaan jemaat per wilayah Cikarang dengan domain `kolom.gehc.page`.
17. **Notifikasi & komunikasi** 💡 — WhatsApp/email untuk follow-up idle & broadcast warta.

---

## Fase 4 — Maturasi Platform 💡

18. **PWA / mobile-friendly penuh** — akses offline warta & jadwal.
19. **Analitik dashboard** — tren kehadiran antar kelompok, grafik persembahan, heatmap partisipasi.
20. **Multi-bahasa** (ID/EN) untuk jemaat expat kawasan industri Cikarang.
21. **Audit log & keamanan** — riwayat perubahan data per user, backup otomatis.

---

## Prinsip Pengembangan

1. **Konten = milik pengurus**: setiap modul admin harus langsung tercermin di situs publik.
2. **Satu sumber kebenaran data**: TiDB untuk operasional; localStorage hanya fallback demo berversi (`gehc_*_v2`).
3. **RBAC tidak boleh dilemahkan**: resource baru wajib masuk matriks `canAccess()` + middleware server; izin Drive ikut matriks zona (`gdrive-policy.mjs`).
4. **Bahasa UI konsisten Indonesia**, istilah gerejawi GMIM dipertahankan.