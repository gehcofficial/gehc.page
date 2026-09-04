/**
 * Idempotent: generasi Retreat 0 = 2026-06 + kolom mentor/co + regen_ready.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const GEN0 = '2026-06';
const GEN0_LABEL = 'Generasi 0 — Retreat UNSHAKABLE';

async function hasColumn(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
  );
  return rows.length > 0;
}

async function addColumn(conn, table, col, ddl) {
  if (await hasColumn(conn, table, col)) {
    console.log(`${table}.${col} exists`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`${table}.${col} added`);
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

  await addColumn(conn, 'group_batches', 'generation', '`generation` INT NOT NULL DEFAULT 0');
  await addColumn(conn, 'group_batches', 'mentor_user_id', '`mentor_user_id` VARCHAR(64) NULL');
  await addColumn(conn, 'group_batches', 'comentor_user_id', '`comentor_user_id` VARCHAR(64) NULL');
  await addColumn(conn, 'group_batches', 'regen_ready', '`regen_ready` BOOLEAN NOT NULL DEFAULT false');

  const [founded] = await conn.query(
    `UPDATE \`groups\`
     SET founded_period = ?
     WHERE parent_group_id IS NULL
       AND (founded_period IS NULL OR founded_period IN ('', '2026', '2026-09'))`,
    [GEN0],
  );
  console.log('founded_period backfill', founded.affectedRows);

  await conn.query(
    `UPDATE group_batches gb
     INNER JOIN group_batches g6 ON g6.group_id = gb.group_id AND g6.period = ?
     INNER JOIN \`groups\` g ON g.id = gb.group_id AND g.parent_group_id IS NULL
     SET gb.is_current = 0
     WHERE gb.period <> ?`,
    [GEN0, GEN0],
  );

  await conn.query(
    `UPDATE group_batches gb
     INNER JOIN \`groups\` g ON g.id = gb.group_id AND g.parent_group_id IS NULL
     SET gb.is_current = 1,
         gb.generation = 0,
         gb.batch_label = COALESCE(NULLIF(gb.batch_label, ''), ?)
     WHERE gb.period = ?`,
    [GEN0_LABEL, GEN0],
  );

  await conn.query(
    `UPDATE group_batches gb
     INNER JOIN \`groups\` g ON g.id = gb.group_id AND g.parent_group_id IS NULL
     LEFT JOIN group_batches g6 ON g6.group_id = gb.group_id AND g6.period = ?
     SET gb.period = ?,
         gb.generation = 0,
         gb.batch_label = COALESCE(NULLIF(gb.batch_label, ''), ?)
     WHERE gb.is_current = 1
       AND gb.period <> ?
       AND g6.id IS NULL`,
    [GEN0, GEN0, GEN0_LABEL, GEN0],
  );

  console.log('beyonders generation backfill done');
  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
