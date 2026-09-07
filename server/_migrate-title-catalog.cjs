require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const seed = require('./lib/title-catalog-seed.json');

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
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

  await conn.query(`
    CREATE TABLE IF NOT EXISTS title_catalog (
      id VARCHAR(64) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      code VARCHAR(32) NOT NULL,
      abbr VARCHAR(32) NOT NULL,
      name_id VARCHAR(120) NOT NULL,
      name_en VARCHAR(120) NOT NULL,
      position VARCHAR(8) NOT NULL,
      locked TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY title_catalog_code_key (code),
      KEY title_catalog_kind_active_idx (kind, active)
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS title_suggestions (
      id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      abbr VARCHAR(32) NOT NULL,
      name_hint VARCHAR(120) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      title_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY title_suggestions_user_id_idx (user_id),
      KEY title_suggestions_status_idx (status)
    )
  `);
  try {
    await conn.query('ALTER TABLE users MODIFY COLUMN church_title VARCHAR(32) NULL');
    console.log('church_title VARCHAR(32)');
  } catch (e) {
    console.log('church_title alter skipped:', e.message);
  }

  const rows = [...(seed.church || []), ...(seed.academic || [])];
  const [existing] = await conn.query('SELECT code FROM title_catalog');
  const have = new Set((existing || []).map((r) => r.code));
  const missing = rows.filter((r) => !have.has(r.code));
  if (missing.length) {
    const vals = missing.map((r, i) => [
      id('ttl'), r.kind, r.code, r.abbr, r.nameId, r.nameEn, r.position, r.locked ? 1 : 0, have.size + i + 1,
    ]);
    await conn.query(
      `INSERT INTO title_catalog (id, kind, code, abbr, name_id, name_en, position, locked, active, sort_order) VALUES ${
        vals.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, 1, ?)').join(', ')
      }`,
      vals.flat(),
    );
  }
  console.log('title_catalog seed added', missing.length);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
