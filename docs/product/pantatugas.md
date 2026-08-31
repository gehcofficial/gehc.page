# Struktur Pantatugas — GEHC Youth "Beyonders"

> Keputusan desain struktur organisasi pemuda berbasis lima fungsi gereja klasik.
> Referensi: `revision-v2-beyonders.md`, diskusi konsultasi 2026.

## 1. Prinsip

- **Pancatugas = payung permanen** (fungsi gereja yang abadi):
  **Liturgia · Didaskalia · Koinonia · Diakonia · Marturia**
- **Sub-divisi = unit teknis** di bawah tiap fungsi — *extensible*: bisa bertambah sewaktu-waktu cukup lewat data/portal, tanpa perubahan kode atau migrasi DB.
- **Divisi Struktur** di luar pantatugas: Badan Pekerja Majelis Jemaat (BPMJ), Komisi Pemuda, dan Tim Kerja — bertanggung jawab kepada Ketua BPMJ.
- **Benzarpreneurship (BZP)** = divisi terpisah untuk usaha & merchandise, di bawah Tim Kerja, dipimpin Kepala BZP (Fladyna Mondoringin). Sub-divisi: **Merchandise · Fundraising · Donation**.
- **Beyonders = keseluruhan kelompok mentoring** — target audiens pelayanan Komisi, Tim Kerja, dan segenap Panca Tugas. BUKAN milik salah satu panca tugas dan TIDAK dibagi per-panca-tugas. Detail direktori & regenerasi tampil lewat navbar **`#/beyonders`** (GroupsCarousel + Jethro Engine).
- Nama personal menyusul; sistem memakai placeholder per-peran
  (email = nama peran, domain `@gehc.demo`, staging only).
## 2. Hirarki

```
BPMJ (Badan Pekerja Majelis Jemaat)
├─ Ketua: Pdt Meyke Poluan Sth Mpdk
├─ Wakil Ketua: Pnt Veky Lengkong
├─ Sekretaris: Pnt Noldy Wanget
├─ Wakil Sekretaris: Pnt Nofri Raco
├─ Bendahara: Dkn Selfi Lumbu
└─ Anggota Bendahara: Dkn Bonny Rondonuwu

└─ Komisi Pemuda — dipenin Penatua Pemuda sebagai Ketua (periode 5 tahun, bertanggung jawab kepada BPMJ)
   ├─ Ketua/Penatua Pemuda: Pnt Stevania Hadinda
   ├─ Wakil Ketua: Kevin Moniaga
   ├─ Sekretaris: Glenity Siauw
   └─ Bendahara: Rendy Lumintang
└─ Tim Kerja — tim yang membantu Komisi untuk mengerjakan program pelayanan pemuda
    (normalnya setahun sekali diganti)
   ├─ Ketua: Theodore Beckham Milano Kowaas
   ├─ Sekretaris: Zhanon Varelie Lausan
   └─ Bendahara: Milithya Christy Kerin Wuisan

   ├─ BEYONDERS  : kelompok mentoring — target audiens seluruh pelayanan
   │               (direktori lengkap di navbar #/beyonders)
   ├─ LITURGIA    : Liturgi & Musik · Pendoa · Intercessor
   ├─ DIDASKALIA  : Kurikulum & Pembekalan (Main Speaker: Putri Massie & Alvandi Saerang)
   ├─ KOINONIA    : Program Persekutuan (incl. PIC Acara/Rundown — Krisetia Mamoto)
   │              · Public Relations (PR) ⭐ — follow-up, MC, sosmed
   ├─ DIAKONIA    : Logistik & Akomodasi · Konsumsi · Medis & First Aid
   ├─ MARTURIA    : Dokumentasi · Desain & Publikasi · Penginjilan Praktis
   └─ BZP (Benzarpreneurship) — Kepala: Fladyna Mondoringin
                : Merchandise · Fundraising · Donation

🆕 = peran baru hasil pemetaan dari divisi retreat.
⭐ = PR menangkap data newcomer pasca-retreat → Placement Recommender (Jethro Engine).

## 3. Pemetaan Divisi Retreat Lama → Pantatugas

| Divisi lama | Menjadi | Catatan |
|---|---|---|
| Ibadah (personel ibadah, prayer) | LITURGIA | + peran Pendoa & Intercessor |
| Ibadah (modul, 2 main speaker) | DIDASKALIA — Kurikulum & Pembekalan | main speaker = pembekal di dalamnya |
| Acara (rundown) | KOINONIA — Program Persekutuan | Krisetia Mamoto sebagai PIC Acara & Rundown |
| Acara (games/bonding) | KOINONIA — Program Persekutuan | |
| Multimedia | MARTURIA — Desain & Publikasi | merekam & menyebarkan kesaksian |
| Usaha Dana (merchandise) | BZP — Merchandise | Kepala BZP: Fladyna Mondoringin |
| Usaha Dana (fundraising) | BZP — Fundraising | melapor ke Bendahara Komisi/Tim Kerja |
| Logistik | DIAKONIA | |
| Konsumsi | DIAKONIA | momen makan bersama tetap dirancang Koinonia |
| Follow-up newcomer/MC/sosmed | KOINONIA — Public Relations (PR) | gabungan tugas relasi & publikasi |

## 4. Implementasi Teknis

| Aspek | Keputusan |
|---|---|
| Skema DB | `StrukturMember.division` (string bebas) + kolom baru `subdivision`; tanpa enum → subdivisi baru tanpa migrasi |
| API publik | `GET /api/db/struktur` (landing API-first, fallback data lokal) |
| Sinkronisasi | `POST /api/db/sync-struktur` (replace-all, role SUPERADMIN/KOMISI/COMMITTEE); otomatis dipanggil setiap mutasi di portal ManageStruktur |
| Panel Editor | OrgChart interaktif (chart/tabel) — klik kartu utk edit nama/jabatan; flag posisi terbuka tersimpan di kolom `is_open_role` |
| Landing UI | `StrukturSection` = pohon interaktif; warna identitas: Liturgia ungu, Didaskalia biru, Koinonia hijau, Diakonia oranye, Marturia merah, Benzarpreneursing kuning |
| Seed staging | `npm run db:seed-users:staging` — idempotent, membuat akun placeholder per posisi + sinkron tabel struktur |
| Multi-role | Akun rangkap didukung (contoh seed: `ketua-komisi@gehc.demo` = KOMISI + MENTOR Agape); konteks akses diganti via chips di Navbar; precedensi di `src/lib/roles.ts` |
| Sub-divisi baru | Daftar di `src/lib/pantatugas.ts` → `SUB_DIVISIONS[division]` array; otomatis muncul di StrukturSection & landing UI tanpa deploy ulang. |
| Beyonders (kelompok mentoring) | Satu kesatuan grup mentoring sebagai target audiens seluruh pelayanan; direktori & regenerasi via navbar `#/beyonders` + Jethro Engine. Tidak dibagi per-panca-tugas. |

## 5. Aturan Extensibility

Menambah sub-divisi baru (contoh nyata ke depan: "Tim Medis Mobile", "Kelas Pra-Nikah"):

1. Portal → Kelola Struktur → tambah anggota dengan Fungsi = salah satu pantatugas, isi field **Sub-Divisi**.
2. Buat folder ber-nama sama di Google Drive di bawah folder pillar-nya (lihat `drive-integration.md` §3) — jalankan **Audit Sinkronisasi** di portal untuk memastikan DB ↔ Drive selaras.
3. Selesai. Pohon landing, database, dan akses Drive otomatis ikut — tanpa deploy ulang.

### Contoh: Menambah sub-divisi "Pendoa" di LITURGIA

1. Tambah entri di `SUB_DIVISIONS['LITURGIA']` di `src/lib/pantatugas.ts`:
   ```ts
   {
     name: 'Pendoa',
     label: 'Pendoa',
     tagline: 'Jaga prayer strategis untuk kebutuhan spiritual acara & jemaat',
     color: '#7C3AED',
   }
   ```
2. Jalankan audit sinkronisasi di portal — folder Drive dan tabel DB ikut ikut.
3. Sub-divisi muncul otomatis di StrukturSection dan halaman landing.

## 6. Struktur Divisi & Penugasan Orang (Reference)

| Divisi | Penugasan Utama | Pengurus Kunci |
|--------|----------------|---------------|
| **BPMJ** | Payung tertinggi pelayanan pemuda | Ketua: Pdt Meyke Poluan Sth Mpdk |
| **Komisi Pemuda** | Program pemuda periode 5 tahun | Ketua: Pnt Stevania Hadinda |
| **Tim Kerja** | Bantuan program pelayanan tahunan | Ketua: Theodore Beckham Milano Kowaas |
| **Liturgia** | Memuliakan Tuhan dalam ibadah & musik | PIC: Holly Kalele |
| **Didaskalia** | Mengajar & memperlengkapi lewat firman | Main Speaker: Putri Massie & Alvandi Saerang |
| **Koinonia** | Memelihara persekutuan & relasi baru | ⭐ PR (follow-up/MC/sosmed); Krisetia Mamoto — PIC Acara |
| **Diakonia** | Melayani kebutuhan praktis | PIC: Prichel Kampong & Artjuna Timbuleng |
| **Marturia** | Menjadi saksi & menginjili | MTDD: Gievara Bogar |
| **Benzarpreneurship (BZP)** | Usaha & dana: Merchandise · Fundraising · Donation | Kepala: Fladyna Mondoringin |

## 7. Concern & Penyesuaian

1. **Intercession / Pendoa**: Difinalisasi menjadi sub-divisi terpisah di bawah LITURGIA dengan definisi tugas jelas.
2. **Koordinator Program / PIC Acara (Krisetia Mamoto)**: Masuk KOINONIA › Program Persekutuan — tidak lagi divisi PENOPANG terpisah.
3. **Follow-up Newcomer → Public Relations (PR)**: Tetap di Koinonia; PR menangkap data newcomer → Jethro Engine, sekaligus bertugas MC acara & update sosmed.
4. **Main Speaker / Pembekal (Putri Massie & Alvandi Saerang)**: Dilebur ke DIDASKALIA › Kurikulum & Pembekalan.
5. **Usaha & Merchandise & Fundraising & Donation**: Semua di **BZP** di bawah Tim Kerja, dipimpin Kepala BZP Fladyna Mondoringin; melapor kepada Bendahara Komisi/Tim Kerja.
6. **Setiap Divisi punya Head of Division + Committee Member per sub-divisi**: Struktur diharapkan ditambahkan di dokumentasi §6-§8.

## 8. Pillar & Sub-divisi Reference Table (Reference)

| Pillar | Contoh Sub-divisi | Warna |
|--------|-------------------|-------|
| LITURGIA | Liturgi & Musik, Pendoa, Intercessor | Ungu |
| DIDASKALIA | Kurikulum & Pembekalan | Biru |
| KOINONIA | Program Persekutuan, Public Relations (PR) | Hijau |
| DIAKONIA | Logistik & Akomodasi, Konsumsi, Medis & First Aid | Oranye |
| MARTURIA | Dokumentasi, Desain & Publikasi, Penginjilan Praktis | Merah |
| BENZARPR (BZP) | Merchandise, Fundraising, Donation — Kepala: Fladyna Mondoringin | Kuning/Emas |

## 9. Beyonders — Kelompok Mentoring

**Beyonders adalah kesatuan kelompok mentoring** yang menjadi target audiens pelayanan Komisi Pemuda, Tim Kerja, dan segenap Panca Tugas. Beyonders **tidak dibagi per-panca-tugas** dan tidak melekat pada salah satu divisi.

### Posisi dalam Organisasi:

```
BPMJ → Komisi Pemuda → Tim Kerja
                         ├─ BEYONDERS (kelompok mentoring)
                         ├─ 5 Panca Tugas
                         └─ BZP (Merchandise · Fundraising · Donation)
```

### Kenapa Tidak Per-Panca-Tugas?

- Satu kelompok mentoring melayani **semua fungsi**: ibadah (Liturgia), pembelajaran (Didaskalia), persekutuan (Koinonia), kebutuhan praktis (Diakonia), dan kesaksian (Marturia) terjadi di dalam satu rumah mentoring.
- Pembagian per-panca-tugas akan menduplikasi orang yang sama di banyak grup dan merusak data regenerasi.
- Detail direktori grup, family tree, heritage, dan mesin regenerasi (Jethro Engine) tampil khusus lewat navbar **`#/beyonders`**.

### Fasilitas per Group:

- **Drive folder unik**: Untuk agenda, foto, video tiap group
- **Meeting link**: Zoom/Google Meet tiap pertemuan
- **Agenda tercatat**: Tiap pertemuan memiliki agenda terstruktur
- **Dokumentasi**: Foto/video documentation tiap acara

---

## 10. Struktur Pillar & Sub-divisi (Reference)

| Pillar | Sub-divisi | Contoh Warna |
|--------|------------|-------------|
| LITURGIA | Liturgi & Musik, Pendoa, Intercessor | Ungu (#7C3AED) |
| DIDASKALIA | Kurikulum & Pembekalan | Biru (#0EA5E9) |
| KOINONIA | Program Persekutuan, Public Relations (PR) ⭐ | Hijau (#059669) |
| DIAKONIA | Logistik & Akomodasi, Konsumsi, Medis & First Aid | Oranye (#EA580C) |
| MARTURIA | Dokumentasi, Desain & Publikasi, Penginjilan Praktis | Merah (#DC2626) |
| BENZARPR (BZP) | Merchandise, Fundraising, Donation — Kepala: Fladyna Mondoringin | Kuning/Emas (#F6AE4A) |

⭐ = PR menangkap data newcomer pasca-retreat → Placement Recommender (Jethro Engine).

---

## 11. Multi-domain Org Tree (`OrgNode`)

Configurable hierarchy — separate from portal RBAC:

```
YOUTH domain
  BPMJ → Komisi → Tim Kerja
    ├─ BOD (Ketua / Sekre / Bendahara, division=TIMKERJA)
    ├─ Panca Tugas → 5 divisi → sub-divisi slots
    ├─ Benzarpreneurship
    └─ Beyonders (GROUP_REF → grup + familyRole)

KOLOM domain
  per Kolom → Diaken (max 1) + Penatua (max 1) + Anggota

CHURCH domain (future)
  flat or custom ministry trees
```

Admin: Portal → **Kelola Hirarki**. Seed: `npm run db:seed:org-tree`.

(End of file)