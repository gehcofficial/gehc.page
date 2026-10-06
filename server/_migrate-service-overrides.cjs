/**
 * Idempotent: kondisi khusus minggu layanan (GABUNGAN/LIBUR/ALIH/GESER).
 * NORMAL (default, tanpa baris) = Mentoring W1 / Serving bergilir W2+.
 * GESER memakai kolom new_event_date (tanggal efektif ibadah).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS service_week_overrides (
      event_date DATE NOT NULL,
      \`condition\` VARCHAR(16) NOT NULL DEFAULT 'GABUNGAN',
      note VARCHAR(500) NULL,
      partner_label VARCHAR(190) NULL,
      linked_event_id VARCHAR(64) NULL,
      created_by_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (event_date),
      INDEX service_override_condition (\`condition\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('service_week_overrides OK');

  // GESER: tanggal efektif ibadah (mis. 2026-10-18 → 2026-10-17).
  await conn.query(`
    ALTER TABLE service_week_overrides
    ADD COLUMN IF NOT EXISTS new_event_date DATE NULL AFTER linked_event_id
  `).catch(async () => {
    // TiDB/MySQL lama tanpa IF NOT EXISTS — cek kolom dulu.
    const [cols] = await conn.query('SHOW COLUMNS FROM service_week_overrides LIKE ?', ['new_event_date']);
    if (!cols.length) {
      await conn.query('ALTER TABLE service_week_overrides ADD COLUMN new_event_date DATE NULL AFTER linked_event_id');
    }
  });
  console.log('service_week_overrides.new_event_date OK');

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
