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
    - Insight gabungan absensi + self check-in suhu rohani (lihat item 22) → deteksi dini lebih akurat.

---

## Fase 2½ — Fungsi Pemuridan & Google Drive Sync 🌱

> Selain fitur teknis, fase ini menjawab pertanyaan pastoral: *platform ini menolong pemuda mana, dalam masalah apa?* Enam paket di bawah adalah kelompok kerja — bukan daftar fitur lepas. Kolom **Drive Sync** menunjukkan keterkaitan dengan Google Drive API (`drive-integration.md`).

### 22 · 🌱 Pertumbuhan Personal *(memperkuat DIDASKALIA)*

| Ide | Nilai Pastoral | Drive Sync | Ukuran |
|---|---|---|---|
| Self check-in **"suhu rohani" mingguan** — private, skala 1–5 | Mentor membaca *tren*, bukan hanya hadir/tidak → intervensi lebih manusiawi; Jethro dapat sinyal lebih kaya dari absensi saja | — | M |
| **Journal/devotional pribadi** + reading plan firman dari modul Kurikulum & Pembekalan | Ruang curahan privat; mentor melihat ringkasan *dengan izin*, bukan isi mentah | Arsip opsional ke `Ruang Anggota [MENTEE]` | M |
| **Sertifikat digital penyelesaian batch/modul** (PDF) | Apresiasi konkret yang bisa ditunjukkan — bahkan untuk CV | Auto-archive ke `Arsip Generasi [ALUMNI]` ⛽ | S |

### 23 · 🤝 Relasi & Kepedulian *(KOINONIA)*

| Ide | Nilai Pastoral | Drive Sync | Ukuran |
|---|---|---|---|
| **Prayer wall permohonan doa** per-grup + status "terjawab" | Merawat beban bersama; dokumentasi jawaban doa = bahan syukur retreat berikutnya | — | M |
| **Birthday & milestone otomatis** → notifikasi ke mentor/grup | Pemuda merasa diperhatikan; momen pastoral yang alami | — | S |
| **Event calendar personal** (subscribe `.ics` → Google Calendar) | Jadwal grup + warta menyatu di HP mereka tanpa harus buka web | — | S |

### 24 · 💼 Praktis Perantau *(DIAKONIA — spesifik konteks industri Cikarang)*

| Ide | Nilai Pastoral | Drive Sync | Ukuran |
|---|---|---|---|
| **Job board lowongan/magang** dari jemaat & rekanan gereja | Nilai tersedialah paling nyata bagi mahasiswa/pekerja muda rantau | — | M |
| **Info kost & carpool** untuk newcomer BAKU TAU | Menjawab masalah paling mendesak anak rantau: tempat tinggal & transportasi | Lampiran dokumen tips → folder `[PUBLIK]` | S |

### 25 · 📣 Kesaksian *(MARTURIA)*

| Ide | Nilai Pastoral | Drive Sync | Ukuran |
|---|---|---|---|
| **Testimoni wall** — draft mentee → approve Komisi → tampil di landing | Kesaksian jadi konten hidup; pemuda dilatih menuliskan karya Tuhan | Foto pendukung ditarik dari folder `[GROUP:x]` ✓ read-only | M |
| **Referral link personal** ("ajak teman") terhubung funnel BAKU TAU/waitlist | Mengubah setiap pemuda jadi penginjil dengan jejak data yang terukur | — | M |

### 26 · ⚙️ Regenerasi & Kepemimpinan *(memperkuat JETHRO + KSB)*

| Ide | Nilai Pastoral | Drive Sync | Ukuran |
|---|---|---|---|
| **Readiness score mentee** — kehadiran + modul + tenure → dasar promosi saat MITOSIS | Split tidak lagi subjektif; calon mentor baru tampak dari data | — | M |
| **Alumni network hub** — kota, profesi, toggle *"mau jadi mentor?"* | Pipeline mentor masa depan + jejaring karier lintas generasi | — | L |
| **Agenda builder rapat grup** — mentor susun agenda, mentee melihat | Standarisasi kualitas pemuridan; arsip otomatis untuk evaluasi KSB | Notulen tersimpan ke folder grup ⛽ | S |
| **Laporan PDF bulanan otomatis per divisi** → KSB/BPMJ | Hemat waktu sekretaris; BPMJ read-only jadi benar-benar terpakai | Arsip otomatis ke `Laporan Internal [KOMISI]` ⛽ | M |

### 27 · 🔗 Google Drive Sync *(enabler lintas-paket)*

| Item | Catatan | Ukuran |
|---|---|---|
| Upgrade SA scope → `drive` (write) + share sebagai **Content Manager** | Prasyarat semua baris ⛽ di atas. **Timing: aktifkan tepat sebelum membangun fitur arsip/upload** | S |
| Upload portal — Marturia dokumentasi & Komisi laporan (multipart) | Menindaklanjuti struktur folder fase 1 yang sudah siap | M |
| Auto-archive artefak hasil *generate* (laporan/sertifikat/notulen) | Sistem mengikuti zonasi folder — konsisten prinsip §6c | M |
| Per-group gallery di GroupDetailPage | Read-side murni — tercepat dieksekusi, cukup scope saat ini | S |
| Dashboard kuota & audit Drive untuk SUPERADMIN | Melengkapi audit sinkronisasi yang sudah ada | M |

> **Ketergantungan**: baris ⛽ menunggu item pertama tabel 27. Sisanya bisa jalan dengan infrastruktur Drive hari ini.

---

## Rekomendasi Prioritas Pasca Go-Live 🎯

1. **Self check-in suhu rohani** (22) — sinyal pastoral terbesar dengan biaya terkecil
2. **Testimoni wall** (25) — konten hidup untuk landing; cukup Drive read-only
3. **Birthday + calendar .ics** (23) — cepat dibangun, dampak "diperhatikan" langsung terasa

---

## Fase 3 — Jangkauan Lebih Luas 📋

15. **Komunitas & Rekreasional** 📋 — minat, bakat, musik, olahraga.
16. **Wilayah & Kolom Teritorial 1–12** 📋 — pemetaan jemaat per wilayah Cikarang dengan domain `kolom.gehc.page`.
17. **Notifikasi & komunikasi** 💡 — WhatsApp/email untuk follow-up idle & broadcast warta.
    - WA-gateway follow-up idle (Fonnte/official API) — mentor & Komisi otomatis diberi tahu.
    - Pengingat ulang tahun anggota ke grup masing-masing (lihat item 23).
    - Digest mingguan per-role: warta untuk MENTEE, ringkasan grup untuk MENTOR, health-score untuk KOMISI/BPMJ.

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
5. **Setiap fitur menjawab satu pertanyaan**: *menolong pemuda mana, dalam masalah apa?* — fitur tanpa jawaban pastoral ditunda, sebagus apa pun teknologinya.
6. **Data yang diprogram → TiDB; berkas yang disentuh manusia → Drive** (konsisten `drive-integration.md` §6c) — artefak hasil *generate* sistem (PDF laporan/sertifikat/notulen) mengikuti zonasi folder yang ada.