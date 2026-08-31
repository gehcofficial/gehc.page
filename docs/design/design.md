# Design System — GEHC Youth Ecosystem

Dokumen bahasa visual & desain untuk portal digital GMIM Eben Haezer Cikarang (GEHC), fokus utama pada Komisi Pelayanan Pemuda.

---

## 1. Konsep Desain

Gaya keseluruhan: **Editorial Magazine meets Warm Minimalism** — terinspirasi majalah/editorial modern dengan nuansa hangat, bersih, dan "humanist", bukan dashboard SaaS dingin.

Ciri khas:
- Latar krem/off-white hangat (`#FAF9F5`), bukan putih murni.
- Tipografi serif display (Playfair Display) dipadukan sans modern (Plus Jakarta Sans).
- Aksen gradien merah-oranye energik sebagai identitas brand GEHC Youth.
- Footer gelap melengkung (curved) bergaya editorial.
- Elemen gerak halus: marquee strip berjalan, animasi scroll-reveal via `motion`.

## 2. Palet Warna

### Warna Dasar (didefinisikan di `src/index.css`)

| Token | Hex | Fungsi |
|---|---|---|
| `--page-bg` | `#FAF9F5` | Latar utama halaman (warm off-white) |
| `--panel-bg` | `#F0EFEB` | Panel / section sekunder |
| `--soft-card` | `#E9E8E4` | Kartu soft / blok abu hangat |
| `--soft-card-2` | `#F4F3EF` | Kartu soft varian lebih terang |
| `--text` | `#1B1B1B` | Teks utama |
| `--muted` | `#8C8880` | Teks sekunder / meta |
| `--muted-light` | `#BDBAB2` | Teks tersier / placeholder |
| `--line` | `#D9D7D0` | Border & garis pemisah |
| `--black` | `#181818` | Blok hitam (navbar, footer) |
| `--deep-black` | `#151515` | Hitam pekat (footer editorial) |
| `--white-card` | `#FFFDF8` | Kartu putih hangat |

### Warna Aksen & Brand

- **Gradien logo GEHC:** `#FF416C → #FF4B2B` (lingkaran "GEHC" di navbar/mobile bar).
- **Selection highlight:** `#181818` teks putih (global), `#FF416C` di area publik App.tsx.

### Warna Identitas 10 Kelompok Pemuda

Dipakai konsisten di kartu kelompok (publik) dan modul monitoring (portal):

| Kelompok | Warna | Ikon Material Symbols |
|---|---|---|
| Avodah | `#FF416C` | `volunteer_activism` |
| Agape | `#E94057` | `favorite` |
| Shalom | `#2A81FF` | `spa` |
| Hesed | `#8A2387` | `all_inclusive` |
| Kairos | `#F27121` | `hourglass_top` |
| Logos | `#00B4D8` | `menu_book` |
| Metanoia | `#059669` | `autorenew` |
| Ruach | `#7C3AED` | `air` |
| Dunamis | `#DC2626` | `bolt` |
| Echad | `#0D9488` | `groups` |

## 3. Tipografi

Dimuat via Google Fonts di `index.html`:

| Font | Peran |
|---|---|
| **Plus Jakarta Sans** (300–800 + italic) | Font tubuh utama & UI (default `body`) |
| **Inter** (300–800) | Pendukung angka/label teknis & UI padat |
| **Playfair Display** (600–700 + italic) | Heading display editorial (hero, manifesto, judul besar) |

Skala umum: heading display sangat besar (text-5xl/6xl+ dengan leading ketat), body 14–16px, label meta 10–12px uppercase tracking lebar.

## 4. Ikonografi

Dua sistem ikon dipakai:
1. **Lucide React** (`lucide-react`) — ikon UI/portal: navigasi sidebar, tombol aksi, status.
2. **Material Symbols Outlined** (Google Fonts, variable axis) — ikon identitas kelompok & ornamen publik.

## 5. Komponen & Pola UI

### Layout
- **Public site** (`App.tsx`): Navbar gelap fixed → section vertikal → Footer hitam melengkung.
- **Portal** (`PortalLayout.tsx`): Sidebar navigasi kiri (desktop) / top-bar hamburger (mobile) + konten; badge "Superadmin Only" pada menu terbatas.

### Pola yang berulang
- **Kartu konten**: sudut membulat besar (rounded-2xl/3xl), border tipis `#D9D7D0`, hover lift/shadow halus.
- **Badge & pill**: pill warna solid per-kelompok, badge status tenant ("Active MVP", "Next Ecosystem", "Planned").
- **Toast notification**: pojok layar, tipe success/error/info/warning, auto-dismiss ±4.5 detik (`ToastContainer.tsx`).
- **Marquee**: strip teks berjalan infinite (CSS `@keyframes marquee`, pause on hover) — `MarqueeStrip.tsx`.
- **Form monitoring**: input bertingkat dengan stepper jumlah, pilihan "suhu rohani" berbentuk chip berwarna.
- **Tabel admin**: daftar anggota/pengguna dengan avatar lingkaran, aksi edit/hapus inline, modal tambah/edit.

### Responsif
- Mobile-first Tailwind; sidebar portal berubah menjadi drawer; grid kartu collapse 3→2→1 kolom.

## 6. Motion & Interaksi

- Library `motion` (Framer Motion v12) untuk reveal-on-scroll dan transisi antar-view.
- Durasi animasi singkat (150–350ms), easing lembut; tidak ada animasi mengganggu bacaan.
- Semua aksi CRUD memberi feedback langsung lewat toast (prinsip "immediate feedback").

## 7. Aksesibilitas & Konvensi

- Kontras teks utama `#1B1B1B` di atas `#FAF9F5` sangat tinggi (>15:1); muted digunakan hanya untuk meta.
- Bahasa antarmuka: **Bahasa Indonesia** dengan istilah rohani gerejawi GMIM (warta, persekutuan, penggembalaan).
- Format tanggal `YYYY-MM-DD`, jam selalu menyertakan `WIB`.