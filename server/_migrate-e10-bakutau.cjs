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
  } else {
    console.log(`${table}.${column} exists`);
  }
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

  await ensureColumn(
    conn,
    'users',
    'domicile_kind',
    `ALTER TABLE users ADD COLUMN domicile_kind VARCHAR(20) NULL`,
  );
  await ensureColumn(
    conn,
    'users',
    'domicile_detail',
    `ALTER TABLE users ADD COLUMN domicile_detail VARCHAR(190) NULL`,
  );

  await ensureColumn(
    conn,
    'waiting_pool',
    'domicile_kind',
    `ALTER TABLE waiting_pool ADD COLUMN domicile_kind VARCHAR(20) NULL`,
  );
  await ensureColumn(
    conn,
    'waiting_pool',
    'domicile_detail',
    `ALTER TABLE waiting_pool ADD COLUMN domicile_detail VARCHAR(190) NULL`,
  );
  await ensureColumn(
    conn,
    'waiting_pool',
    'claim_token',
    `ALTER TABLE waiting_pool ADD COLUMN claim_token VARCHAR(64) NULL`,
  );

  const [idx] = await conn.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'waiting_pool' AND INDEX_NAME = 'waiting_pool_claim_token_key'`,
  );
  if (!idx.length) {
    try {
      await conn.query(`ALTER TABLE waiting_pool ADD UNIQUE KEY waiting_pool_claim_token_key (claim_token)`);
      console.log('waiting_pool.claim_token unique index added');
    } catch (e) {
      console.log('waiting_pool claim_token index skip:', e.message);
    }
  }

  await ensureColumn(
    conn,
    'EventProgram',
    'whatsapp_group_url',
    `ALTER TABLE EventProgram ADD COLUMN whatsapp_group_url VARCHAR(512) NULL`,
  );

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
