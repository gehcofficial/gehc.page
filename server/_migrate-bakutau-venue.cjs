require('dotenv').config();
const mysql = require('mysql2/promise');

async function ensureColumn(conn, table, column, ddl) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!cols.length) {
    await conn.query(ddl);
    console.log(`${table}.${column} added`);
  }
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('DATABASE_URL tidak ada');
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
    await ensureColumn(conn, 'content_items', 'event_date', 'ALTER TABLE content_items ADD COLUMN event_date DATE NULL');
    await ensureColumn(
      conn,
      'content_items',
      'is_featured_event',
      'ALTER TABLE content_items ADD COLUMN is_featured_event BOOLEAN NOT NULL DEFAULT false',
    );
    await ensureColumn(
      conn,
      'content_items',
      'location_detail',
      'ALTER TABLE content_items ADD COLUMN location_detail VARCHAR(190) NULL',
    );

    const [existing] = await conn.query(`SELECT id FROM content_items WHERE id = 'cnt-bakutau' LIMIT 1`);
    if (existing.length) {
      const [content] = await conn.query(
        `UPDATE content_items SET
          event_date = '2026-09-12',
          location_detail = 'Cikarang, Bekasi',
          subtitle = 'Malam penyambutan mahasiswa baru di perantuaan — bertemu & terhubung di GMIM Eben Haezer',
          is_featured_event = true
        WHERE id = 'cnt-bakutau'`,
      );
      console.log(`content_items cnt-bakutau updated: ${content.affectedRows ?? 0} baris`);
    } else {
      await conn.query(
        `INSERT INTO content_items
          (id, tenant_id, type, title, subtitle, category, published_at, event_date, location_detail,
           is_featured_event, is_published, author, banner_url, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'cnt-bakutau',
          'tenant-youth',
          'ACTIVITY',
          'BAKU TAU 4.0 — Bakudapa di Rantau',
          'Malam penyambutan mahasiswa baru di perantuaan — bertemu & terhubung di GMIM Eben Haezer',
          'Welcome Night',
          '2026-08-20',
          '2026-09-12',
          'Cikarang, Bekasi',
          true,
          true,
          'Komisi Pemuda GEHC',
          'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1200&auto=format&fit=crop',
          JSON.stringify(['BAKU TAU', 'Welcome', 'Community']),
        ],
      );
      console.log('content_items cnt-bakutau inserted');
    }

    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EventProgram'`,
    );
    if (tables.length) {
      const [ev] = await conn.query(`SELECT id FROM EventProgram WHERE id = 'evt-baku-tau-4-0' LIMIT 1`);
      if (!ev.length) {
        await conn.query(
          `INSERT INTO EventProgram
            (id, tenant_id, slug, name, description, status, start_date, end_date, created_by_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            'evt-baku-tau-4-0',
            'tenant-youth',
            'baku-tau-4-0',
            'BAKU TAU 4.0',
            'Program Kerja & Event Tahunan GEHC 2026',
            'ACTIVE',
            '2026-01-01',
            '2026-12-31',
            'usr-tech',
          ],
        );
        console.log('EventProgram evt-baku-tau-4-0 inserted');
      }
    }

    const [meetingTables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EventMeeting'`,
    );
    if (meetingTables.length) {
      const [mt] = await conn.query(
        `SELECT id FROM EventMeeting WHERE id = 'evtmt-baku-tau-4-0-welcome-night' LIMIT 1`,
      );
      if (mt.length) {
        const [meeting] = await conn.query(
          `UPDATE EventMeeting SET
            notes = 'Malam penyambutan mahasiswa baru — GMIM Eben Haezer Cikarang, 15.00 WIB'
          WHERE id = 'evtmt-baku-tau-4-0-welcome-night'`,
        );
        console.log(`EventMeeting welcome-night notes updated: ${meeting.affectedRows ?? 0} baris`);
      } else {
        await conn.query(
          `INSERT INTO EventMeeting
            (id, event_id, title, scheduled_at, notes, created_by_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            'evtmt-baku-tau-4-0-welcome-night',
            'evt-baku-tau-4-0',
            'BAKU TAU 4.0 — Bakudapa di Rantau',
            new Date('2026-09-12T15:00:00+07:00'),
            'Malam penyambutan mahasiswa baru — GMIM Eben Haezer Cikarang, 15.00 WIB',
            'usr-tech',
          ],
        );
        console.log('EventMeeting welcome-night inserted');
      }
    }

    console.log('✓ BAKU TAU venue patch selesai');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
