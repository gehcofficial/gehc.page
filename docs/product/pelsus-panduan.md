# Panduan Pemilihan Pelsus — 11 Okt 2026 (GEHC.page)

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

Panjang (H-3): Shalom — Pemilihan Pelsus Sabtu 11 Okt setelah ibadah
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
