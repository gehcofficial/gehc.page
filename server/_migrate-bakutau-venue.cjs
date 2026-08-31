require('dotenv').config();
const mysql = require('mysql2/promise');

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
  });

  try {
    const [content] = await conn.query(
      `UPDATE content_items SET
        event_date = '2026-09-12',
        location_detail = 'GMIM Eben Haezer Cikarang · 15.00 WIB',
        subtitle = 'Malam penyambutan mahasiswa baru di perantuaan — bertemu & terhubung di GMIM Eben Haezer'
      WHERE id = 'cnt-bakutau'`,
    );
    console.log(`content_items cnt-bakutau: ${content.affectedRows ?? 0} baris`);

    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_meetings'`,
    );
    if (tables.length) {
      const [meeting] = await conn.query(
        `UPDATE event_meetings SET
          scheduled_at = '2026-09-12 15:00:00',
          notes = 'Malam penyambutan mahasiswa baru — GMIM Eben Haezer Cikarang, 15.00 WIB'
        WHERE id = 'evtmt-baku-tau-4-0-welcome-night'`,
      );
      console.log(`event_meetings welcome-night: ${meeting.affectedRows ?? 0} baris`);
    } else {
      console.log('event_meetings tidak ada — skip update meeting');
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
