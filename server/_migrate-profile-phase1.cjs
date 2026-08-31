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

  const userCols = [
    ['work_industry', "VARCHAR(80) NULL"],
    ['work_role', "VARCHAR(120) NULL"],
    ['major_other', "VARCHAR(150) NULL"],
  ];
  for (const [name, ddl] of userCols) {
    const [found] = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`,
      [name],
    );
    if (!found.length) {
      await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
      console.log('added', name);
    } else {
      console.log('exists', name);
    }
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS recreational_suggestions (
      id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(80) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      parent_id VARCHAR(64) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      group_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX recreational_suggestions_user_id_idx (user_id),
      INDEX recreational_suggestions_status_idx (status)
    )
  `);
  console.log('recreational_suggestions ready');
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
