-- Venue & waktu acara di level EventProgram, supaya bisa diedit dari portal
-- alih-alih hardcoded di server/lib/baku-tau.mjs.
--
-- event_date dipisah dari start_date karena start_date dipakai sebagai rentang
-- program (BAKU TAU: 2026-01-01 s/d 2026-12-31), bukan hari pelaksanaan.
--
-- Dijalankan idempotent lewat server/_migrate-event-venue.cjs.

ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS event_date DATETIME(3) NULL;
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS venue_name VARCHAR(190) NULL;
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS location_detail VARCHAR(190) NULL;
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS map_url VARCHAR(512) NULL;
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS map_embed_query VARCHAR(190) NULL;

-- Koreksi zona waktu: '2026-09-12 15:00:00' disisipkan sebagai wall-clock lalu
-- dibaca Prisma sebagai UTC, sehingga tampil 22:00 WIB. 15:00 WIB = 08:00 UTC.
UPDATE `EventMeeting`
  SET scheduled_at = '2026-09-12 08:00:00'
  WHERE id = 'evtmt-baku-tau-4-0-welcome-night'
    AND scheduled_at = '2026-09-12 15:00:00';

-- Backfill BAKU TAU hanya jika belum diisi, supaya edit portal tidak tertimpa.
UPDATE `EventProgram`
  SET
    event_date = '2026-09-12 08:00:00.000',
    venue_name = COALESCE(venue_name, 'GMIM Eben Haezer Cikarang'),
    location_detail = COALESCE(location_detail, 'GMIM Eben Haezer Cikarang · 15.00 WIB'),
    map_url = COALESCE(map_url, 'https://share.google/Ro2jBSuGfrzfg49nP'),
    map_embed_query = COALESCE(map_embed_query, 'GMIM Eben Haezer Cikarang, Cikarang, Bekasi')
  WHERE id = 'evt-baku-tau-4-0' AND event_date IS NULL;

UPDATE `content_items`
  SET
    event_date = '2026-09-12',
    location_detail = COALESCE(location_detail, 'GMIM Eben Haezer Cikarang · 15.00 WIB')
  WHERE id = 'cnt-bakutau';
