# Studio Didaskalia — SOP Mingguan Tim & HOD

> Alur baku: perikop → outline tim → AI draf → diskusi → AI perkaya → HOD setujui.
> Prinsip: AI = usulan, tim menyunting, HOD memutuskan.

## 1. Peran tim (HOD + anggota)

1. **HOD/tim menetapkan 2 perikop**: Fundamental Firman (jangkar tema) + Kitab/Bagian Fokus (bacaan progresif 7 hari).
2. **Anggota eksplorasi mandiri** (AI masing-masing) lalu menulis outline dengan format baku:
   `Perikop → 2–3 poin → 1 ilustrasi (kuliah/kerja/kos/relasi) → 1 aplikasi`.
3. **Outline ditempel sebagai teks diskusi** di tab Diskusi Studio (scope Umum, atau scope Path bila spesifik hari itu). Bukan file — supaya AI membacanya.
4. Centang **"Pakai diskusi internal"** wajib ON saat enrich.

## 2. Klik AI sesuai kebutuhan

| Tombol | Dipakai saat |
|---|---|
| Susun draf 7 Path + khotbah | Awal pekan / susun ulang total (ikut pola pekan). Draf dibuat per hari (4+3) + khotbah terpisah — gagal 1 hari tak menggugurkan lain |
| Perkaya dengan diskusi | Draf ada + diskusi terisi; **satu kali per pekan** (generasi >3 = sinyal input kurang). Dijalankan per hari + khotbah; catatan >8000 char dipotong dari yang terlama (ada peringatan) |
| Ringkasan Khotbah | Refresh ringkasan/slide saja |
| AI + PDF Pembekalan | Jalan pintas: draf lalu langsung unduh PDF (tanpa terbit) |
| Isi dari AI (tab Draft Sesi) | Sesudah tema/firman fix: isi form sesi hari-H |

### 2b. Memahami peringatan AI (toast kuning + meta pengajuan)

| Peringatan | Artinya | Aksi |
|---|---|---|
| `Path 2, 5 gagal` | Hari itu gagal di semua model — dipakai versi lama | Ulangi enrich (sering berhasil di percobaan ke-2) atau isi manual hari itu |
| `Path 3 kepotong limit` | Output terpotong — periksa kelengkapan sebelum approve | Bandingkan diff Path 3; tolak bila kosong |
| `N karakter catatan dipotong` | Catatan terlama di luar cap 8000 char tidak dibaca AI | Pindahkan poin penting ke atas / ringkas catatan lama |
| `AI gagal memperkaya draf: ...` + nama model | Semua model gagal (bukan salah input) | Tunggu ±1 menit (limit Groq per menit), lalu Coba lagi; bila OpenAI yang gagal, cek `/api/ai/health` |

## 2a. Skenario MD mingguan (input awal, bukan knowledge)

1. **Tempel MD Service** di Input Inti → `Parse & simpan acuan` (harus valid 4 outline + Teks Utama) → `Terapkan ke Ringkasan`.
2. **Tempel MD RHB** → `Parse & simpan acuan` (harus 7/7 Path) → `Terapkan ke 7 Path`.
3. Isi Fundamental Firman (ayat) + Kitab/Bagian Fokus seperti biasa; **metode boleh dikosongkan** — AI memilih sendiri 2–3 yang paling cocok.
4. Klik `Ringkasan Khotbah` (atau Susun draf) → periksa bigIdea + 4 outline + metode → enrich sekali bila perlu → generate cover (default AI) → 3 caption (RHB / Pembekalan / Khotbah) → approval HOD.
5. MD mingguan tersimpan di pekan itu saja (`sourceMd`) — tidak mencemari knowledge global. Knowledge aktif cukup FORMAT global.

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
