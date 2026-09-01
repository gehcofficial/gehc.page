# Peta visual website — Google Drive

Semua gambar/video publik diikat ke Shared Drive lewat **nama file tetap**.
Timpa file di Drive dengan nama yang sama; website tidak perlu diubah.

Folder induk: **`Website Visual [PUBLIK]`**  
Lookup: `GET /api/media/slots` (bukan urutan file).

## Perintah staging

```powershell
npm run drive:provision          # buat folder bila belum ada
npm run drive:seed-visuals       # unggah placeholder berlabel + _PETA-VISUAL.txt
```

Prasyarat: `GDRIVE_ROOT_FOLDER_ID` + service account sebagai **Content Manager** pada **Shared Drive** (bukan folder My Drive yang di-share — SA tidak punya kuota unggah file).

Jika unggah Drive gagal, script menulis salinan lokal:

```powershell
npm run drive:seed-visuals:local
```

Lalu seret isi `scripts/visual-placeholders/` ke folder `Website Visual [PUBLIK]` (nama file jangan diubah).

Opsional: `GDRIVE_IMPERSONATE` (domain-wide delegation) agar unggah memakai kuota user Workspace.

Salinan peta yang sama ada di Drive: `_PETA-VISUAL.txt`.

## Slot tetap

| File di Drive | Dipakai di |
|---|---|
| `landing/01-hero-banner.png` | Hero Beyonders (`HeroSection`) |
| `landing/02-collage-worship.png` | VisualCollage kiri atas |
| `landing/03-collage-community.png` | VisualCollage kanan atas |
| `landing/04-collage-music.png` | VisualCollage tengah kanan |
| `landing/05-collage-study.png` | VisualCollage kiri bawah |
| `landing/06-collage-friends.png` | VisualCollage kanan bawah |
| `landing/07-collage-portrait.png` | Fallback foto testimoni |
| `landing/08-hero-video.mp4` | Opsional — video Hero (unggah sendiri) |
| `warta/01-banner-default.png` | Banner warta jika edisi tidak punya PNG |
| `kegiatan/01-banner-default.png` | Banner kegiatan default |
| `kegiatan/baku-tau-4.png` | Kartu unggulan BAKU TAU 4.0 |
| `benzarpreneurship/01-hero.png` | Header halaman Benzarpreneurship |
| `benzarpreneurship/02-product-placeholder.png` | Produk tanpa foto |
| `benzarpreneurship/03-qris.png` | QRIS checkout |
| `kelompok/cover-{nama}.png` | Cover 10 rumah di carousel (`agape` … `shalom`) |
| `pengurus/{slug}.png` | Foto pengurus (override inisial) |
| `testimoni/{slug}.png` | Foto penulis testimoni |

Slug = nama tanpa gelar, huruf kecil, spasi jadi `-`.  
Contoh: `Pnt Stevania Hadinda` → `stevania-hadinda.png`.

## Warta = pengganti Galeri publik

Halaman `#/gallery` dialihkan ke `#/bulletin`.

Foto/video edisi:

```
Warta Publik [PUBLIK]/YYYY-MM-DD-judul-singkat/foto/*
```

Tampil di detail kartu Warta. Galeri per-rumah di halaman detail grup **tetap** (folder `Foto Kegiatan` grup). Tab Galeri portal Marturia tetap untuk unggah internal.

## Endpoint

| Endpoint | Isi |
|---|---|
| `GET /api/media/slots` | Semua slot by filename |
| `GET /api/media/landing` | Subset landing (kompat lama) |
| `GET /api/media/warta-album?publishedAt=&title=` | Foto edisi warta |
