# Portal per Unit — Usulan Modul (F3.5)

> Status: **usulan untuk ditinjau** (26 Sep 2026). Belum ada implementasi.
> Melanjutkan F1–F3.4 (portal per domain, tenant, peran per unit, data ter-scope).
> Dokumen desain besar: [`church-portal.md`](church-portal.md).

---

## 1. Fondasi yang sudah ada (F1–F3.4)

| Lapis | Status |
|---|---|
| Portal per domain | ✓ hub `gehc.page` = Jemaat; `youth/teen/kids/men/women/districts/community` buka portalnya |
| Tenant | ✓ `tenant-jemaat` (payung) + 7 tenant unit; `defaultBipra` per unit |
| Peran per unit | ✓ scoping ketat (`rolesInTenant`): peran unit + peran jemaat + SUPERADMIN |
| Data ter-scope | ✓ event, kalender, program, konten, testimoni (unit = unit+jemaat; jemaat = semua) |
| Nav per portal | ✓ tag `portals[]` (BERSAMA vs Pemuda-only vs Jemaat-only) |

**Konsep kunci**
- **BIPRA** (BAPAK/IBU/PEMUDA/REMAJA/ANAK) = kategorial → tenant unit.
- **Kolom** = teritorial, **campur BIPRA** → tenant `tenant-districts`.
- **Peran bertingkat**: `KOMISI`/`COMMITTEE`/`ALUMNI` berlaku di semua jenis unit; `MENTOR`/`CO_MENTOR`/`MENTEE` khusus Pemuda; `BPMJ`/`SUPERADMIN` tingkat jemaat.
- **Departemen jemaat** (PEMBANGUNAN/THL/TECHTEAM/PANJI) ≠ **unit BIPRA** — departemen memakai `StrukturMember.division` (P0), bukan tenant.

---

## 2. Modul BERSAMA (sudah ada di semua portal)

`Info Event` · `Kegiatan` · `Info & Peluang` · `Dashboard & Ringkasan` · `Portal Doa` · `Warta` · `Direktori Jemaat` · `Kanal WhatsApp` · `Akun Saya` · `Program & Event` · `Benzarpreneurship (BZP)`.

Semua sudah ter-scope tenant (F3.4) → unit otomatis melihat data unitnya + jemaat.

---

## 3. Usulan modul per unit

Format: **tujuan → anggota → peran → modul (tab)**.

### 3.1 Remaja (tenant-teen · REMAJA)
- **Tujuan**: pembinaan remaja SMP–SMA.
- **Anggota**: SMP/SMA, pembina/guru remaja, pengurus komisi remaja.
- **Peran**: KOMISI, COMMITTEE, ALUMNI (+ pembina sebagai COMMITTEE).
- **Modul usul**:
  1. **Kelompok Remaja** — small group per angkatan/kelas, pemimpin, anggota.
  2. **Kurikulum & Tema** — rencana pembinaan per bulan/pekan (mirip Didaskalia ringkas).
  3. **Kehadiran Remaja** — absensi ibadah/persekutuan + rekap.
  4. **Orang Tua/Wali** — kontak & komunikasi wali (opsional, privat).
  5. **Kegiatan Remaja** — retret/camp remaja (pakai `EventProgram` scoped).

### 3.2 Anak (tenant-kids · ANAK)
- **Tujuan**: Sekolah Minggu & pelayanan anak.
- **Anggota**: anak per kelas usia, guru SM, pengurus.
- **Peran**: KOMISI, COMMITTEE.
- **Modul usul**:
  1. **Kelas Sekolah Minggu** — kelas per usia (Balita/Kecil/Besar), guru, ruang.
  2. **Kurikulum SM** — tema & bahan per pekan.
  3. **Kehadiran Anak** — absensi + catatan (untuk rekonsiliasi kelas).
  4. **Orang Tua/Wali** — kontak wali & izin kegiatan.
  5. **Kegiatan Anak** — Paskah/Natal anak, lomba (pakai `EventProgram`).

### 3.3 Kaum Bapa (tenant-men · BAPAK)
- **Tujuan**: persekutuan & pelayanan pria/keluarga.
- **Anggota**: pria dewasa jemaat, pengurus P/KB.
- **Peran**: KOMISI, COMMITTEE, ALUMNI.
- **Modul usul**:
  1. **Koinonia P/KB** — daftar anggota + kelompok/wilayah.
  2. **Kegiatan & Ibadah P/KB** — jadwal persekutuan, HUT P/KB.
  3. **Pelayanan Praktis** — jadwal kebersihan/pemeliharaan gedung (dapat menyambung departemen PEMBANGUNAN).
  4. **Kas P/KB** — iuran & penggunaan (menyambung P1 Keuangan: akun `KAS_UNIT`).
  5. **Kunjungan/Diakonia** — daftar kunjungan & bantuan.

### 3.4 Kaum Ibu (tenant-women · IBU)
- **Tujuan**: persekutuan & pelayanan wanita.
- **Peran**: KOMISI, COMMITTEE, ALUMNI.
- **Modul usul**:
  1. **Koinonia W/KI** — anggota per kelompok/wilayah.
  2. **Kegiatan & Ibadah W/KI** — jadwal, HUT W/KI.
  3. **Diakonia & Kunjungan** — kunjungan orang sakit, bantuan.
  4. **Kas W/KI** — iuran & penggunaan.
  5. **Pelayanan Jemaat** — konsumsi/dekorasi event jemaat (kolaborasi).

### 3.5 Kolom / Wilayah (tenant-districts · teritorial, campur BIPRA)
- **Tujuan**: penggembalaan teritorial per Kolom.
- **Anggota**: jemaat per Kolom (semua BIPRA), pengurus Kolom.
- **Peran**: KOMISI, COMMITTEE (ketua Kolom).
- **Modul usul**:
  1. **Data Keluarga (KK) per Kolom** — kepala keluarga + anggota (privat).
  2. **Pengurus Kolom** — struktur (memakai `Kolom` + `StrukturMember`).
  3. **Ibadah & Kegiatan Kolom** — jadwal ibadah Kolom/wilayah.
  4. **Kunjungan & Doa Kolom** — penggembalaan teritorial.
  5. **Peta Wilayah** — batas area/alamat (opsional).

### 3.6 Komunitas & Rekreasional (tenant-community)
- **Tujuan**: minat, bakat, musik, olahraga.
- **Peran**: KOMISI, COMMITTEE, ALUMNI.
- **Modul usul**:
  1. **Grup Minat** — musik, olahraga, seni, dst (mirip `Group` tapi lintas BIPRA).
  2. **Jadwal Latihan** — sesi & ruang (menyambung Fasilitas/P1 untuk booking).
  3. **Anggota & Keahlian** — daftar anggota + talenta (pakai katalog minat yang ada).
  4. **Event Rekreasional** — turnamen, konser (pakai `EventProgram`).

### 3.7 Pemuda (tenant-youth) — sudah ada, tidak berubah
Beyonders/kelompok, 5 Divisi (Liturgia/Didaskalia/Koinonia/Diakonia/Marturia/BZP), monitoring, regenerasi, retreat.

---

## 4. Modul lintas unit (kandidat baru, bisa dipakai semua unit)

| Modul | Fungsi | Catatan |
|---|---|---|
| **Pengurus Unit** | Struktur pengurus per unit (ketua/sekretaris/bendahara/seksi) | pakai `StrukturMember` + `division=unit`, atau `UserRole` per tenant |
| **Anggota Unit** | Daftar anggota (dari `User.bipra` / `kolomId`) | sumber keanggotaan (lihat §5) |
| **Kas Unit** | Kas unit sederhana | menyambung P1 `CashAccount(kind=KAS_UNIT)` |
| **Kegiatan Unit** | Agenda unit | sudah via `EventProgram` ter-scope (tak perlu modul baru) |
| **Warta Unit** | Pengumuman unit | bisa memakai `InternalWarta`/`Announcement` + scope |
| **Absensi Unit** | Kehadiran kegiatan/persekutuan | pakai `AttendanceRecord` + scope, atau `EventCheckIn` |

---

## 5. Keanggotaan & akses dasar (keputusan diinginkan)

Saat ini portal unit hanya untuk yang punya **peran** di unit itu/jemaat. Anggota biasa (mis. BAPAK tanpa jabatan) belum bisa masuk portal Kaum Bapa.

**Opsi:**
- **A. Peran baru `MEMBER`** (perlu ubah enum `Role`) — diberikan otomatis per tenant sesuai `User.bipra`; nav dasar untuk anggota; peran menambah hak. *Paling rapi, perlu migrasi enum + daftar peran + nav.*
- **B. Keanggotaan implisit (tanpa peran)** — server/klien memakai `User.bipra`/`kolomId` sebagai "member tier"; nav dasar tampil; API dasar (event, warta, info & peluang) sudah tak butuh peran. *Tanpa ubah enum, sedikit penyesuaian nav/RBAC.*
- **C. Biarkan** — hanya pengurus yang masuk portal unit (status sekarang).

**Rekomendasi:** **B** dulu (cepat, aman), **A** menyusul bila butuh penugasan anggota per unit.

> **Keputusan (26 Sep 2026): B dipilih & sudah diterapkan (F3.5.0).** Role sintetis `MEMBER` (tanpa ubah enum DB) dari `User.bipra` (kategorial) / `kolomId` (Kolom); nav dasar: Info Event, Kegiatan, Info & Peluang, Dashboard, Akun. `isMember` dari `/api/auth/me`.

---

## 6. Roadmap F3.5 (usulan bertahap)

1. **F3.5.0 — Keanggotaan & nav dasar** ✓ (opsi B) → anggota bisa membuka portal unitnya.
2. **F3.5.1 — Pengurus Unit** (struktur per unit).
3. **F3.5.2 — Modul Kolom** (data KK + ibadah Kolom) — dampak besar untuk penggembalaan teritorial.
4. **F3.5.3 — Kaum Bapa & Kaum Ibu** (koinonia + kegiatan + kunjungan).
5. **F3.5.4 — Remaja & Anak** (kelompok/kelas + kurikulum + absensi).
6. **F3.5.5 — Komunitas/Rekreasional** (grup minat + jadwal).
7. Integrasi **Kas Unit** menyusul fase P1 Keuangan.

---

## 7. Keputusan yang diminta

1. **Keanggotaan**: pilih opsi A/B/C di §5.
2. **Urutan unit**: mulai dari mana (usulan: Kolom atau Kaum Bapa/Ibu)?
3. **Modul mana** yang wajib ada vs opsional per unit (agar tidak over-build).
4. **Data anggota**: apakah portal unit boleh menampilkan daftar anggota (nama/HP) ke pengurus unit? (privasi)
5. **Kolom**: apakah data KK boleh disimpan (nama+alamat) atau cukup tautan ke data jemaat yang ada?
