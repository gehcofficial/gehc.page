# Pustaka Lagu Liturgia + Setlist Ibadah

> Status: **live lokal** (7 Okt 2026). Pemilik: **Liturgia** (pustaka lintas-unit).
> Rundown pola tetap milik Didaskalia (`WorshipPattern`); lagu per event milik Liturgia.

## 1. Konsep penyimpanan

- **DB TiDB = source of truth**: `songs` (pustaka GLOBAL, bisa dipakai semua unit)
  + `service_songs` (pemakaian per event/sesi: urutan + bagian + transpose).
- **Drive = artefak saja**: PDF chord-sheet / rekaman rehearsal tetap di
  `Musik & Vokal → Berkas/chord` (lihat `EventDivisionPhaseTabs`).
- **Hak cipta**: himne KJ/NKB tersimpan sebagai **metadata + tautan SABDA**
  (tanpa full lirik). Full ChordPro hanya untuk lagu tim sendiri / public
  domain / berizin. Kontemporer wajib isi kolom copyright/CCLI.

## 2. Alur Liturgia (tab Ibadah → kartu Lagu Ibadah)

1. Pilih event → kartu **Lagu Ibadah**: setlist berurutan (naik/turun/hapus).
2. **Cari pustaka** (judul / `KJ 478` / pencipta / CCLI) → `Pakai`.
3. **Lagu baru** (manual ChordPro + metadata + link SABDA/SongSelect) →
   otomatis masuk setlist.
4. Per lagu: momen (pembuka/firman/persembahan/penutup/bedah-lagu/bebas),
   kunci, transpose ±, capo, checkbox bagian (`[Verse 1]`, `[Chorus]`…),
   catatan pemusik, preview Chord/Lirik.
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
npm run db:seed:liturgia-songs          # full KJ 1-478 + NKB 1-230 + 1 contoh lokal
npm run db:migrate:liturgy-songs:staging
npm run db:seed:liturgia-songs:staging
npm run db:migrate:liturgy-songs:prod
npm run db:seed:liturgia-songs:prod
```

- Seed memakai judul terverifikasi dari SABDA (`res=kidung_jemaat`,
  `res=nkb`; data di `server/seed-data/songs-hymns.json`); metadata dulu,
  ChordPro menyusul oleh pemusik via UI. Status 7 Okt 2026: staging 709,
  prod 709 (478 KJ + 230 NKB + 1 lokal).
