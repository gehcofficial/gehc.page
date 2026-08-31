require('dotenv').config();
const mysql = require('mysql2/promise');

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

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

  const exists = await tableExists(conn, 'waiting_pool');
  if (exists) {
    console.log('waiting_pool already exists');
    await conn.end();
    return;
  }

  await conn.query(`
    CREATE TABLE waiting_pool (
      id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NULL,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(190) NULL,
      phone VARCHAR(40) NULL,
      gender VARCHAR(20) NULL,
      origin VARCHAR(190) NULL,
      domicile_kind VARCHAR(20) NULL,
      domicile_detail VARCHAR(190) NULL,
      claim_token VARCHAR(64) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'WAITING_POOL',
      gift_test_done BOOLEAN NOT NULL DEFAULT false,
      gifts_top5 JSON NULL,
      gifts_scores JSON NULL,
      talents JSON NULL,
      profile_completed BOOLEAN NOT NULL DEFAULT false,
      profile_completed_at DATETIME(3) NULL,
      source_event VARCHAR(100) NULL,
      registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_reminder DATETIME(3) NULL,
      reminder_count INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY waiting_pool_user_id_key (user_id),
      UNIQUE KEY waiting_pool_claim_token_key (claim_token),
      KEY waiting_pool_status_idx (status)
    )
  `);
  console.log('waiting_pool created');

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
