/**
 * Idempotent: kondisi khusus minggu layanan (GABUNGAN/LIBUR/ALIH).
 * NORMAL (default, tanpa baris) = Mentoring W1 / Serving bergilir W2+.
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

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
