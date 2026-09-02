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
| Vercel staging env | `GITHUB_PUBLISH_TOKEN` (PAT: repo + workflow) |
| Vercel staging env | `GITHUB_REPO=gehcofficial/gehc.page` |
| GitHub repo secrets | `GDRIVE_ROOT_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` |

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
npm run drive:pull-visuals       # tarik Drive → public/visuals/ + manifest
npm run drive:pull-visuals:staging -- --folder=landing   # partial: satu subfolder saja
npm run drive:pull-visuals:staging -- --folder=kelompok
```

Redirect URI yang harus ada di OAuth client (salah satu cukup):

- `http://localhost:8787/api/auth/google/callback` (dipakai `npm run drive:auth` jika server `dev` jalan)
- `http://127.0.0.1:8765/drive-auth/callback` (listener cadangan)

Token tersimpan di `.gdrive-user-token.json` (gitignore) atau `GDRIVE_USER_REFRESH_TOKEN`.

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
| Cover rumah | `Website Visual/kelompok/` | Mentor rumah | Marturia (bantuan desain) |
| Foto pengurus | `Website Visual/pengurus/` | Komisi | — |
| Folder event `[EV:…]` | di bawah pillar | PIC divisi | Rundown Liturgia, konsumsi Diakonia, publikasi Marturia |

## Warta = pengganti Galeri publik

Halaman `#/gallery` dialihkan ke `#/bulletin`.

```
Warta Publik [PUBLIK]/YYYY-MM-DD-judul-singkat/foto/*
```

Galeri per-rumah di halaman detail grup tetap. Tab Galeri portal Marturia untuk unggah internal event.

## Endpoint

| Endpoint | Isi |
|---|---|
| `GET /api/media/slots` | Semua slot by filename |
| `GET /api/media/landing` | Subset landing (kompat lama) |
| `GET /api/media/warta-album?publishedAt=&title=` | Foto edisi warta |
