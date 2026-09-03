# Model Operasional Panca Tugas & BZP — GEHC Youth

> Runbook, RACI, dan definisi peran sub-divisi v1 (2026).  
> Sumber kebenaran kode: `src/lib/pantatugas.ts` · Data: `struktur_members.subdivision`

## 1. Prinsip

- **5 Panca Tugas** = fungsi gereja permanen (Liturgia · Didaskalia · Koinonia · Diakonia · Marturia).
- **Setiap pillar** punya **1 Kepala Divisi** (HoD); anggota sub-divisi **bertambah seiring waktu**.
- **BZP** = stewardship materi, **tanpa HoD** — langsung bertanggung jawab ke **BOD Tim Kerja**.
- **Beyonders** = pemuridan relational, **bukan** sub-divisi panca tugas.
- Positions kosong: `is_open_role: true` + label rekrutmen (lihat §8).

## 2. Katalog sub-divisi (20 unit)

### Liturgia — HoD: Holly Kalele

| Sub-divisi (ID) | EN | Peran |
|---|---|---|
| Liturgi & Ibadah | Liturgy & Worship | Urutan ibadah Word-centered, WL, banners, flow |
| Musik & Vokal | Music & Vocals | Band, singers, kantoria, rebanda |
| Doa & Intercession | Prayer & Intercession | Doa korporat, pastoral, covering acara |

### Didaskalia — HoD: rekrutmen

| Sub-divisi (ID) | EN | Peran |
|---|---|---|
| Kurikulum Pemuridan | Discipleship Curriculum | Modul SG, tes karunia, worldview pemuda |
| Pembekalan Tim | Team Equipping | Pelatihan mentor/comentor, BAKU TAU (Lead: Putri & Alvandi) |

### Koinonia — HoD: rekrutmen

| Sub-divisi (ID) | EN | Peran |
|---|---|---|
| Program & Acara | Programs & Events | Konsep, rundown, games (PIC: Krisetia Mamoto) |
| Persekutuan & Integrasi | Fellowship & Integration | Welcome, hospitality, care ringan |
| Hubungan & Komunikasi | Relations & Communications | MC, sosmed, broadcast, FAQ → Jethro newcomer |

### Diakonia — HoD: rekrutmen

| Sub-divisi (ID) | EN | Peran |
|---|---|---|
| Logistik & Fasilitas | Logistics & Facilities | Venue, peralatan (PIC: Prichel Kampong) |
| Konsumsi & Keramahan | Food & Hospitality | Menu, vendor (PIC: Artjuna Timbuleng) |
| Kesehatan & Keselamatan | Health & Safety | First aid, protokol darurat |
| Kasih Peduli & Benevolence | Mercy & Benevolence | Bantuan praktis, kunjungan sakit |
| Dukungan Perantau | Commuter & Workplace Support | Adaptasi Cikarang, burnout, resource perantau |

### Marturia — HoD: Gievara Bogar

| Sub-divisi (ID) | EN | Peran |
|---|---|---|
| Dokumentasi Visual | Visual Documentation | Foto/video, arsip Drive |
| Desain & Publikasi | Design & Publication | Poster, deck, brand asset |
| Kesaksian & Story | Testimony & Story | Testimoni wall, narrative witness |
| Penginjilan & Misi | Evangelism & Outreach | Outreach rutin, pre-evangelism |

### Benzarpreneurship — tanpa HoD

| Sub-divisi (ID) | EN | Peran |
|---|---|---|
| Merchandise & Produk | Merchandise & Products | Katalog, stok, toko portal |
| Penggalangan Dana | Fundraising | Campaign dana (PIC: Fladyna Mondoringin) |
| Persembahan & Donasi | Offerings & Donations | QRIS, rekonsiliasi ke Bendahara Tim Kerja |

## 3. RACI lintas-divisi

| Aktivitas | R | A | C | I |
|---|---|---|---|---|
| Proposal acara | Koinonia Program | Ketua Tim Kerja | Didaskalia, Liturgia, Diakonia, Marturia | Komisi |
| Rundown ibadah | Liturgia | HoD Liturgia | Tim Kerja | Koinonia |
| Materi pembelajaran | Didaskalia Kurikulum | HoD Didaskalia | Mentor Beyonders | Komisi |
| Logistik venue | Diakonia Logistik | HoD Diakonia | Koinonia Program | Tim Kerja |
| Desain poster | Marturia Desain | HoD Marturia | — | Koinonia Hubungan |
| Posting sosmed | Koinonia Hubungan | HoD Koinonia | Marturia Desain | — |
| Dokumentasi acara | Marturia Dokumentasi | HoD Marturia | — | Komisi |
| Newcomer → placement | Koinonia Hubungan | HoD Koinonia | Jethro/Komisi | Mentor |
| Soal tambahan event | Koinonia Program | Ketua Tim Kerja | Konsumsi, Kesehatan, Hubungan, Logistik | Komisi |
| Katalog soal baru | Tim Kerja (usul) | Komisi (approve) | Koinonia Hubungan | — |
| WA grup peserta | Koinonia Hubungan | Ketua Tim Kerja | — | tulis hanya di Program & Event → Edit |
| Benevolence member | Diakonia Kasih Peduli | HoD Diakonia | Bendahara/BZP | Komisi |
| Transaksi merch/donasi | BZP | Bendahara Tim Kerja | Diakonia Kasih Peduli | Komisi |
| Testimoni publik | Marturia Kesaksian | Komisi (approve) | Mentee author | — |

**R** = Responsible · **A** = Accountable · **C** = Consulted · **I** = Informed

## 4. Runbook acara standar (H-21 → H+7)

### H-21 · Kickoff

- [ ] Tim Kerja brief ke HoD Koinonia (tema, tanggal, budget draft).
- [ ] Koinonia Program: proposal + rundown awal.
- [ ] Koinonia Hubungan: kalender publikasi.

### H-14 · Perencanaan lintas tim

- [ ] Koinonia → Didaskalia: kebutuhan materi/sesi.
- [ ] Koinonia → Liturgia: brief ibadah.
- [ ] Koinonia → Diakonia: kebutuhan logistik/konsumsi/kesehatan.
- [ ] Koinonia → Marturia: brief dokumentasi & desain.
- [ ] Koinonia → BZP (opsional): merch/fundraising.

### H-7 · Finalisasi

- [ ] Liturgia: rundown spiritual + rehearsal plan.
- [ ] Diakonia Logistik: cek venue & inventory.
- [ ] Marturia Desain: asset final → handoff Hubungan & Komunikasi.
- [ ] Didaskalia: materi siap distribusi mentor.

### H-3 · Rehearsal

- [ ] Liturgia Musik & Vokal: rehearsal.
- [ ] Koinonia Hubungan: briefing MC.
- [ ] Diakonia Kesehatan: kit & protokol darurat.

### H-1 · Pre-event

- [ ] Liturgia Doa & Intercession: prayer covering aktif.
- [ ] Diakonia Konsumsi: prep distribusi.
- [ ] Koinonia Persekutuan: ice breaker & welcome flow.

### H+0 · Event day

- [ ] Semua HoD on-call; insiden → Ketua Tim Kerja.
- [ ] Marturia Dokumentasi: coverage aktif.

### H+1 · Post-event

- [ ] Marturia: upload Drive `[EVENT:slug]`.
- [ ] Koinonia Hubungan: input newcomer ke Jethro.
- [ ] Diakonia: laporan insiden (jika ada).

### H+7 · Retro

- [ ] Tim Kerja: retro singkat dengan HoD terkait.
- [ ] Marturia Kesaksian: kumpulkan draft testimoni (approve Komisi sebelum publish).

## 5. Runbook mercy & perantau (berjalan terus)

1. Mentor/Koinonia lapor kebutuhan → **Diakonia Kasih Peduli** (H+3).
2. Kasih Peduli assess; jika perlu dana → **BZP Persembahan & Donasi** + **Bendahara Tim Kerja**.
3. **Dukungan Perantau**: check-in komunitas bulanan + resource sheet (link WA/grup).

## 6. Runbook keuangan BZP

1. Penggalangan Dana / Merchandise: rencana target → approval Bendahara Tim Kerja.
2. Transaksi via portal + QRIS.
3. Rekonsiliasi mingguan → Bendahara → laporan bulanan Komisi.

## 7. Hierarki jabatan

```
Kepala Divisi (1 per pillar panca tugas)
  └─ Koordinator Sub-Divisi (0–1 per sub, opsional)
       └─ Anggota Tim (unlimited)
```

BZP: Koordinator Sub-Divisi saja (no HoD) → lapor BOD Tim Kerja.

## 8. Penanda rekrutmen

| Konteks | Nama DB (`name`) | EN (i18n) |
|---|---|---|
| HoD kosong | `Kepala Divisi — Rekrutmen Berlangsung` | `Head of Division — Open / Recruiting` |
| Koordinator kosong | `Koordinator — Posisi Terbuka` | `Coordinator — Open Role` |

Kolom `is_open_role: true` · UI: badge dashed di `#/leaders`.

## 9. Migrasi nama lama → baru

Lihat tabel di `docs/product/pantatugas.md` §10 dan jalankan:

```powershell
npm run db:migrate:pancatugas
npm run db:seed-users:staging
npm run db:seed:org-tree:staging
```

Drive: audit sinkronisasi di Portal → Integrasi setelah migrasi DB.
