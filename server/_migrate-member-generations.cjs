require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Regenerasi per-generasi:
 * - perluas enum group_members.status → ACTIVE/ALUMNI/PAST/MOVED
 * - kolom moved_to_group_id
 * - unique (group_id, user_id, batch_period) + dedupe aman
 * Idempotent.
 */
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

  async function hasColumn(table, column) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows.length > 0;
  }

  async function hasIndex(table, indexName) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
      [table, indexName],
    );
    return rows.length > 0;
  }

  const [statusCol] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_members' AND COLUMN_NAME = 'status'`,
  );
  const typeStr = String(statusCol[0]?.COLUMN_TYPE || '');
  if (!typeStr.includes('PAST') || !typeStr.includes('MOVED')) {
    await conn.query(
      `ALTER TABLE group_members MODIFY COLUMN status ENUM('ACTIVE','ALUMNI','PAST','MOVED') NOT NULL DEFAULT 'ACTIVE'`,
    );
    console.log('group_members.status enum widened');
  } else {
    console.log('group_members.status enum ok');
  }

  if (!(await hasColumn('group_members', 'moved_to_group_id'))) {
    await conn.query(`ALTER TABLE group_members ADD COLUMN moved_to_group_id VARCHAR(64) NULL`);
    console.log('group_members.moved_to_group_id added');
  }

  const uniq = 'group_members_group_user_period_key';
  if (!(await hasIndex('group_members', uniq))) {
    // Dedupe: sisakan id terbesar per (group_id, user_id, batch_period).
    const [dup] = await conn.query(
      `DELETE gm FROM group_members gm
       JOIN group_members k
         ON k.group_id = gm.group_id AND k.user_id = gm.user_id AND k.batch_period = gm.batch_period
        AND k.id > gm.id
       WHERE gm.user_id IS NOT NULL AND gm.batch_period IS NOT NULL`,
    );
    if (dup.affectedRows) console.log(`group_members dedupe: ${dup.affectedRows} baris dihapus`);
    try {
      await conn.query(
        `ALTER TABLE group_members ADD UNIQUE KEY ${uniq} (group_id, user_id, batch_period)`,
      );
      console.log('group_members unique (group,user,period) added');
    } catch (e) {
      console.warn('unique index gagal (lanjut tanpa):', e.message);
    }
  } else {
    console.log('group_members unique ok');
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
