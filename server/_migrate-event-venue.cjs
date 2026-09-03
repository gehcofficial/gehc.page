/**
 * Idempotent: venue & waktu acara di EventProgram + backfill BAKU TAU
 * + koreksi zona waktu EventMeeting.
 *
 * Kenapa event_date terpisah dari start_date: start_date dipakai sebagai rentang
 * program (BAKU TAU 2026-01-01..12-31), bukan hari pelaksanaan.
 *
 * Kenapa instant UTC: kolom DATETIME tidak menyimpan offset dan Prisma membacanya
 * sebagai UTC. Menyisipkan '2026-09-12 15:00:00' berarti 15:00 UTC = 22:00 WIB.
 * Semua penulisan di sini memakai Date dari ISO string beroffset.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

// Sumber kebenaran lama — tetap dipakai sebagai nilai backfill.
const BAKU_TAU_EVENT_ID = 'evt-baku-tau-4-0';
const BAKU_TAU_EVENT_DATE_ISO = '2026-09-12T15:00:00+07:00';
const BAKU_TAU_VENUE_NAME = 'GMIM Eben Haezer Cikarang';
const BAKU_TAU_LOCATION_DETAIL = 'Cikarang, Bekasi';
const BAKU_TAU_MAP_URL = 'https://share.google/Ro2jBSuGfrzfg49nP';
const BAKU_TAU_MAP_EMBED_QUERY = 'GMIM Eben Haezer Cikarang, Cikarang, Bekasi';
const WELCOME_NIGHT_MEETING_ID = 'evtmt-baku-tau-4-0-welcome-night';

async function hasColumn(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
  );
  return rows.length > 0;
}

async function addColumn(conn, table, col, ddl) {
  if (await hasColumn(conn, table, col)) {
    console.log(`${table}.${col} exists`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`${table}.${col} added`);
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
    timezone: 'Z',
  });

  try {
    await addColumn(conn, 'EventProgram', 'event_date', 'event_date DATETIME(3) NULL');
    await addColumn(conn, 'EventProgram', 'venue_name', 'venue_name VARCHAR(190) NULL');
    await addColumn(conn, 'EventProgram', 'location_detail', 'location_detail VARCHAR(190) NULL');
    await addColumn(conn, 'EventProgram', 'map_url', 'map_url VARCHAR(512) NULL');
    await addColumn(conn, 'EventProgram', 'map_embed_query', 'map_embed_query VARCHAR(190) NULL');

    // Backfill BAKU TAU hanya jika belum diisi, supaya edit manual tidak tertimpa.
    const [rows] = await conn.query(
      `SELECT id, event_date FROM EventProgram WHERE id = ? LIMIT 1`,
      [BAKU_TAU_EVENT_ID],
    );
    if (!rows.length) {
      console.log(`${BAKU_TAU_EVENT_ID} tidak ada — skip backfill`);
    } else if (rows[0].event_date) {
      console.log(`${BAKU_TAU_EVENT_ID}.event_date sudah terisi — skip backfill`);
    } else {
      await conn.query(
        `UPDATE EventProgram
           SET event_date = ?, venue_name = ?, location_detail = ?, map_url = ?, map_embed_query = ?
         WHERE id = ?`,
        [
          new Date(BAKU_TAU_EVENT_DATE_ISO),
          BAKU_TAU_VENUE_NAME,
          BAKU_TAU_LOCATION_DETAIL,
          BAKU_TAU_MAP_URL,
          BAKU_TAU_MAP_EMBED_QUERY,
          BAKU_TAU_EVENT_ID,
        ],
      );
      console.log(`${BAKU_TAU_EVENT_ID} venue backfilled (${new Date(BAKU_TAU_EVENT_DATE_ISO).toISOString()})`);
    }

    // Rapikan subtitle lama yang mengulang nama tempat + jam (jam sudah di event_date).
    const [locFix] = await conn.query(
      `UPDATE EventProgram
         SET location_detail = ?
       WHERE id = ? AND location_detail = ?`,
      [BAKU_TAU_LOCATION_DETAIL, BAKU_TAU_EVENT_ID, 'GMIM Eben Haezer Cikarang · 15.00 WIB'],
    );
    if (locFix.affectedRows) {
      console.log(`${BAKU_TAU_EVENT_ID}.location_detail dinormalisasi → ${BAKU_TAU_LOCATION_DETAIL}`);
    }
    const [ciLoc] = await conn.query(
      `UPDATE content_items
         SET location_detail = ?
       WHERE id = 'cnt-bakutau' AND location_detail = ?`,
      [BAKU_TAU_LOCATION_DETAIL, 'GMIM Eben Haezer Cikarang · 15.00 WIB'],
    );
    if (ciLoc.affectedRows) {
      console.log(`content_items cnt-bakutau.location_detail dinormalisasi → ${BAKU_TAU_LOCATION_DETAIL}`);
    }

    // Koreksi 22:00 WIB → 15:00 WIB pada Welcome Night.
    const [mt] = await conn.query(
      `SELECT id, scheduled_at FROM EventMeeting WHERE id = ? LIMIT 1`,
      [WELCOME_NIGHT_MEETING_ID],
    );
    if (!mt.length) {
      console.log('welcome-night tidak ada — skip koreksi jam');
    } else {
      const current = new Date(mt[0].scheduled_at).toISOString();
      const want = new Date(BAKU_TAU_EVENT_DATE_ISO).toISOString();
      if (current === want) {
        console.log('welcome-night sudah benar (15:00 WIB)');
      } else {
        await conn.query(`UPDATE EventMeeting SET scheduled_at = ? WHERE id = ?`, [
          new Date(BAKU_TAU_EVENT_DATE_ISO),
          WELCOME_NIGHT_MEETING_ID,
        ]);
        console.log(`welcome-night dikoreksi: ${current} → ${want}`);
      }
    }

    // content_items cnt-bakutau mengikuti EventProgram (sumber kebenaran baru).
    const [ep] = await conn.query(
      `SELECT event_date, location_detail FROM EventProgram WHERE id = ? LIMIT 1`,
      [BAKU_TAU_EVENT_ID],
    );
    if (ep.length && ep[0].event_date) {
      const instant = new Date(ep[0].event_date);
      const wibDay = new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const loc = ep[0].location_detail || BAKU_TAU_LOCATION_DETAIL;
      const [ci] = await conn.query(`SELECT id FROM content_items WHERE id = 'cnt-bakutau' LIMIT 1`);
      if (ci.length) {
        await conn.query(
          `UPDATE content_items SET event_date = ?, location_detail = ? WHERE id = 'cnt-bakutau'`,
          [wibDay, loc],
        );
        console.log(`content_items cnt-bakutau diselaraskan (${wibDay})`);
      } else {
        console.log('content_items cnt-bakutau tidak ada — skip');
      }
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
