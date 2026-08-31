# User Flow — GEHC Youth Ecosystem

Dokumentasi alur pengguna aplikasi gehc.page. Diperbarui mengikuti
`revision-v2-beyonders.md`, struktur pantatugas (`pantatugas.md`),
Google SSO nyata, dan Jethro Engine.

---

## 1. Persona, Peran & Multi-Role

| Level | Role | Akses inti |
|---|---|---|
| L1 | `SUPERADMIN` | Semua modul + Penguza/RBAC + Integrasi Drive (tim web) |
| L2 | `BPMJ` | Dasbor kesehatan pemuda — read-only |
| L3 | `KOMISI` | Executive: Jethro Engine (split/merger/placement/idle), CMS, struktur |
| L4 | `COMMITTEE` | Operasional: warta, kegiatan, struktur; lihat semua laporan; PIC sub-divisi |
| L5 | `MENTOR` | Absensi & laporan monitoring **grup binaannya saja** |
| L6 | `CO_MENTOR` | Menggantikan peran Mentor bila berhalangan |
| L7 | `MENTEE` | Read-only: profil grupnya, family tree, heritage, warta |
| L8 | `ALUMNI` | Login melihat riwayat/heritage; tidak memakan kuota grup aktif |

**Multi-role (rangkap jabatan)**: satu email Google boleh memegang banyak peran
(mis. Ketua Komisi sekaligus Mentor). Efektif role = precedensi tertinggi
(`SUPERADMIN > BPMJ > KOMISI > COMMITTEE > MENTOR > CO_MENTOR > MENTEE > ALUMNI`,
lihat `src/lib/roles.ts`); pengguna dapat mengganti konteks akses lewat
**chips peran** di dropdown persona Navbar.

---

## 2. Autentikasi

### Login Google SSO (nyata):

Navbar → dropdown persona → tombol "Sign in with Google"
→ GIS ID token → POST /api/auth/google → verifikasi + upsert user ke TiDB
→ cookie sesi httpOnly (7 hari) → role dimuat dari DB.
Email di SUPERADMIN_EMAILS otomatis menjadi SUPERADMIN saat login pertama.

### Mode demo staging (ENABLE_DEMO_PERSONAS=true):

Dropdown persona menampilkan akun inti + yang ter-link kelompok
(PIC sub-divisi tetap di DB namun tak memenuhi daftar — bisa via
POST /api/demo/impersonate). Klik persona = sesi server sungguhan,
sehingga seluruh endpoint RBAC ikut teruji tanpa setup Google.
JANGAN aktifkan flag ini di produksi!

Visibilitas switcher: hanya tampil saat demoMode aktif atau sudah login.
Tamu produksi melihat navbar bersih.

---

## 3. Flow Pengunjung Publik

### Routing hash 4 route (toggle EN|ID, default English):

- `#/beyonders` (default) · `#/leaders` · `#/events` · `#/bulletin`
- Label: Beyonders · Leaders/Pengurus · Events/Kegiatan · Bulletin/Warta
- Multi-tenant switcher DIHAPUS dari UI publik.

### Home (`#/beyonders` — default, murni kisah Beyonders):

HeroSection (EN default) → MarqueeStrip
GroupsCarousel [prioritas 1: 10 rumah + family tree]
RegenerationFlowSection (kisah multiplikasi)
VisualCollage

### `#/leaders` [prioritas 2]:

AboutSection ("Who We Are" + BOD asli: Theodore/Zhanon/Milithya
+ 1 Tim 4:12) · PantatugasShowcase · KomisiSection
(pohon hirarki + kartu pengurus; posisi terbuka = chip dashed)

### `#/events` [prioritas 3]:

EventsTimeline penuh (featured BAKU TAU 4.0 + countdown 12 Sep 2026
16.00 WIB; timeline lampau→kini) · MediaGallery (role-gated)

### `#/bulletin`:

WeeklyInfoSection (warta & renungan)

### Klik kartu grup → GroupDetailPage (overlay):

Family tree batch aktif (nama publik = first name + inisial)
Heritage (alumni + lineage) · Sejarah batchTab Kelompok → direktori lengkap; klik grup → GroupDetailPage:
Family tree batch aktif · Heritage (alumni + lineage) · Sejarah batch
▼

**Tab Pengurus = SATU halaman terpadu:**

Bagian 1: Pohon hirarki (BPMJ → Komisi → Penopang → 5 fungsi accordion)
Bagian 2: Kartu pengurus (komisi · penopang · lima fungsi & sub-divisi)
▼

MediaGallery (home) → foto live dari Google Drive GEHC:
Zona [PUBLIK] terbuka untuk tamu; zona lain mengikuti role
(detail matriks: drive-integration.md §4). Konten di luar role
tampil sebagai badge "Terbatas", bukan error.

---

## 4. Flow Portal per Peran

### PortalLayout (sidebar sesuai effective-role)

- Dashboard & Ringkasan [semua]
- Kelola Warta / Agenda [L1, L3, L4]
- Monitoring Grup [L1-L7]
  - Tab Absensi Mingguan 🆕 input H/I/S/TK per anggota per tanggal
    (Mentor scoped ke grup binaan; tersimpan TiDB attendance_records;
    menjadi sumber aturan idle 4 minggu)
- Jethro Engine 🆕 [L1, L2(read), L3, L4]
  - Kapasitas semua grup vs threshold 10
  - Jalankan Analisis → IDLE_FLAG / MITOSIS_ALERT / MERGER_SUGGESTION
  - Placement Recommender (distribusi newcomer ke slot kosong)
  - Aksi split (promote 2 mentee → grup baru) & merger
  - Follow-up idle → jadi ALUMNI / acknowledged / tutup
  - Narasi AI (Gemini) — ringkasan eksekutif rapat Komisi
- Kelola Struktur Komisi [L1, L3, L4] — fungsi pantatugas + subdivisi
  (setiap simpan otomatis sync ke TiDB via /api/db/sync-struktur)
- Pengguna & Matrix RBAC [L1]
- Integrasi Google Drive [L1]

---

## 5. Alur Bisnis Inti (Regenerasi)

```
Retreat (Gen-0) → kelompok mentoring terbentuk (maks 10 orang)
   → newcomer datang → Jethro Placement Recommender mengusulkan penempatan
   → grup penuh + mentee matang → alert MITOSIS → Komisi approve split
      (2 mentee dipromote, redistribute proporsional, lineage terekam)
   → mentor/co-mentor berhalangan → role shuffle (tanpa ganti akun)
   → anggota absen ≥4 minggu → auto-flag idle → follow-up/reposisi
   → pindah kota/negeri/menikah → protokol ALUMNI (keluar kuota, tetap di heritage)
   → beberapa grup menyusut serentak → saran MERGER antar generasi satu parent
```

---

## 6. Kelola Struktur (OrgChart Editor)

Portal → Struktur → dua tampilan:

Chart : BOD → Penopang → 5 Pantatugas; klik kartu = edit,
        tombol + per sub-divisi; centang 'Posisi terbuka'
        untuk slot kosong (dashed di landing).
Tabel : daftar datar utk edit teks cepat.
Simpan = auto-sync TiDB & landing page.

---

## 7. Auth & Onboarding — Login · Register · Event

### Route map (hash)

| Route | Fungsi |
|-------|--------|
| `#/login` | Masuk portal (Google / email+password) |
| `#/register` | Daftar membership Beyonders → `WAITING_POOL` |
| `#/event/bakutau` | Daftar kehadiran BAKU TAU (kontekstual) |
| `#/join?inv=CODE` | Undangan panitia (role dari invite) |
| `#/join?token=` | Legacy waitlist bridge |

Redirect: `#/join` → `#/register`; `#/join?event=bakutau` → `#/event/bakutau`.

### Register (membership umum)

`#/register` → Google atau Email → `POST /api/register/google|local`
  → `onboardingStatus: WAITING_POOL` + **WaitingPool**
  → portal gate (profil + karunia) → Komisi assign role

Flag `REGISTRATION_OPEN=false` menutup pendaftaran.

### BAKU TAU 4.0 (event kontekstual)

CTA dari `#/events` → `#/event/bakutau`

- **Sudah login:** form asal/domisili → `POST /api/events/baku-tau-4-0/register` (+ `EventAttendee` jika tabel ada)
- **Belum login:** counter panitia → pending session → buat akun → auto-sync
- **Event archived:** form ditutup, CTA disembunyikan

API: `GET /api/events/bakutau`, `POST …/register`, `POST …/claim`, `GET /api/me/baku-tau-registration`

Tanggal resmi: **12 September 2026, 15:00 WIB**

### Invite Link (komite/komisi):

Portal → Orang & Undangan → buat link (sekali-pakai / tim,
role dasar, maks pakai, kedaluwarsa) → bagikan.
Pendaftar: Google SSO → profil → status PENDING
Komisi setujui di tab "Menunggu Persetujuan" → ACTIVE.

### Cached Accounts:

akun yang pernah dipakai di perangkat tampil di layar login portal
& dropdown persona (maks 5, LRU).

### Daftar Mandiri via Google / Email (publik):

`#/register` → Google atau Email → akun `PENDING` + **WaitingPool** → portal gate.

### Akun Lokal (email+sandi):

 dibuat via link undangan; login lewat tab Email & Password di layar masuk portal.

---

## 8. Jemaat — Direktori & Hirarki Organisasi

Portal → **Jemaat** (Komisi):

- Filter BIPRA, kolom, domisili, minat, ulang tahun
- Filter **Jemaat | Simpatisan | Semua** (`membershipKind` — label direktori saja, tidak memblokir portal)
- Sub-filter Tim Kerja membaca cabang dari pohon `OrgNode` (BOD / Panca Tugas / BZP)
- Dropdown kolom menampilkan Diaken/Penatua dari `OrgAssignment`

Portal → **Kelola Hirarki** (Komisi):

- CRUD pohon per domain: `YOUTH`, `KOLOM`, `CHURCH` (future)
- Seed default: `npm run db:seed:org-tree`

Assign role (onboarding / Jemaat):

1. Wizard → domain → cabang → slot posisi
2. Beyonders: pilih grup + familyRole
3. API `POST /api/org/assignments` dual-write ke `RoleAssignment` (RBAC backward compat)