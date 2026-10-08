# Studio Didaskalia — SOP Mingguan Tim & HOD

> Alur baku: perikop → MD tim (Service + RHB) → parse & terapkan verbatim → AI lengkapi → HOD setujui → publish.
> Prinsip: **MD tim = sumber kebenaran** (sistem menyalin kata-per-kata, bukan memparafrase); AI = pelengkap, tim menyunting, HOD memutuskan.

## 1. Peran tim (HOD + anggota)

1. **HOD/tim menetapkan 2 perikop**: Fundamental Firman (jangkar tema) + Kitab/Bagian Fokus (bacaan progresif 7 hari).
2. **Anggota menulis MD mingguan** mengikuti checklist §2b (MD Service 4 bagian + MD RHB 7 Path), dengan ilustrasi kontekstual (kuliah/kerja/kos/relasi) dan aplikasi di tempatnya.
3. **Outline ditempel sebagai teks diskusi** di tab Diskusi Studio (scope Umum, atau scope Path bila spesifik hari itu). Bukan file — supaya AI membacanya.
4. Centang **"Pakai diskusi internal"** wajib ON saat enrich.

## 2. Klik AI sesuai kebutuhan

| Tombol | Dipakai saat |
|---|---|
| Susun draf 7 Path + khotbah | Awal pekan / susun ulang total (ikut pola pekan). Draf dibuat per hari (4+3) + khotbah terpisah — gagal 1 hari tak menggugurkan lain |
| Perkaya dengan diskusi | Draf ada + diskusi terisi; **satu kali per pekan** (generasi >3 = sinyal input kurang). Dijalankan per hari + khotbah; catatan >8000 char dipotong dari yang terlama (ada peringatan) |
| Ringkasan Khotbah | Refresh metode/bigIdea/slide saja (outline tetap verbatim MD) |
| AI + PDF Pembekalan | Jalan pintas: draf lalu langsung unduh PDF (tanpa terbit) |
| Isi dari AI (tab Draft Sesi) | Sesudah tema/firman fix: isi form sesi hari-H |

### 2b. Memahami peringatan AI (toast kuning + meta pengajuan)

| Peringatan | Artinya | Aksi |
|---|---|---|
| `Path 2, 5 gagal` | Hari itu gagal di semua model — dipakai versi lama | Ulangi enrich (sering berhasil di percobaan ke-2) atau isi manual hari itu |
| `Path 3 kepotong limit` | Output terpotong — periksa kelengkapan sebelum approve | Bandingkan diff Path 3; tolak bila kosong |
| `N karakter catatan dipotong` | Catatan terlama di luar cap 8000 char tidak dibaca AI | Pindahkan poin penting ke atas / ringkas catatan lama |
| `AI gagal memperkaya draf: ...` + nama model | Semua model gagal (bukan salah input) | Tunggu ±1 menit (limit Groq per menit), lalu Coba lagi; bila OpenAI yang gagal, cek `/api/ai/health` |

## 2a. Skenario MD mingguan (standar literal — berlaku semua pekan)

Tim menulis 2 file MD per pekan (lihat checklist §2b), lalu di Studio:

1. **Tempel MD Service** di Input Inti → `Parse & simpan acuan` (wajib valid: 3 info + 4 outline; bila tidak, sistem menyebut bagian yang hilang — lengkapi dulu) → `Terapkan ke Ringkasan`. Outline menjadi **verbatim MD** dan terkunci dari parafrase AI.
2. **Tempel MD RHB** → `Parse & simpan acuan` (wajib 7/7 Path) → `Terapkan ke 7 Path`.
3. Isi Fundamental Firman (ayat jangkar) + Kitab/Bagian Fokus; **metode boleh dikosongkan** — AI memilih sendiri 2–3 yang paling cocok (hanya mengisi metode/bigIdea, tidak menulis ulang outline).
4. Klik `Ringkasan Khotbah` bila perlu refresh → periksa diff pengajuan → enrich sekali bila perlu → `Ilustrasikan per bagian` (4 gambar kontekstual; kuota ilustrasi 8/pekan, cover terpisah kuota 3) → 3 caption (RHB / Pembekalan / Khotbah) → approval HOD → publish doc 02 (+01 bila berubah).
5. MD mingguan tersimpan di pekan itu saja (`sourceMd`) — tidak mencemari knowledge global. Knowledge aktif cukup FORMAT global.
6. Riwayat versi tersimpan di tiap pengajuan — salah langkah bisa undo (kecuali reset kuota manual, catat di HANDOFF).

## 2b. Checklist MD tim (syarat parser + konvensi highlight)

**MD Service** (`For Service_<tanggal>.md`) — boleh MD bersih (bungkus Python `md_content` tetap terbaca, tapi tidak disarankan):
- `## A. Informasi Sesi` memuat ketiganya: **Tema**, **Teks Utama** (khotbah Serving Day), **Teks Jangkar** (tema mingguan). Salah satu hilang = parse gagal.
- 4 bagian berurutan: **Pengantar** → **Bedah Teologis** (dikenali juga: "The Great Exchange"/"Pertukaran Besar") → **Jembatan** → **Kesimpulan**. Satu hilang = parse gagal.
- Penanda highlight (opsional, otomatis jadi treatment web + PDF):
  - `> "kutipan" (Ref Ayat)` → blok Firman besar + chip referensi.
  - `Poin Utama bagi Anak Muda: ...` / `Ingatlah: ...` → kotak emas takeaway.
  - `Bukan berarti ...` / `Sering disalahpahami ...` → kotak pelurusan.
  - `**tebal**`, `*miring*`, `#### A./B./C.`, `---` pemisah (pemisah di akhir bagian tidak menjadi slide).

**MD RHB** (`For RHB_<tanggal>.md`): 7× `### Path N: Judul Inggris (2–5 kata)` + `**Scripture:** ref` + narasi + `> jembatan 1 kalimat ke hari berikut`. Kurang dari 7 / Scripture kosong = parse gagal.

**Batas sistem yang perlu diketahui penulis:**
- Slide web: ≤9 baris estimasi & ≤5 bullet per slide, tanpa judul ganda (cukup header `Outline · no + judul`), slide berisi pemisah saja otomatis dibuang. Panjang tetap → slide bertambah, bukan teks dipotong.
- Cetak: foto dipertahankan + teks tetap terang; PDF Unduh = dokumen terang per bagian.
- Prompt gambar memakai 400 karakter pertama tiap bagian + gaya simbolis-damai (kata mentah pemicu moderasi dipangkas otomatis).

## 3. Sebelum HOD menyetujui (wajib baca ringkasan pengajuan)

- **"RHB terisi X/7 hari"** harus 7/7. Tolak bila ada section kosong.
- **Waspada "PERINGATAN: isi RHB menyusut"** — berarti usulan AI lebih tipis dari versi berjalan; tolak atau minta revisi (tambah catatan dulu).
- **Path 1 = Minggu … Path 7 = Sabtu** — bila ada label menyimpang, tolak (sistem menormalkan otomatis, tapi periksa).
- Info diagnosis (model AI, kepotong/tidak, panjang prompt) tercatat di tiap pengajuan & riwayat.

## 4. Pengetahuan tim (tab Pengetahuan)

- Dokumen dibaca AI sesuai urutan; perhatikan **badge budget** (`terpakai/batas char`) — dokumen berlebih **terpotong dari prompt** (yang di bawah daftar dulu). Naikkan batas atau nonaktifkan yang tak relevan.
- Instruksi khusus tim selalu di atas gaya bawaan AI.

## 5. Bila hasil tipis

1. Tambah catatan (bukan klik ulang): tiap anggota tambah 1 poin + 1 ilustrasi.
2. Klik Perkaya sekali lagi (maksimal 3 generasi per pekan).
3. Masih tipis → tolak pengajuan, perbaiki manual di editor, atau tulis ulang catatan dengan format §1.
