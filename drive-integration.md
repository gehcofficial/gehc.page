# Integrasi Google Drive — GEHC Youth (Role-Gated)

Panduan lengkap koneksi Google Drive via **Service Account** dengan
pembatasan akses per-role di layer aplikasi. Referensi arsitektur:
diskusi konsultasi "service account principle".

---

## 1. Konsep

- **Satu Service Account** (`drive.readonly`) mengakses seluruh folder root GEHC.
- **Izin per-role diputuskan server kita** (bukan native Google), berdasarkan
  **tag zona di dalam nama folder** — mis. `Event Gallery [PUBLIK]`.
- Prinsip: *least privilege* tanpa kelola N kredensial; pengurus non-teknis
  cukup menamai folder dengan benar untuk mengatur akses.

## 2. Setup Console (sekali jalan)

```
1. console.cloud.google.com → project "GEHC Youth"
2. APIs & Services → Library → "Google Drive API" → ENABLE
3. IAM & Admin → Service Accounts → CREATE
     nama: gehc-drive-reader   (role project: dilewati)
4. Keys → ADD KEY → JSON → download  ⚠️ rahasia, jangan commit
5. Salin client_email dari JSON
6. Google Drive GEHC → buat struktur folder (bagian 3)
   → Share folder ROOT ke client_email → peran VIEWER
7. Isi .env:
     GDRIVE_ROOT_FOLDER_ID=<ID bare dari URL folder>
     GOOGLE_APPLICATION_CREDENTIALS=./<nama-file>.json
8. Restart server → GET /api/drive/test → {"connected":true}
```

`.gitignore` sudah melindungi pola `gehc-*.json` & `*service-account*.json`.

## 3. Spesifikasi Struktur Folder

Tag ditulis dalam kurung siku pada nama folder. Anak mewarisi induk;
tag eksplisit pada anak me-narrowing.

```
ROOT_GEHC/
├── Event Gallery [PUBLIK]/          ← MediaGallery landing
├── Warta Publik [PUBLIK]/
├── Ruang Anggota [MENTEE]/          ← semua yang login
├── Kelompok Mentoring [MENTOR]/     ← WAJIB ada (audit)
│   ├── RUACH [GROUP:RUACH]/           ← mentor binaan + mentee grup itu
│   ├── AGAPE [GROUP:AGAPE]/
│   └── …10 grup…                      (nama = tabel `groups`, case-insensitive)
├── Liturgia [MENTOR]/               ← pantatugas (anak = subdivisi)
│   ├── Liturgi & Musik/  Pendoa/  Intercessor/
├── Didaskalia [MENTOR]/
│   └── Kurikulum & Pembekalan/
├── Koinonia [MENTOR]/
│   └── Program Persekutuan/  Public Relations (PR)/
├── Diakonia [MENTOR]/
│   └── Logistik/  Konsumsi/  Medis/
├── Marturia [MENTOR]/
│   └── Dokumentasi/  Desain & Publikasi/  Penginjilan/
├── Benzarpreneurship - BZP [MENTOR]/   ← usaha & dana (Kepala: Fladyna)
│   └── Merchandise/  Fundraising/  Donation/
├── Laporan Internal [KOMISI]/       ← output Jethro, arsip komisi
├── Ringkasan BPMJ [BPMJ]/           ← baca-only BPMJ
└── Arsip Generasi [ALUMNI]/         ← alumni tetap bisa mengunjungi
```

Aturan penting:
- Folder **tanpa tag** tidak dapat diakses siapa pun (audit akan menandai).
- Nama `[GROUP:X]` harus sama persis (case-insensitive) dengan `groups.name`.
- Sub-divisi anak folder pantatugas harus sama dengan `struktur_members.subdivision`.

## 4. Matriks Akses

| Tag zona | Tamu | MENTEE | MENTOR/CO | COMMITTEE | KOMISI | BPMJ | ALUMNI |
|---|---|---|---|---|---|---|---|
| `[PUBLIK]` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `[MENTEE]` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `[MENTOR]` | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `[COMMITTEE]` | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| `[KOMISI]` | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `[BPMJ]` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| `[ALUMNI]` | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| `[GROUP:<grp>]` | ✗ | grp sendiri | grp binaan | ✓ | ✓ | ✗ | ✗ |

SUPERADMIN melewati semua zona. Resolusi: `server/gdrive-policy.mjs`.

## 5. Endpoint

| Endpoint | Perilaku |
|---|---|
| `GET /api/drive/folders?parentId=` | daftar subfolder; tiap entri diberi `accessAllowed` + `zoneTag`; parent dicek policy |
| `GET /api/drive/files?folderId=` | daftar file dalam folder yang diizinkan |
| `GET /api/drive/file/:id/content` | stream konten; policy dicek via rantai induk file |
| `GET /api/drive/policy` | matriks zona vs user saat ini |
| `GET /api/drive/audit` *(SUPERADMIN)* | audit sinkronisasi DB ↔ Drive |

403 dikembalikan dengan alasan manusiawi; frontend menampilkan badge
**"Terbatas"** alih-alih error mentah.

## 6. Audit Sinkronisasi

Portal → Integrasi Google Drive → panel **Audit Sinkronisasi**:

- **Kelompok**: setiap `groups.status=ACTIVE` harus punya folder `[GROUP:<nama>]`
  di bawah folder Kelompok Mentoring.
- **Sub-divisi**: setiap `struktur_members.subdivision` per pantatugas harus
  punya folder anak bernama sama di bawah folder pillar.
- Laporan: `OK / HILANG (buat di Drive)`, plus deteksi folder `[GROUP:]`
  tak dikenal dan folder tanpa tag (setelah memperhitungkan warisan induk).

Alur kerja rutin pengurus: tambah grup/sub-divisi di portal → jalankan Audit
→ buat folder yang HILANG di Drive sesuai hint → Audit ulang sampai hijau.

## 6b. Provisioning Otomatis (buat folder sekaligus)

```bash
npm run drive:provision
```

- Prasyarat: share folder ROOT ke service account sebagai **Content Manager**
  (Viewer tidak bisa membuat folder).
- Sumber struktur = **database aktif**: grup aktif → `[GROUP:x]`, subdivisi
  pantatugas → subfolder pillar, plus zona statis. Total ±36 folder.
- Idempotent — aman diulang kapan pun (misal setelah tambah grup baru).
- Scope tulis hanya dipakai script ini; runtime aplikasi tetap readonly.

## 6c. Google Drive vs TiDB — Pembagian Peran

| | TiDB Cloud | Google Drive |
|---|---|---|
| Isi | Data operasional: users/roles, grup & anggota, absensi, laporan, notifikasi Jethro, konten teks | Berkas manusiawi: foto event, PDF warta, modul, PPT, arsip media |
| Karakter | Relasional, query/transaksi, berubah tiap minggu | Blob besar, dikelola via UI Drive |
| Diakses | Server saja (kredensial rahasia) | Service account + anggota lewat portal |

Pola hybrid: URL file disimpan di kolom TiDB (`bannerUrl`), filenya di Drive.
**Data yang diprogram → TiDB; berkas yang disentuh manusia → Drive.**

## 7. Roadmap Fase 2 (belum dibangun)

> Rencana lengkap kini dipusatkan di **`roadmap.md` → Fase 2½, item 27 "Google Drive Sync"** (enabler + 4 item turunannya). Bagian di bawah tetap valid sebagai ringkasan teknis.

- **Upload dari portal** untuk Marturia (dokumentasi) & Komisi (laporan):
  ganti scope SA menjadi `drive` (bukan readonly), endpoint multipart upload,
  kuota & anti-spam. Struktur folder fase 1 sudah mengantisipasi ini.
- Preview PDF modul Didaskalia langsung di halaman monitoring mentor.

## 8. Setup Google Auth (Client ID untuk SSO)

```
1. console.cloud.google.com → OAuth consent screen
   • User Type: External → isi App name & support email → Save
2. Credentials → Create Credentials → OAuth client ID
   • Application type: Web application
   • Authorized JavaScript origins:
       http://localhost:3000        (dev)
       https://<domain-produksi>    (nanti)
   Authorized redirect URIs:        ← WAJIB untuk alur "pilih akun"
       http://localhost:3000/api/auth/google/callback
       https://<domain-produksi>/api/auth/google/callback
5. Salin Client ID + Client Secret → .env:
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-…
3. Salin Client ID → .env: GOOGLE_CLIENT_ID=...apps.googleusercontent.com
4. Restart server → /api/auth/config harus configured:true
```

## 9. Paritas Staging ⇄ Production

Sama seperti TiDB (dua cluster), Drive memakai dua root terpisah:

| Env | GDRIVE_ROOT_FOLDER_ID | Isi |
|---|---|---|
| dev/staging (.env, .env.staging) | root STAGING | bebas uji API/provisi |
| production (.env.production) | root PRODUCTION | data publik nyata |

- Provisi per lingkungan:
  `npm run drive:provision`          → root di .env (staging)
  `npm run drive:provision:prod`     → root di .env.production
- Kedua root wajib di-share ke service account sebagai Content Manager.
- Script selalu mencetak root mana yang dipakai — cek sebelum Enter.