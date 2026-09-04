require('dotenv').config();
const mysql = require('mysql2/promise');
const CATALOG = require('./institution-catalog.cjs');

function esc(v) {
  return String(v).replace(/'/g, "''");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS institutions (
      id VARCHAR(64) NOT NULL,
      slug VARCHAR(80) NOT NULL,
      name VARCHAR(190) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      city VARCHAR(120) NULL,
      country VARCHAR(80) NULL DEFAULT 'Indonesia',
      UNIQUE INDEX institutions_slug_key (slug),
      INDEX institutions_kind_idx (kind),
      PRIMARY KEY (id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  const [countryCol] = await conn.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'institutions' AND column_name = 'country'`,
  );
  if (!countryCol.length) {
    await conn.query(`ALTER TABLE institutions ADD COLUMN country VARCHAR(80) NULL DEFAULT 'Indonesia'`);
  }

  const cols = [
    ['address_line', 'VARCHAR(255) NULL'],
    ['village', 'VARCHAR(120) NULL'],
    ['district', 'VARCHAR(120) NULL'],
    ['city', 'VARCHAR(120) NULL'],
    ['province', 'VARCHAR(80) NULL'],
    ['postal_code', 'VARCHAR(12) NULL'],
    ['lat', 'DOUBLE NULL'],
    ['lng', 'DOUBLE NULL'],
    ['place_id', 'VARCHAR(255) NULL'],
    ['address_note', 'VARCHAR(255) NULL'],
    ['life_statuses', 'JSON NULL'],
    ['school_level', 'VARCHAR(24) NULL'],
    ['school_name', 'VARCHAR(190) NULL'],
    ['institution_id', 'VARCHAR(64) NULL'],
    ['major', 'VARCHAR(150) NULL'],
    ['workplace_name', 'VARCHAR(190) NULL'],
    ['workplace_place_id', 'VARCHAR(255) NULL'],
  ];
  for (const [name, ddl] of cols) {
    const [found] = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`,
      [name],
    );
    if (!found.length) await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
  }

  try {
    await conn.query('CREATE INDEX users_institution_id_idx ON users(institution_id)');
  } catch { /* exists */ }
  try {
    await conn.query('ALTER TABLE users ADD CONSTRAINT users_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL ON UPDATE CASCADE');
  } catch { /* exists */ }

  const batches = chunk(CATALOG, 40);
  for (const batch of batches) {
    const values = batch.map((row) =>
      `('${esc(row.id)}','${esc(row.slug)}','${esc(row.name)}','${esc(row.kind)}',${row.city ? `'${esc(row.city)}'` : 'NULL'},'${esc(row.country || 'Indonesia')}')`,
    ).join(',');
    await conn.query(
      `INSERT INTO institutions (id, slug, name, kind, city, country) VALUES ${values}
       ON DUPLICATE KEY UPDATE name = VALUES(name), kind = VALUES(kind), city = VALUES(city), country = VALUES(country)`,
    );
  }

  const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM institutions');
  console.log(`institutions ${c} (catalog ${CATALOG.length})`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
