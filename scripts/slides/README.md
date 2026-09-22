# Slide presentasi GEHC.page (ProPresenter)

4 gambar slide **1920×1080** untuk slideshow ProPresenter, dihasilkan dari template HTML + screenshot situs live.

## Hasil

| File | Isi |
|---|---|
| `public/presenter/01-hub-depan.png` | Halaman depan `gehc.page` (mockup laptop) + himbauan membuka |
| `public/presenter/02-hub-qr.png` | QR `gehc.page` + "Segera hadir": portal panel gereja, BIPRA, Kolom & Wilayah |
| `public/presenter/03-youth-depan.png` | Halaman depan `youth.gehc.page` (mockup laptop) + himbauan mendaftar |
| `public/presenter/04-youth-qr.png` | QR daftar `youth.gehc.page` + status jemaat terdaftar + himbauan install & lengkapi profil |

> Catatan: `public/` ikut ter-deploy, jadi PNG ini bisa diakses publik di
> `https://youth.gehc.page/presenter/01-hub-depan.png` (dst.).

## Cara mengubah teks/angka

Semua naskah dan angka ada di **`slides-data.json`** — sunting di situ, lalu render ulang.

```powershell
node scripts/render-slides.mjs            # render pakai screenshot yang sudah ada
node scripts/render-slides.mjs --refresh  # ambil ulang screenshot situs live dulu
```

## Struktur

```
scripts/
  render-slides.mjs          # skrip render (Playwright + sharp + jsqr)
  slides/
    slide.css                # gaya slide (palet & font dari docs/design/design.md)
    slides-data.json         # naskah + angka (EDIT DI SINI)
    01-hub-depan.html        # template slide 1
    02-hub-qr.html           # template slide 2
    03-youth-depan.html      # template slide 3
    04-youth-qr.html         # template slide 4
    assets/                  # aset hasil (tidak ikut deploy)
      hub-desktop.png        # screenshot live gehc.page (2880×1800)
      youth-desktop.png      # screenshot live youth.gehc.page
      qr-hub-large.png       # QR gehc.page, 1276×1276 + quiet zone
      qr-youth-large.png     # QR youth.gehc.page, 1276×1276 + quiet zone
```

## Detail teknis

- **QR** berasal dari `public/media/qr-hub.png` (`https://gehc.page`) dan
  `public/media/qr-daftar-youth.png` (`https://youth.gehc.page/#/register`),
  diperbesar dengan **nearest-neighbor** (modul tetap tajam) + quiet zone 88px.
  Skrip **memverifikasi ulang** hasilnya dengan `jsqr` — render akan gagal bila QR tidak terbaca.
- **Screenshot** diambil pada viewport 1440×900 dengan `deviceScaleFactor: 2`
  (output 2880×1800), animasi & scrollbar dimatikan agar hasil stabil.
- **Font** diambil dari Google Fonts (Playfair Display + Plus Jakarta Sans) — butuh internet saat render.
- Angka statistik di slide 4 adalah **snapshot**; label tanggal diambil dari `snapshotDate` pada JSON.
  Perbarui angkanya secara berkala (mis. tiap bulan) lalu render ulang.
