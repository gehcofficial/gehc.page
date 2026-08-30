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

  const cols = [
    ['address_scope', "VARCHAR(8) NOT NULL DEFAULT 'ID'"],
    ['address_country', "VARCHAR(2) NOT NULL DEFAULT 'ID'"],
    ['province_code', 'VARCHAR(8) NULL'],
    ['city_code', 'VARCHAR(12) NULL'],
    ['district_code', 'VARCHAR(16) NULL'],
    ['village_code', 'VARCHAR(20) NULL'],
  ];
  for (const [name, ddl] of cols) {
    const [found] = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`,
      [name]
    );
    if (!found.length) {
      await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
      console.log('added', name);
    } else {
      console.log('exists', name);
    }
  }
  for (const idx of ['users_address_scope_idx', 'users_address_country_idx']) {
    try {
      const col = idx.includes('scope') ? 'address_scope' : 'address_country';
      await conn.query(`CREATE INDEX ${idx} ON users(${col})`);
      console.log('index', idx);
    } catch {
      console.log('index exists', idx);
    }
  }
  await conn.query(`
    UPDATE users SET address_scope = 'ID', address_country = 'ID'
    WHERE (address_scope IS NULL OR address_scope = '')
       OR (province IS NOT NULL OR city IS NOT NULL OR address_line IS NOT NULL OR address IS NOT NULL)
  `);
  const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM users WHERE address_country = 'ID'`);
  console.log('users with address_country=ID', c);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
