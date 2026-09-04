# Peta visual website — Google Drive

Semua gambar/video publik diikat ke folder Drive lewat **stem nama file tetap**.
Timpa file dengan stem yang sama (`.jpg` / `.png` / `.webp`); website tidak perlu diubah.

Folder induk: **`Website Visual [PUBLIK]`**  
Lookup: `GET /api/media/slots` — prioritas **static CDN** (`public/visuals/`) lalu fallback Drive API.

Google One / My Drive **didukung**. Service account hanya **membaca**. Unggah memakai kuota akun Google One (OAuth).

## Alur publish visual (disarankan)

### Satu tombol dari portal (disarankan)

1. Marturia/Mentor **timpa file di Drive** (stem nama tetap, cth. `kelompok/cover-echad.jpg`).
2. Portal → **Panduan Media (Drive)** → pilih folder → **Publish ke website**.
3. GitHub Actions: `drive:pull-visuals` → commit `public/visuals/` → push → Vercel deploy (~1–3 menit).

**Setup sekali (Tim Tech):**

| Lokasi | Variabel |
|--------|----------|
| Vercel preview + production | `GITHUB_PUBLISH_TOKEN` (PAT: repo + workflow) |
| Vercel preview + production | `GITHUB_REPO=gehcofficial/gehc.page` |
| GitHub repo secrets | `GDRIVE_ROOT_FOLDER_ID` (Drive **staging**), `GDRIVE_ROOT_FOLDER_ID_PRODUCTION` (Drive **prod**), `GOOGLE_SERVICE_ACCOUNT_JSON` |

Publish → Staging menarik Drive staging. Publish → Production (`main`) menarik Drive prod. Jangan ganti `GDRIVE_ROOT_FOLDER_ID` ke root prod.

Sync token portal dari `.env` lokal: `npm run env:sync-github-publish` lalu redeploy.

Workflow: `.github/workflows/publish-visuals.yml`

### Manual (CLI)

1. Marturia/Komisi **timpa file di Drive** (stem nama tetap).
2. Tim Tech: `npm run drive:pull-visuals:staging` (atau `:prod`).
3. Commit `public/visuals/` + push → deploy.
4. Website langsung pakai `/visuals/...` dari CDN Vercel (cepat, tanpa proxy Drive).

Tanpa langkah 2–3, website tetap bisa baca Drive langsung (~60 detik cache, lebih lambat).

## Perintah staging / production

```powershell
npm run drive:provision          # buat folder bila belum ada (SA boleh)
npm run drive:auth               # sekali — login pemilik Drive (Google One)
npm run drive:seed-visuals       # unggah ke root STAGING (.env)
npm run drive:seed-visuals:prod  # unggah ke root PRODUCTION (.env.production)
npm run drive:copy-visuals:staging-to-prod   # timpa Unsplash prod dengan foto staging
npm run drive:pull-visuals       # tarik Drive → public/visuals/ + manifest
npm run drive:pull-visuals:staging -- --folder=landing   # partial: satu subfolder saja
npm run drive:pull-visuals:staging -- --folder=kelompok
```

Redirect URI yang harus ada di OAuth client (salah satu cukup):

- `http://localhost:8787/api/auth/google/callback` (dipakai `npm run drive:auth` jika server `dev` jalan)
- `http://127.0.0.1:8765/drive-auth/callback` (listener cadangan)

Token tersimpan di `.gdrive-user-token.json` (gitignore) atau `GDRIVE_USER_REFRESH_TOKEN`.

**Token OAuth pemilik sama** di staging dan production. Hanya `GDRIVE_ROOT_FOLDER_ID` yang berbeda. Salin ke Vercel: `npm run env:sync-gdrive-token`.

Jika OAuth gagal:

```powershell
npm run drive:seed-visuals:local
```

Lalu seret isi `scripts/visual-placeholders/` ke `Website Visual [PUBLIK]` (stem nama jangan diubah).

Salinan peta: `_PETA-VISUAL.txt` di folder visual.

## Slot tetap

| File di Drive (stem) | Dipakai di |
|---|---|
| `brand/logo-gehc` | Logo GEHC (navbar, footer, portal) |
| `landing/01-hero-banner` | Hero Beyonders (`HeroSection`) |
| `landing/02-collage-worship` | VisualCollage kiri atas |
| `landing/03-collage-community` | VisualCollage kanan atas |
| `landing/04-collage-music` | VisualCollage tengah kanan |
| `landing/05-collage-study` | VisualCollage kiri bawah |
| `landing/06-collage-friends` | VisualCollage kanan bawah |
| `landing/07-collage-portrait` | Fallback foto testimoni |
| `landing/08-hero-video` | Opsional — video Hero |
| `warta/01-banner-default` | Banner warta jika edisi tidak punya PNG |
| `kegiatan/01-banner-default` | Banner kegiatan default |
| `kegiatan/baku-tau-4` | Kartu unggulan BAKU TAU 4.0 |
| `benzarpreneurship/01-hero` | Header halaman Benzarpreneurship |
| `benzarpreneurship/02-product-placeholder` | Produk tanpa foto |
| `benzarpreneurship/03-qris` | QRIS checkout |
| `kelompok/cover-{nama}` | Cover 10 rumah di carousel |
| `panca/cover-liturgia` … `cover-marturia` | Cover pillar di landing + Panel Divisi |
| `panca/cover-benzarpr` | Cover BZP |
| `panca/cover-bod` | Cover BOD Tim Kerja |
| `pengurus/{slug}` | Foto pengurus (override inisial) |
| `testimoni/{slug}` | Foto penulis testimoni |

Slug = nama tanpa gelar, huruf kecil, spasi jadi `-`.  
Contoh: `Pnt Stevania Hadinda` → `stevania-hadinda.png`.

## Siapa mengelola apa

Bukan semua aset landing diurus admin. Tag zona `[PUBLIK]` dll. tetap di nama folder Drive (ACL); portal menampilkan nama tanpa kurung siku.

| Aset | Folder Drive | Dikelola | Input dari |
|---|---|---|---|
| Logo GEHC | `Website Visual/brand/` | Komisi | Marturia (file PNG transparan) |
| Hero, collage | `Website Visual/landing/` | Marturia (Desain) | Komisi (arah identitas) |
| Banner warta default | `Website Visual/warta/` | Marturia | Didaskalia (jadwal edisi) |
| Foto edisi warta | `Warta Publik/…/foto/` | Marturia (Dokumentasi) | Didaskalia (judul & tanggal folder) |
| Naskah warta | CMS TiDB | Didaskalia | Komisi (persetujuan bila perlu) |
| Banner kegiatan | `Website Visual/kegiatan/` | Marturia | PIC event / Koinonia |
| Benzarpreneurship | `Website Visual/benzarpreneurship/` | BZP | Bendahara |
| Cover rumah | `Website Visual/kelompok/` | Mentor/co rumah + KOMISI | backup `[GROUP:x]/Cover/` |
| Cover panca / BOD | `Website Visual/panca/` | PIC/HoD divisi; BOD = Ketua Tim Kerja | Panel Divisi |
| Foto pengurus | `Website Visual/pengurus/` | Komisi | — |
| Folder event `[EV:…]` | di bawah pillar | PIC divisi | Rundown Liturgia, konsumsi Diakonia, publikasi Marturia |

POST ke situs **selalu** dual-write: timpa stem publik + salin arsip ke folder pemilik. Bukti bayar, invoice, draf kesaksian **tidak** masuk `Website Visual [PUBLIK]`.

Stem hanya boleh diubah lewat portal (`POST /api/media/slots/:folder/:stem`) jika terdaftar di `VISUAL_SLOTS` / registry `drive-ownership.mjs`.

## Warta vs galeri acara

Warta edisi tetap di `Warta Publik [PUBLIK]/YYYY-MM-DD-judul/foto/`.

Halaman `#/gallery` adalah **arsip acara** (tab nama · MM-YYYY), bukan redirect warta. Tamu melihat 3–5 preview tersemat; set lengkap + unduh butuh login.

```
Marturia [MENTOR]/Dokumentasi Visual/Arsip Acara/{YYYY-MM-DD judul}/
```

## Endpoint

| Endpoint | Isi |
|---|---|
| `GET /api/media/slots` | Semua slot by filename |
| `POST /api/media/slots/:folder/:stem` | Dual-write stem terdaftar (OAuth pemilik) |
| `POST /api/groups/:id/cover` | Cover rumah + backup `Cover/` |
| `GET /api/media/landing` | Subset landing (kompat lama) |
| `GET /api/media/warta-album?publishedAt=&title=` | Foto edisi warta |
