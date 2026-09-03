/**
 * Idempotent: User avatar source fields + optional userId on struktur/testimonials.
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

  if (!(await hasColumn('users', 'avatar_google'))) {
    await conn.query('ALTER TABLE users ADD COLUMN avatar_google TEXT NULL');
    console.log('users.avatar_google added');
  } else {
    console.log('users.avatar_google already exists');
  }

  if (!(await hasColumn('users', 'avatar_source'))) {
    await conn.query("ALTER TABLE users ADD COLUMN avatar_source VARCHAR(16) NOT NULL DEFAULT 'GOOGLE'");
    console.log('users.avatar_source added');
  } else {
    console.log('users.avatar_source already exists');
  }

  if (!(await hasColumn('users', 'avatar_drive_file_id'))) {
    await conn.query('ALTER TABLE users ADD COLUMN avatar_drive_file_id VARCHAR(128) NULL');
    console.log('users.avatar_drive_file_id added');
  } else {
    console.log('users.avatar_drive_file_id already exists');
  }

  await conn.query(
    "UPDATE users SET avatar_google = avatar WHERE avatar IS NOT NULL AND (avatar_google IS NULL OR avatar_google = '')",
  );

  if (await hasColumn('struktur_members', 'id')) {
    if (!(await hasColumn('struktur_members', 'user_id'))) {
      await conn.query('ALTER TABLE struktur_members ADD COLUMN user_id VARCHAR(64) NULL');
      console.log('struktur_members.user_id added');
    } else {
      console.log('struktur_members.user_id already exists');
    }
    if (!(await hasIndex('struktur_members', 'struktur_members_user_id_idx'))) {
      await conn.query('CREATE INDEX struktur_members_user_id_idx ON struktur_members(user_id)');
      console.log('struktur_members_user_id_idx added');
    }
  }

  if (await hasColumn('testimonials', 'id')) {
    if (!(await hasColumn('testimonials', 'user_id'))) {
      await conn.query('ALTER TABLE testimonials ADD COLUMN user_id VARCHAR(64) NULL');
      console.log('testimonials.user_id added');
    } else {
      console.log('testimonials.user_id already exists');
    }
    if (!(await hasIndex('testimonials', 'testimonials_user_id_idx'))) {
      await conn.query('CREATE INDEX testimonials_user_id_idx ON testimonials(user_id)');
      console.log('testimonials_user_id_idx added');
    }
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
