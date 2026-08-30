require('dotenv').config();
const mysql = require('mysql2/promise');
const CATALOG = require('./recreational-catalog.cjs');

function esc(v) {
  return String(v).replace(/'/g, "''");
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

  async function ensureColumn(name, ddl) {
    const [cols] = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recreational_groups' AND column_name = ?`,
      [name]
    );
    if (!cols.length) await conn.query(ddl);
  }

  await ensureColumn('parent_id', 'ALTER TABLE recreational_groups ADD COLUMN parent_id VARCHAR(64) NULL');
  await ensureColumn('selectable', 'ALTER TABLE recreational_groups ADD COLUMN selectable TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('sort_order', 'ALTER TABLE recreational_groups ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
  try {
    await conn.query('CREATE INDEX recreational_groups_parent_id_idx ON recreational_groups(parent_id)');
  } catch { /* exists */ }
  try {
    await conn.query('CREATE INDEX recreational_groups_kind_idx ON recreational_groups(kind)');
  } catch { /* exists */ }

  console.log('schema recreational_groups OK');

  const parents = CATALOG.filter((r) => !r.parentId);
  const leaves = CATALOG.filter((r) => r.parentId);
  for (const row of [...parents, ...leaves]) {
    await conn.query(
      `INSERT INTO recreational_groups (id, slug, name, kind, parent_id, selectable, sort_order) VALUES (
        '${esc(row.id)}', '${esc(row.slug)}', '${esc(row.name)}', '${esc(row.kind)}',
        ${row.parentId ? `'${esc(row.parentId)}'` : 'NULL'},
        ${row.selectable ? 1 : 0}, ${row.sortOrder}
      ) ON DUPLICATE KEY UPDATE name = VALUES(name), kind = VALUES(kind), parent_id = VALUES(parent_id),
        selectable = VALUES(selectable), sort_order = VALUES(sort_order)`
    );
  }

  const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM recreational_groups');
  const [[{ l }]] = await conn.query('SELECT COUNT(*) AS l FROM recreational_groups WHERE selectable = 1');
  console.log(`recreational catalog: ${c} rows (${l} selectable)`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
