/**
 * Idempotent: kolom multi-role di struktur_members yang ada di Prisma
 * tapi tidak pernah masuk prisma/migrations (penyebab GET /api/db/struktur gagal di prod).
 */
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

  async function hasColumn(table, name) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }

  async function hasIndex(table, name) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }

  if (!(await hasColumn('struktur_members', 'id'))) {
    console.log('struktur_members missing — skip');
    await conn.end();
    return;
  }

  if (!(await hasColumn('struktur_members', 'role'))) {
    await conn.query(
      `ALTER TABLE struktur_members ADD COLUMN role ENUM('SUPERADMIN','BPMJ','KOMISI','COMMITTEE','MENTOR','CO_MENTOR','MENTEE','ALUMNI') NOT NULL DEFAULT 'MENTEE'`,
    );
    console.log('struktur_members.role added');
  } else {
    console.log('struktur_members.role already exists');
  }

  if (!(await hasColumn('struktur_members', 'role_order'))) {
    await conn.query('ALTER TABLE struktur_members ADD COLUMN role_order INT NOT NULL DEFAULT 0');
    console.log('struktur_members.role_order added');
  } else {
    console.log('struktur_members.role_order already exists');
  }

  if (!(await hasColumn('struktur_members', 'is_double_role'))) {
    await conn.query('ALTER TABLE struktur_members ADD COLUMN is_double_role BOOLEAN NOT NULL DEFAULT false');
    console.log('struktur_members.is_double_role added');
  } else {
    console.log('struktur_members.is_double_role already exists');
  }

  if (!(await hasColumn('struktur_members', 'sub_role_id'))) {
    await conn.query('ALTER TABLE struktur_members ADD COLUMN sub_role_id VARCHAR(64) NULL');
    console.log('struktur_members.sub_role_id added');
  } else {
    console.log('struktur_members.sub_role_id already exists');
  }

  if (!(await hasColumn('struktur_members', 'group_id'))) {
    await conn.query('ALTER TABLE struktur_members ADD COLUMN group_id VARCHAR(64) NULL');
    console.log('struktur_members.group_id added');
  } else {
    console.log('struktur_members.group_id already exists');
  }

  if (!(await hasIndex('struktur_members', 'struktur_members_group_id_idx'))) {
    await conn.query('CREATE INDEX struktur_members_group_id_idx ON struktur_members(group_id)');
    console.log('struktur_members_group_id_idx added');
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
