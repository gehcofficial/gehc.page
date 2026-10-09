# Aturan Pelaksanaan Pelayanan Perantau — GMIM Eben Haezer Cikarang
# (Draf usul ke BPMJ — diskusi internal, 9 Okt 2026)

> Dasar Tata Gereja: [tata-gereja-gmim](tata-gereja-gmim.md). Dokumen ini
> adalah **aturan pelaksanaan tingkat jemaat** (mekanisme, rostering,
> pembinaan, kriteria tambahan) — bukan perubahan Tata Gereja. Berlaku
> untuk **semua BIPRA dan Kolom**, bukan hanya Pemuda (§7).

## 1. Latar: jemaat perantau yang dinamis

Mayoritas jemaat Eben Haezer Cikarang adalah anak muda perantau: datang
silih ganti, menetap 3–4 tahun, lalu pindah (magang, kerja, menikah).
Mereka mau memberi diri untuk waktu terbatas (kuarter, semester,
1 tahun). Pola yang terbukti jalan: tim inti kecil berdedi­kasi tahunan +
task force fleksibel per event (pola PHRG/H2RG), pembantu Kostor
weekly/monthly, rotasi THL per kuarter. Aturan ini melegalkan pola itu
tanpa menabrak Tata Gereja.

## 2. Dua jalur pelayanan

| | Jalur Struktural (SK penuh) | Jalur Fungsional (Surat Tugas BPMJ) |
|---|---|---|
| Untuk | Yang menetap + memenuhi syarat utuh | Perantau berbatas waktu |
| Dasar | SK + ketentuan Tata Gereja | Surat Tugas BPMJ: tugas spesifik + masa tegas (kuarter/semester) |
| Wewenang | Penuh (mewakili, pegang kas via Asben, bersuara bila Pelsus) | **Tanpa** mewakili/megang kas/bersuara; didampingi 1 struktural |
| Masa | Ikut periode pelayanan | Time-boxed; diperpanjang per periode tugas |
| Nilai tambah | — | Masa fungsional dihitung **pengalaman pelayanan** (syarat calon ketua, Pasal 34 ayat 4) |

## 3. Format pengecualian yang sah

> *"Harusnya A, tapi B, dengan catatan C."*

B hanya sah bila berada di ruang jemaat (mekanisme, rostering, pembinaan,
kriteria tambahan). Contoh sah: Kategorial wajib sertifikat (A) →
perantau tanpa sertifikat melayani dulu di Tim Kerja/Panitia/Komisi
Kerja yang tak wajib sertifikat (B), dengan catatan wajib ikut Latihan
Kepemimpinan intensif perdana (C).

**Pagar yang tidak bisa dinego** (jangan ditulis pengecualiannya):
angkat non-sidi atau Pelsus jadi Komisi Kerja; ketua Kategorial tanpa
peneguhan Penatua; hak suara untuk non-Pelsus; kas di luar pengawasan
Bendahara; masa melebihi periode tanpa pemilihan ulang; pengangkatan
langsung pengurus Kategorial (wajib Rapat Pemilihan, Pasal 33–36).

## 4. Gerakan atestasi (prasyarat semua penempatan)

Perantau wajib terdaftar di satu jemaat domisili + surat pindah
(Pasal 6). Tanpa ini, tidak eligible untuk jabatan apa pun. Portal
mendukung via status atestasi di profil (BELUM_TERDATA | PROSES |
SUDAH + asal jemaat + tanggal) + filter "belum atestasi" di pipeline
Komisi + rekap per Kolom/BIPRA di dasbor BPMJ. Target: tidak ada lagi
pelayan berstatus atestasi gelap.

### Studi kasus: Kolom 1 (mahasiswa)

Kolom seluruh-mahasiswa yang Pelsus-nya vakum lama tanpa pengumuman =
mati suri. Penanganannya: (1) Sidang menyatakan vakum → bubar;
(2) anggota dialihkan via atestasi — ke Kolom domisili lain, atau
tercatat sebagai Pemuda bila memang kategorinya; (3) posisi Pelsus
dihapus/dinyatakan lowong permanen; (4) mahasiswa yang "nanti Pemuda
saja" tetap wajib atestasi tercatat — tanpa ini mereka tak masuk DPT
maupun penempatan. Pola ini berlaku umum untuk unit yang ditinggal
pergantian generasi perantau.

## 5. Program sertifikasi kuarteran

Latihan Kepemimpinan intensif (1–2 hari) tiap kuarter + sertifikat
internal. Sertifikat mengubah fungsi: dari **gerbang** menjadi
**anak tangga** — ditempuh sambil melayani di jalur fungsional, selesai
sebelum hari pemilihan bagi calon struktural. Pelacakan: JSON
`leadershipCertificates` di profil User.

## 6. Pool + cadangan (tanpa Sidang tiap rotasi)

SK mencantumkan pool + cadangan resmi (cth. THL 8+4, BZP 6+3). Roster
aktif vs cadangan = flag `isActive` penugasan; batas Surat Tugas =
`expiresAt` (akhir kuarter/semester) + `note`. Rotasi kuarter = alih
flag via BPMJ — **tanpa Sidang baru**. Yang pindah kota = nonaktif
terhormat; cadangan naik.

## 7. Berlaku lintas BIPRA & Kolom (fakta: masalahnya sama)

| Unit | Syarat khusus anggotanya | Catatan perantau |
|---|---|---|
| Anak | Dari Pelayan Anak/Guru SM (sidi + sertifikat) | Guru SM perantau → jalur fungsional + sertifikasi |
| Remaja | Dari Pembina Remaja (sidi + sertifikat) | Sama; Pembina magang didampingi |
| Pemuda | 17–30, belum menikah, sidi + sertifikat | Kasus utama dokumen ini |
| WKI / PKB | Sidi kategorinya + sertifikat | Berlaku dua jalur sama |
| Kolom (Pelsus) | Penatua/Syamas Kolom via pemilihan Pelsus | Pendataan KK + atestasi prasyarat DPT |
| Komisi Kerja (cth. Musik, Pembangunan, Usaha Dana) | Sidi + bukan Pelsus, tanpa sertifikat | Jalur masuk termudah bagi perantau baru |

## 8. Timeline kesiapan pemilihan Komisi Pemuda (masa berakhir 2026)

1. **Segera:** Latihan Kepemimpinan intensif (calon + yang belum
   bersertifikat) → sertifikat terbit. *Critical path: sertifikat
   syarat keterpilihan (Pasal 34 ayat 1).*
2. **BPMJ bentuk Panitia Pemilihan** → tetapkan DPT Pemuda (paralel:
   gerakan atestasi §4).
3. **Rapat Pemilihan** (Pasal 33–36): calon Ketua (maju sebagai Penatua
   Pemuda — syarat: pengalaman pelayanan + sidi + sertifikat), Wakil,
   Sekretaris, Bendahara + 1–2 calon anggota agar demokratis.
4. **Usai dilantik:** kontrak pelayanan tahunan internal (evaluasi
   lanjut/rotasi/mundur terhormat) + SK Tim Kerja operasional + pool/
   cadangan THL-BZP. Yang idle periode berjalan tidak dicalonkan lagi
   (tak perlu mekanisme lowong karena masa berakhir).
5. **Klarifikasi ke BPMJ sebelum SK terbit:** masa komisi lokal "5 tahun"
   vs Tata Gereja (masa = masa BPMJ, siklus 1 Jan–31 Des tahun keempat) —
   SK jangan menulis masa yang bertentangan aturan.

## 9. Contoh kasus: suksesi BOD Tim Kerja → Komisi

Pola yang didukung aturan: pengurus operasional yang terbukti mampu
didorong pencalonannya di Rapat Pemilihan (didukung, bukan diangkat
langsung), dengan kontrak tahunan sebagai katup fleksibilitas dan Tim
Kerja tahunan tetap di bawah komisi untuk operasional harian. Berlaku
umum untuk semua BIPRA, bukan hanya Pemuda.
