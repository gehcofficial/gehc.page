# Pustaka Lagu Liturgia + Setlist Ibadah

> Status: **live lokal** (7 Okt 2026). Pemilik: **Liturgia** (pustaka lintas-unit).
> Rundown pola tetap milik Didaskalia (`WorshipPattern`); lagu per event milik Liturgia.

## 1. Konsep penyimpanan

- **DB TiDB = source of truth**: `songs` (pustaka GLOBAL, bisa dipakai semua unit)
  + `service_songs` (pemakaian per event/sesi: urutan + bagian + transpose).
- **Drive = artefak saja**: PDF chord-sheet / rekaman rehearsal tetap di
  `Musik & Vokal → Berkas/chord` (lihat `EventDivisionPhaseTabs`).
- **Hak cipta**: pustaka menyimpan **full lirik + ChordPro** untuk semua
  sumber (keputusan 7 Okt 2026 — risiko ditanggung gereja; akses baca =
  login, ekspor file = peran tulis). Pengisian *just-in-time*: pemusik
  mengisi lagu yang masuk susunan/order dulu.
- **Kontemporer ID/EN** (`songs-contemporary.json`, ±50 terkurasi):
  metadata + artis + tautan unlimitedworship/suaranafiri terverifikasi
  (tanpa lirik — milik label/artis); seed lewati judul yang sudah ada di
  himne/KLIK (mis. KLIK 57/93). Kolom `lang` (ID/EN, default ID) +
  filter `GET /api/songs?lang=` + toggle bahasa di pencarian.
  Layar yang liriknya belum ada menampilkan placeholder + tombol link
  sumber (SABDA/alkitab.app). Kontemporer tetap wajib isi kolom
  copyright/CCLI. **Sekuler tetap tanpa lirik** (metadata +
  tautan saja, momen bebas/bedah-lagu).

## 2. Alur Liturgia (tab Ibadah → kartu Lagu Ibadah)

1. Pilih event → kartu **Lagu Ibadah**: setlist berurutan (naik/turun/hapus).
2. **Cari pustaka** (judul / `KJ 478` / `NNBT 42` / `PKJ 15` / `KLIK 125` / pencipta / CCLI) → `Pakai`.
3. **Lagu baru** (manual ChordPro + metadata + link SABDA/SongSelect) →
   otomatis masuk setlist.
4. Per lagu: momen (pembuka/firman/persembahan/penutup/bedah-lagu/bebas),
   kunci, **Nada ±** (satu kontrol geser nada), **susunan main**
   (ProPresenter: urutan + pengulangan + modulasi), catatan pemusik,
   tab **Chord** (chord di atas lirik) / Lirik.
5. Ekspor per lagu: **`.show`** · **ChordPro** · **salin Quick Lyrics**;
   ekspor JSON gabungan API-ready per event.

## 3. ChordPro (kanonis)

- Header bagian = 1 baris `[Nama]`; chord inline `[C]`, `[F#m7/G#]`.
- Transpose ±11 seminada, header tidak ikut digeser; sharp/flat mengikuti
  gaya penulisan asal. Mesin: `src/lib/song-chords.ts` (klien) ↔
  `server/lib/liturgy-songs.mjs` (server, perilaku identik, teruji sama).

## 4. Integrasi FreeShow

- Fase berjalan: **ekspor file** → FreeShow `File → Import → ChordPro`,
  atau Quick Lyrics via `CTRL+ALT+I` (metadata `Title/CCLI/Copyright/Author/Key`
  terisi otomatis; bagian mengikuti pilihan checkbox).
- Siap API: `GET /api/events/:id/songs/export` mengembalikan
  `shows[].show` (format `.show` JSON: slide per bagian + layout Default +
  metadata kunci/transpose/capo) — siap `POST` ke `http://localhost:5506`
  setelah operator mengaktifkan API di FreeShow → Connections.
- Chord mode + transpose stage-only tetap diatur di FreeShow
  (lihat `freeshow.app/docs/chords`).

## 5. API ringkas

| Endpoint | Akses |
|---|---|
| `GET /api/songs?q=&source=&limit=` | login |
| `POST /api/songs`, `PUT /api/songs/:id`, `DELETE` (arsip bila dipakai) | Liturgia + tulis |
| `GET /api/events/:id/songs` | login |
| `POST /api/events/:id/songs`, `PUT .../:itemId`, `DELETE .../:itemId`, `POST .../reorder` | Liturgia + tulis |
| `GET /api/events/:id/songs/export[?download=show\|chordpro\|quicklyrics&itemId=]` | login |

## 6. Operasional

```powershell
npm run db:migrate:liturgy-songs        # tabel songs + service_songs
npm run db:seed:liturgia-songs          # KJ 478 + NKB 230 + NNBT 50 + PKJ 308 + KLIK ±480 + 1 contoh lokal
npm run db:migrate:liturgy-songs:staging
npm run db:seed:liturgia-songs:staging
npm run db:migrate:liturgy-songs:prod
npm run db:seed:liturgia-songs:prod
```

- Seed memakai judul terverifikasi (`res=kidung_jemaat`, `res=nkb` via
  SABDA; NNBT/PKJ/KLIK via `alkitab.app`; data di
  `server/seed-data/songs-hymns.json`, `songs-nnbt.json`, `songs-pkj.json`,
  `songs-klik.json`); metadata dulu, ChordPro menyusul oleh pemusik via UI.
  KLIK memakai `sourceRef` string apa adanya (`KLIK 203A`, `KLIK 451b` —
  nomor tak kontinu). Status 7 Okt 2026: staging 1546, prod 1546
  (478 KJ + 230 NKB + 50 NNBT + 308 PKJ + 479 KLIK + 1 lokal). Lagu SEKULER tidak di-seed
  massal — input manual via UI (wajib pencipta + tautan).

## 7. Tata ibadah live + transpose pemusik
- **Susunan** (`service_order_items`): momen `lagu` menunjuk setlist
  (`serviceSongId`, satu event); momen non-lagu (`bacaan/doa/firman/
  persembahan/pengumuman/mc`) membawa `title/body/owner/minutes` sendiri.
  Disusun Liturgia di tab Ibadah → kartu **Tata Ibadah**.
- **Live** (`service_live_state` per event): `status DRAFT/LIVE/DONE` +
  `currentItemId` + `sectionIndex` (bait aktif — proyektor & HP sinkron
  sampai level bait) + `accessCode` 6-hex (kode proyektor).
- **Rute:** `#/ibadah/<eventKey>/layar` (proyektor + HP jemaat, read-only;
  login ATAU kode proyektor) dan `#/ibadah/<eventKey>/kontrol`
  (operator Liturgia, login + peran tulis).
- **Layar lagu** = lirik bersih (`stripChords`, tanpa transpose); bila
  `lyricsChordPro` kosong → placeholder + tombol link sumber
  (SABDA/alkitab.app). Pemusik wajib mengisi ChordPro lagu yang dipakai.
- **Transpose personal** (`service_song_settings`, unik per
  lagu-setlist + akun): tiap pemusik atur transpose/capo-nya sekali
  (tombol **Chord saya** di setlist) → preview + unduh
  `ChordPro saya` (`export?download=chordpro&itemId=&asMe=1`).
  Tanpa setting = pakai default tim. FreeShow tetap didukung via ekspor.
- **API:** `GET/POST/PUT/DELETE /api/events/:id/order` (+`/reorder`),
  `GET /api/events/:id/liturgy-live` (login/kode),
  `PUT /api/events/:id/liturgy-live` (+`rotateCode`),
  `GET/PUT /api/events/:id/songs/:itemId/mysetting` (akun sendiri).
- **Migrasi:** `npm run db:migrate:liturgy-live[:staging|:prod]`.

## 8. Editor lirik + chord (ChordPro v2)

- **Isi lirik:** tombol **Isi lirik** di hasil pustaka / setlist memuat lagu ke
  editor (POST baru / PUT perbarui). SEKULER dikecualikan server (tanpa lirik).
- **Template bagian:** Intro, Verse 1–4, Pre-Chorus, Chorus, Bridge,
  Interlude, Ending, Tag, Coda — tombol sisip di posisi kursor
  (`SECTION_TEMPLATES`; parser tetap generik).
- **Chord di atas lirik:** tulis baris chord di atas baris lirik, klik
  **Gabungkan chord di atas** → dikompilasi ke inline `[C]`
  (`compileChordOverLyrics`). Aturan: baris multi-chord selalu chord;
  1 token ambigu (mis. `C`, `Amin`) dianggap lirik kecuali menjorok /
  berkualitas (`Am`, `F#m7`, `C/G`) — cek hasil gabungan sebelum simpan.
- **Nada dasar / key picker:** `defaultKey` = kunci partitur tersimpan;
  dropdown **Main di…** menghitung `transposeSteps(nadaDasar, target)`
  otomatis (0–11 ke atas; nama chord identik mod 12, mis. G→D = +7).
  Tampilan kunci efektif: `transposeKey(nadaDasar, transpose)`.
  Personal per pemusik via **Chord saya** (tak berubah).
- **FreeShow:** jalur utama = impor file ChordPro di FreeShow
  (File → Import — hasil paling setia). Ekspor `.show` JSON / Quick Lyrics
  dari GEHC = jalan pintas (slide per bagian, layout default); bait sangat
  panjang bisa terpotong berbeda vs importer asli — pecah jadi 2 bagian
  bila perlu.

## 9. Editor master batch + susunan bernama + pool master

- **Batch, bukan live:** `SongMasterEditor` (4 tab: Lirik, Susunan, Chord,
  Nada) mengedit DRAFT lokal; satu tombol **Simpan** = satu PUT/POST.
  Indikator "belum tersimpan", tombol Batal, validasi blokir Simpan
  (judul wajib, pool/varian tak dikenal, nama ganda/kosong, lirik di sekuler).
  Kontrol setlist cepat (transpose −/+, capo, reorder momen) tetap live.
- **Dua tingkat:** lirik = semua bagian sesuai teks; **setlist master
  (pool)** = bagian resmi (subset + urutan sendiri, mis. Intro→…→Ending);
  **variants** = susunan main bernama (`full`: V1-C-V2-C…, `v1only`: V1-C).
  Entri varian wajib dari pool; pool wajib dari lirik. Kolom
  `songs.arrangement` menyimpan `{master, variants}` (array tunggal lawas
  dibaca sebagai satu varian "Susunan").
- **Edit posisi = staged:** editor susunan per-event maupun per-varian hanya
  mengubah draft (naik/turun/preset/modulasi/duplikat/tambah/hapus);
  tombol **Simpan susunan** mengirim satu PATCH; **Batal** kembalikan.
  Kelola varian (baru/duplikat/rename/hapus) juga dalam draft master.
- **Setlist pakai salinan beku:** "Pakai susunan [nama]" menyalin entri
  varian ke pemakaian (satu aksi eksplisit, langsung tersimpan); edit master
  belakangan tak mengubah setlist lama. Label `dari: <nama>` bila cocok
  persis, `kustom` bila diedit, `master [<nama>]` bila ikut default.
- **Precedence tampil/ekspor/layar:** `ServiceSong.sections` (bila diisi) →
  varian default master (pertama) → full master (`effectiveArrangement`,
  paritas server↔klien).
- **Tab Chord editor:** tiap baris lirik punya input chord di atasnya
  (`chordLyricPairs` + `applyChordLine` posisional); tersimpan ke draft
  per ketikan, ke server hanya via Simpan.
- **Tab Nada + rewrite:** pilih kunci tampil ≠ nada dasar → pratinjau
  transpose seluruh lagu; saat Simpan, chord ditulis ulang
  (`transposeChordPro`) dan `defaultKey` = kunci tampil. Modulasi absolut
  per baris dan offset relatif tetap valid.

## 9. Bedah lagu kontekstual + berkisah (MONOLOG)

- **Masalah:** AI bebas mengarang (cth. "Mendekat" oleh "Luthfi"). Kini lagu
  **wajib** dari KJ/NKB/NNBT dengan format `BUKU NOMOR` (cth. `KJ 10`).
- **Kunci draft** (`section song`): `song-title`, `song-book-ref`, `song-writer`
  (pencipta, bukan penyanyi), `song-story` (kisah + kaitan firman, diakhiri
  "(perlu verifikasi tim)"), `song-about` (makna per bait), `song-id`
  (tautan pustaka; kunci lama `song-singer` tetap dibaca sebagai fallback).
- **Aturan AI (`SONG_RULES`):** dilarang mengarang judul/nomor/pencipta;
  bila tak yakin → kosongkan. Contoh jebakan eksplisit: "Mengikut Yesus
  Keputusanku" BUKAN KJ/NKB (ia KK 399 / KPPK 214; kisah Nokseng, suku Garo).
- **Pemilih pustaka** di form Draft Sesi mengunci judul + nomor + pencipta
  dari `songs`; badge kuning bila lagu di luar pustaka.
- **Kurasi:** kolom `songs.story`/`meaning` (migrasi `db:migrate:liturgy-songs`
  idempotent) diisi tim via editor lagu Liturgia; tampil di web + layar +
  PDF rekap (badge "perlu verifikasi" selama kisah usulan AI).

## 10. Susunan main + tab Chord + modulasi (per setlist)

- **Lirik = reference point**: `lyricsChordPro` master satu-satunya; semua
  render (lirik/chord/ekspor/layar) turunan fungsi murni.
- **Susunan ala ProPresenter** tersimpan per setlist item (`sections` =
  ordered list boleh berulang, tanpa migrasi skema — kolom JSON sudah array):
  tambah/hapus/naik/turun/duplikat baris + preset (Full, V1+C, V1 C V2 C,
  V1 C V2 C B C). Kosong = full master sesuai urutan lagu. Nama tak dikenal
  ditolak server (400); render melewatinya diam-diam (tahan lirik diedit).
  Pengulangan dilabeli otomatis (Chorus, Chorus 2…) di pratinjau/ekspor/layar.
- **Tab Chord**: `renderChordOverLyrics` — baris chord sejajar di atas tiap
  baris lirik (monospace), turunan master + susunan + transpose/modulasi.
  Tampil-saja; edit tetap di ChordPro master (hindari divergensi).
- **Modulasi per baris**: "Mod → D" mulai baris itu, berlaku ke bawah;
  offset = `transposeSteps(kunciDasar, target)` (absolut, ikut nada personal).
  Label `· D` + penanda `{comment: Modulasi ke D}` di ChordPro/tab chord.
- **Validasi**: `validateArrangementSections` (400 bila nama asing);
  `normalizeArrangement` (maks 30 entri, kunci tak valid diabaikan).

## 11. Kerangka segmen pola + firman auto-sync

- **Satu sumber**: spec slot hidup di fase pola Didaskalia
  (`phases[].segments`: `{key, label, kind: 'song'|'firman', songs}`).
  Hanya fase ber-segmen yang menjadi kerangka; fase diskusi/MC/dll dilewati.
- **Peta awal (draf, perlu review Didaskalia):** MONOLOG f1
  praise×3/worship×2/bedah-lagu×1, f2 firman, f6 persembahan×2;
  POST_TO_POST f1 praise×2, f2 firman; DEBAT f1 pembuka×1 + firman,
  f3 persembahan×1; BEDAH_FILM f1 praise×2, f5 persembahan×1;
  THREE_SEQUENCES f1 pembuka×1 + firman, f6 firman + persembahan×1.
- **Composer Liturgia**: kartu referensi rundown (baca-saja) + tombol
  **Bangun kerangka** (bulk, append; konfirmasi bila susunan sudah ada).
  Tiap slot lagu kosong = pilih lagu setlist; slot terisi = badge,
  slot kosong = peringatan (bukan blokir); momen kustom tetap bisa ditambah.
- **Firman auto-sync**: momen firman tanpa body menampilkan perikop pekan
  dari Studio (`fundamentalFirman.ref + text`, `kitabFokus`) + badge
  `auto-sync`; isi body manual = menang + badge `manual`.
  Resolve di server saat baca (`readWeekPericope` via tanggal event),
  jadi edit Studio langsung tercermin tanpa sentuh susunan.
- **Jejak segmen**: `service_order_items.segment_key` (`fase:key`) +
  `phase_no` (migrasi idempotent) — tampil `§` di composer; layar/kontrol
  tetap per momen.
