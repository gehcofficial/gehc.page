# Panduan Pemilihan Pelsus — 18 Okt 2026 (GEHC.page)

Alur baku warta: **Juklak → Absensi/Kuorum → Cara memilih → Pilih**.
Pemilihan adalah ibadah (Tata Gereja GMIM + Juklak BPMS No.10/2026).

## 1. Dasar Juklak (bacakan saat warta, 60 detik)

Pemilihan **perorangan, langsung, rahasia, tertulis, tidak dapat diwakilkan**.
Surat suara digital di `gehc.page/#/pelsus` = surat suara panitia.
Yang tercatat hanya **sudah/belum memilih** — pilihan dirahasiakan.
1 orang 1 suara di semua jalur (HP / bilik / manual).
Seri → undi oleh panitia. Hasil dituang dalam Berita Acara (CSV dari sistem).

## 2. Absensi & kuorum (sebelum pilih)

1. Pemilih check-in: login di HP, atau token bilik, atau daftar manual ke petugas.
2. Layar `#/pelsus/<id>/layar` tampil `X dari Y sudah hadir` + status kuorum.
3. Pemilihan sah bila **kuorum 2/3 DPT** terpenuhi (angka di sistem, default 2/3).
4. Bila belum kuorum → panitia menunda sesuai tata tertib, sistem tetap merekam kehadiran.

## 3. Cara memilih (3 jalur, anti-ganda di DB)

| Jalur | Untuk siapa | Cara |
|---|---|---|
| HP sendiri | Punya akun | Buka `https://gehc.page/#/pelsus` → login → buka surat suara BIPRA/Kolom → pilih → Kirim |
| Bilik (5 laptop) | Tanpa akun / butuh dampingan | Petugas terbitkan **token 6 digit (10 menit)** → buka `#/pelsus/<id>/bilik` → token → pilih → Kirim → layar reset 15 dtk |
| Manual | Surat kertas / kendala device | Petugas cek **SUDAH/BELUM** dulu → catat di panel (dengan/ tanpa abstain). Tolak bila SUDAH. |

## 4. Layar proyektor (per BIPRA/Kolom/BPMJ)

- URL: `#/pelsus/<id>/layar` + kode 6 digit dari panitia.
- Saat OPEN: hanya **partisipasi + kuorum** (rahasia terjaga).
- Setelah CLOSED: perolehan + pemenang + tanda Seri bila imbang.
- Polling layar 5 dtk + backoff; peserta 15 dtk + backoff (anti macet seperti Likert kemarin).

## 5. Lembar bilik (tempel di tiap laptop)

```
BILIK PELSUS — 1 orang = 1 suara = 1 token. Tak dapat diwakilkan.
1. Minta nama → cek SUDAH/BELUM. SUDAH → STOP.
2. "Terbitkan Token" → 6 digit, 10 menit.
3. #/pelsus/<id>/bilik → token → pilih → KIRIM (jangan intip).
4. "Suara tersimpan ✓" → RESET (otomatis 15 dtk).
DILARANG: foto surat suara, titip pilih, 1 token 2 orang.
Error 503 → tunggu 10 dtk, KIRIM sekali lagi.
```

## 6. WA broadcast

Panjang (H-3): Shalom — Pemilihan Pelsus Minggu 18 Okt setelah ibadah
(Penatua BIPRA, Penatua/Diaken Kolom, BPMJ). Buka https://gehc.page/#/pelsus,
login dulu. Tanpa akun → bilik token / manual. Absensi dulu untuk kuorum 2/3.
1 orang 1 suara. — Panitia.

Pendek (H-1): Besok setelah ibadah → Pelsus. https://gehc.page/#/pelsus.
Bawa HP + login. Tanpa akun ke bilik/manual. 🙏

## 7. Operasional panitia (checklist)

- [ ] H-2: seed DPT (`db:seed:pelsus`), import CSV susulan, input kandidat (DRAFT).
- [ ] H-1: gladi 5 laptop bilik + 1 layar + validator manual; uji token + checkin + tutup + CSV.
- [ ] Hari-H: OPEN per election → awasi kuorum → tutup → umumkan hasil → unduh CSV Berita Acara.
- [ ] Fase-2 BPMJ: dari election sumber CLOSED → promote topN → DPT BPMJ → OPEN.

## 8. Video simulasi (5 klip, `public/media/pelsus/`)

Jalankan ulang kapan pun: `npm run pelsus:sim` (lokal + DB staging, election
`SIMULASI-*`, bersih otomatis). Putar dari HP/laptop atau langsung dari situs:
`https://youth.gehc.page/media/pelsus/01-panitia-buka.webm` (dst, 02–05).

| Klip | Isi | Untuk |
|---|---|---|
| `01-panitia-buka.webm` | Login panitia → daftar pemilihan → Panel panitia → **Buka** | Panitia |
| `02-pemilih-hp.webm` | Login peserta → surat suara → pilih → Kirim → bukti vote ganda ditolak | Peserta |
| `03-bilik-token.webm` | Token petugas → bilik tanpa login → pilih → Kirim → auto-reset | Petugas bilik + peserta |
| `04-layar-kuorum.webm` | Kode layar → partisipasi + kuorum live → validasi manual → Tutup → hasil | Semua (proyektor) |
| `05-berita-acara.webm` | Unduh CSV → Reset → Hapus election → staging bersih | Panitia |

## 9. Jalur Panitia (step-by-step, rujuk klip 01/04/05)

1. H-2: buka `#/pelsus` → per election: Sync DPT dari DB + Import susulan (CSV
   `nama,bipra,kolomId`) + Tambah kandidat (masih DRAFT). (klip 01)
2. H-1 gladi: Buka 1 election uji → vote 1 suara → Tutup → Unduh CSV → Reset →
   Hapus election. (klip 05)
3. Hari-H: Buka tiap election (klip 01) → pantau layar `#/pelsus/<id>/layar`
   + kode (klip 04) → sah bila kuorum 2/3.
4. Bilik: cari nama → **Token** (10 menit) → dampingi tanpa mengintip. (klip 03)
5. Manual: cari nama → cek SUDAH/BELUM → **Manual** (tolak bila SUDAH). (klip 04)
6. Selesai: Tutup → umumkan hasil di layar → Unduh CSV Berita Acara. (klip 04–05)
7. Jangan: membuka hasil sebelum CLOSED, menerbitkan 2 token untuk 1 orang,
   menghapus election yang masih OPEN (ditolak sistem).

## 10. Jalur Peserta/Jemaat (step-by-step, rujuk klip 02/03)

1. Buka `https://gehc.page/#/pelsus` di HP → login (Google / email+sandi).
2. Pilih surat suara BIPRA/Kolom Anda (hanya yang Anda terdaftar yang bisa dibuka).
3. Ketuk 1 kandidat → **Kirim**. Selesai bila muncul "Suara tersimpan ✓".
   Tidak bisa mengubah / memilih dua kali — sistem menolak otomatis. (klip 02)
4. Tanpa akun: ke meja bilik → sebut nama → terima token → ketik di
   `#/pelsus/<id>/bilik` → pilih → Kirim. (klip 03)
5. Dilarang: memfoto surat suara, menitipkan pilihan, memakai token orang lain.

## 11. Naskah voice-over per klip (opsional, 1–2 kalimat)

1. "Panitia membuka pemilihan dari panel — perhatikan status berubah menjadi Dibuka."
2. "Peserta memilih dari HP — satu suara, tidak dapat diubah, pilihan ganda otomatis ditolak."
3. "Di bilik, pemilih tanpa akun memakai token sekali pakai — petugas tidak mengintip."
4. "Layar hanya menampilkan partisipasi dan kuorum — hasil dibuka setelah panitia menutup."
5. "Berita Acara diunduh sebagai CSV — lalu data simulasi dihapus hingga bersih."

## 12. Preview 2 variasi (V1 vs V2 by-person)

V1 (`#/pelsus/…`) = alur per-surat-suara saat ini, tidak diubah. V2
(`#/pelsus2/…`) = varian by-person: section "Surat suara saya" + tombol
lanjut + paket token + bilik berantai + perkakas panitia cari-orang. Backend
sama; yang dibandingkan murni alur UX. Data preview = election `pv2-*`
(`npm run db:seed:pelsus:preview[:staging]`); 19 election asli tak tersentuh;
`?sim` memfilter hanya election preview. Prefix `pv2-` sengaja bukan `sim-`
agar tak ikut terhapus bersih otomatis `npm run pelsus:sim`.

| Peran | V1 | V2 |
|---|---|---|
| Pemilih multi-surat (akun) | `#/pelsus` → buka 1 per 1 | `#/pelsus2?sim` → "Surat suara saya (X dari N)" → pilih → "Lanjut: … →" |
| Petugas bilik | 1 token = 1 surat, ketik ulang per surat | Link `#/pelsus2/<id>/bilik?tokens=A,B,C` → otomatis "Surat 2 dari 3" |
| Panitia cari-orang | Per election (panel di tiap surat suara) | `#/pelsus2/panitia` → cari nama → Paket Token / Manual per surat |
| Layar proyektor | `#/pelsus/<id>/layar` | Sama persis (komponen dipakai ulang) |

Skenario uji (staging, DPT uji `Uji Multi Surat` = 3 surat suara):

1. Login akun multi-surat → V2 home tampil "Sudah 0 dari 3" → pilih Pemuda →
   Kirim → tombol lanjut ke Kolom 3 → selesai "Sudah 3 dari 3".
2. Panitia → `#/pelsus2/panitia` → cari "Tamu" → Paket Token → salin link
   bilik berantai → 3 surat tanpa ketik ulang → auto-reset di akhir.
3. Coba vote ganda (token sama 2×) → wajib ditolak; cek layar hanya tampil
   partisipasi selama OPEN.

Kriteria keputusan: waktu bilik multi-surat, angka klik-ganda tertolak,
pemahaman panitia tanpa pendampingan. Pemenang dipromosi ke `#/pelsus`;
varian kalah dihapus (revert R1 + hapus folder varian) agar tak jadi beban.
