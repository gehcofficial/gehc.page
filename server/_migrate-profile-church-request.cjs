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
    CREATE TABLE IF NOT EXISTS profile_church_data_requests (
      id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      change_name BOOLEAN NOT NULL DEFAULT false,
      change_bipra BOOLEAN NOT NULL DEFAULT false,
      change_kolom BOOLEAN NOT NULL DEFAULT false,
      requested_name VARCHAR(150) NULL,
      requested_bipra VARCHAR(16) NULL,
      requested_kolom_id VARCHAR(64) NULL,
      reason TEXT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      admin_note TEXT NULL,
      reviewed_by_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      reviewed_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      INDEX profile_church_data_requests_user_id_idx (user_id),
      INDEX profile_church_data_requests_status_idx (status)
    )
  `);
  console.log('profile_church_data_requests ready');
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
