require('dotenv').config();
const mysql = require('mysql2/promise');

/** Tabel regen_scope_snapshots untuk Undo aksi regenerasi. Idempotent. */
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
    CREATE TABLE IF NOT EXISTS regen_scope_snapshots (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      action VARCHAR(32) NOT NULL,
      summary VARCHAR(400) NOT NULL,
      group_id VARCHAR(64) NULL,
      period VARCHAR(10) NULL,
      data JSON NOT NULL,
      created_by_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      undone_at DATETIME(3) NULL,
      KEY regen_scope_snapshots_created_idx (created_at)
    )
  `);
  console.log('regen_scope_snapshots ready');

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
