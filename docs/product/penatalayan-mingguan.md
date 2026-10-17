# Penatalayan Mingguan: Mentor Assign + Grup WA Temporer + Representative Day

> Status: **live lokal** (Okt 2026). Cakupan: **serving week**.
> Prinsip: mentor menugaskan kelompoknya sendiri; BOD orkestrasi mingguan;
> WA tetap manual di HP — sistem mengatur daftar, caption, pengingat, arsip.

## 1. Mentor assign langsung

- Mentor/co-mentor menugaskan **anggota ACTIVE kelompok binaannya** ke
  komponen `scope=UNIT` via kalender penatalayan (mode mentor otomatis:
  pencarian personel terfilter + banner).
- Guard server all-or-nothing: 1 orang di luar binaan → seluruh batch 403
  (pesan hanya jumlah, tanpa nama). Komponen jemaat (`CHURCH`) tetap HOD/BPMJ.
- HOD/Komisi/SUPERADMIN tidak berubah (tak terbatas).

## 2. Grup WA temporer per Minggu serving

- BOD buat grup di HP → tempel link di kartu **Grup WA temporer**
  (baris serving, tab Ibadah Mingguan) → `DRAFT → OPEN → CLOSED`.
- Daftar undangan digenerate: petugas pekan itu + mentor 2 grup serving +
  HOD/perwakilan divisi (nama saja, tanpa nomor HP).
- Caption siap-tempel: **undangan** (link + ajakan konfirmasi),
  **cara kerja alat**, **penutup** (terima kasih + keluar grup + arsip).
- Senin: cron mengingatkan BOD menutup kanal OPEN yang ibadahnya kemarin.

## 3. Representative Day (rapat petugas gabungan, H-3)

- Tombol **Isi template Representative Day** di Rapat & Jadwal event:
  6 agenda baku (Didaskalia konteks firman → pembaca firman; Liturgia
  latihan + setlist; Marturia slide; Diakonia venue + konsumsi; Koinonia
  tuan rumah + QR; doa covering), tiap agenda PIC + deadline H-1.
- Daftar peserta: HOD/perwakilan 5 divisi + 2 mentor serving + BOD.

## 4. Notifikasi & cron

- Audiens baru **SERVING_REPS** (perwakilan + petugas + mentor pekan itu):
  hanya BOD/Komisi; pengumuman menyimpan snapshot penerima.
- Cron harian: **Jumat H-2** (konfirmasi + link grup), **Sabtu H-1**
  (cara kerja + doa), **Senin H+1** (BOD tutup grup).

## 5. Video panduan (rekam sekali, pakai terus)

| # | Judul (30–60 dtk) | Untuk | Link Drive |
|---|---|---|---|
| 1 | Cara konfirmasi tugas di portal | Semua petugas | _diisi Marturia_ |
| 2 | Cara centang checklist persiapan | Semua petugas | _diisi_ |
| 3 | Cara scan QR absensi (bukan QRIS) | Koinonia + semua | _diisi_ |
| 4 | Cara buka materi pembekalan | Pembaca Firman | _diisi_ |
| 5 | Lapor cepat slide/proyektor bermasalah | Marturia + MC | _diisi_ |

Katalog kode: `TOOL_VIDEOS` di `src/lib/serving-week-caption.ts`
(url terisi otomatis muncul di caption cara kerja).

## 6. Operasional

```powershell
npm run db:migrate:serving-week          # tabel serving_week_channels
npm run db:migrate:serving-week:staging
```

## 7. Sinkron eventId & routing grup (Okt 2026)

- **Auto-taut event** — usulan mentor (`proposals/bulk`), request divisi, dan
  fulfill kini selalu menautkan `eventId` event ibadah pada **tanggal WIB yang
  sama** (SERVING_DAY / MENTORING_DAY / kind UMUM) bila klien tidak mengirim
  `eventId`. Helper: `resolveWorshipEventByDate` (`server/lib/service-events.mjs`).
- **Backfill data lama**:

```powershell
npm run backfill:penatalayan-link             # dry-run (lokal/.env)
npm run backfill:penatalayan-link:staging     # dry-run staging
# tambahkan --apply untuk menulis, lalu:
npm run backfill:petugas-attendance:staging   # absensi otomatis petugas
```

- **Panel usulan mentor** menampilkan banner “Mengisi untuk: {event}” dan
  mendukung deep-link `#/portal/<ns>/penatalayan-usulan?date=&event=`
  (dari notifikasi routing).
- **Routing penatalayan event** (mis. Bedah Film): di panel Penatalayan event,
  SUPERADMIN/Komisi/Committee menetapkan **grup Tuan Rumah & Penanggungjawab**
  (tersimpan di `EventProgram.metadata.penatalayanGroups`) lalu tombol
  **Kirim routing ke mentor** — mentor + co-mentor ACTIVE kedua grup menerima
  notifikasi kategori `penatalayan` berisi tautan pengisian usulan; divisi
  tetap meng-approve. Timestamp terakhir: `metadata.penatalayanRoutingAt`.
- **Kartu Info Event** (`/api/db/service-schedule`): event ber-`penatalayanGroups`
  menampilkan Tuan Rumah/Penanggungjawab pada hari yang belum punya baris siklus.
- **Notifikasi mentoring day (W1)**: cron Jumat H-2 & Sabtu H-1 kini juga
  mengirim pengingat ke **HOD (LEAD/CO_LEAD) event MENTORING_DAY** —
  `resolveMentoringDayHods` (`server/lib/serving-week.mjs`).

