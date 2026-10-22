# Studio Didaskalia — SOP Mingguan Tim & HOD

> Alur baku: **Impor → Rapikan & cek → Parse → (opsional) Perkaya dengan diskusi → Setujui HOD → Terbitkan**.
> Prinsip: dua naskah tim (RHB 7 Path + Serving Day) adalah sumber. Parser menyalin yang terbaca. AI tidak menulis ulang dari nol selama naskah itu ada.

Hasil setelah Impor → Rapikan & cek → Parse → persetujuan HOD **sudah boleh diterbitkan** tanpa Perkaya. Perkaya boleh dijalankan kapan saja, termasuk setelah terbit, dan bukan syarat setujui.

## 1. Peran tim (HOD + anggota)

1. Tim menyediakan dua naskah: RHB 7 Path dan Serving Day (PDF, MD, atau teks tempel).
2. Di tab Inti: unggah atau tempel keduanya. **Rapikan & cek** opsional — ia hanya menyusun format, ejaan, dan usulan bahasa inklusif. Ayat tidak diubah. Usulan ditinjau sebelum dipakai.
3. **Parse & terapkan** menulis bagian yang terbaca ke 7 Path dan outline khotbah, lalu mengunduh PDF Pembekalan dari salinan yang sudah disimpan. Bagian yang gagal dibaca menjadi peringatan, bukan penolakan seluruh berkas.
4. HOD menekan **Setujui HOD**. Pekan lama tanpa pengajuan tetap bisa terbit.
5. Diskusi internal dipakai hanya bila tim memilih **Perkaya dengan diskusi** (centang konteks). Berkas `.md` di tab Diskusi masuk Pengetahuan tim lewat **Unggah ke Pengetahuan**, bukan ke parser pekan.

## 2. Tombol

| Tombol | Dipakai saat |
|---|---|
| Rapikan & cek | Setelah impor. Boleh dilewati. Hasil = usulan (format, ejaan, inklusi) sebelum parse. |
| Parse & terapkan | Menulis naskah ke studio dan mengunduh PDF Pembekalan dari data tersimpan. |
| Perkaya dengan diskusi | Opsional, kapan saja. Butuh catatan diskusi. Bukan syarat terbit. |
| Susun dari nol | Hanya bila belum ada naskah sumber. Hasil tetap pengajuan HOD. |
| Segarkan metode & inti pesan | Di menu Lainnya. Menyegarkan metode dan inti pesan. Outline sumber tetap. |
| Haluskan teks | Usulan pada satu kolom. Tidak menimpa sampai Terapkan. |
| Terjemahkan ke English | Usulan judul/ringkasan English di samping naskah Indonesia. Simpan terjemahan tidak menimpa bahasa Indonesia. |
| Isi contoh catatan | Mengisi kotak diskusi dengan contoh instruksi, bukan panggilan AI. |
| Buat semua gambar | Tab Gambar. 1 cover + 4 bagian khotbah + 7 hari RHB (12, kuota pekan). Centang lewati yang sudah ada. Tiap baris punya Buat ulang. |

Jalan pintas "AI + PDF Pembekalan" tidak ada lagi. PDF selalu dibangun dari studio yang tersimpan.

### Peringatan AI (toast kuning)

| Peringatan | Artinya | Aksi |
|---|---|---|
| `Path 2, 5 gagal` | Hari itu gagal di semua model — dipakai versi lama | Ulangi Perkaya untuk hari itu atau isi manual |
| `Path 3 kepotong limit` | Output terpotong | Bandingkan diff sebelum setujui |
| `N karakter catatan dipotong` | Catatan terlama di luar batas tidak dibaca | Naikkan poin penting |
| Parse sebagian | Label atau bagian tidak ketemu | Yang terbaca tetap masuk; lengkapi yang disebut di peringatan |

## 3. Label yang dikenali

Parser menerima teks polos dari PDF (tanpa `#`) dan markdown.

**RHB.** Kepala `Path N`, termasuk `Path 1 Minggu 25 Oktober`. Judul boleh Bahasa Indonesia. Nats hari itu: **Nats Pembimbing**, **Nas Pembimbing**, **Ayat Renungan**, atau **Scripture**. Lima bagian: Pengantar (juga Fondasi Teologis), Pembahasan Tematis, Makna & Implikasi, Refleksi Pribadi, Diskusi Kelompok, plus Jembatan.

**Serving Day.** Kitab Fundamental = Teks Utama khotbah (bukan Fundamental Firman mingguan). Kitab Bagian Fokus = kitab fokus. Fondasi Teologis = Pengantar. Juga dikenali: Bedah Teologis, Jembatan Menuju Tema Mingguan, Kesimpulan.

Path 1 = Minggu … Path 7 = Sabtu. Bila kepala sumber menyebut hari lain, itu peringatan; kalender Path yang dipakai.

## 4. Gambar

Semua generate gambar ada di tab **Gambar**:

- **Buat semua gambar** berjalan berurutan dan menampilkan progres.
- **Lewati yang sudah ada** menghindari kuota yang sudah terpakai.
- **Buat ulang** pada satu baris tetap ada (cover yang sudah ada diganti di slot yang sama).
- Unggah manual hanya untuk cover, di baris yang sama.

Kuota pekan: 12 slot (1 cover + 4 khotbah + 7 RHB).

## 5. Sebelum HOD menyetujui naskah sumber

- Cek 7 judul dan Nats Pembimbing.
- Outline Serving Day: Pengantar, Bedah, Jembatan, Kesimpulan, Teks Utama.
- Perkaya yang masih PENDING adalah pengajuan terpisah. Menyetujui naskah sumber tidak memakai diff Perkaya.
- Pengajuan Perkaya yang menyusutkan isi RHB tetap ditolak di panel persetujuan regenerate.

## 6. Pengetahuan tim (tab Pengetahuan)

Dokumen dibaca AI sesuai urutan. Badge budget menunjukkan karakter yang terpakai. Instruksi khusus tim berada di atas gaya bawaan.

## 7. Bila hasil tipis

1. Tambah catatan diskusi, lalu Perkaya (opsional).
2. Atau sunting langsung di tab 7 Path / Khotbah — naskah sumber sudah ada di editor.
3. Generasi di atas 3 adalah sinyal agar input diperbaiki, bukan agar tombol ditekan ulang.
