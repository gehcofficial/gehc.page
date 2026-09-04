require('dotenv').config();
const mysql = require('mysql2/promise');

function connectFromUrl(raw) {
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
}

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, table, column, ddl) {
  if (!(await tableExists(conn, table))) {
    console.log(`skip ${table}.${column} (table missing)`);
    return;
  }
  if (await columnExists(conn, table, column)) {
    console.log(`skip column ${table}.${column}`);
    return;
  }
  await conn.query(ddl);
  console.log(`added ${table}.${column}`);
}

(async () => {
  const conn = await connectFromUrl(process.env.DATABASE_URL);

  if (!(await tableExists(conn, 'role_assignments'))) {
    await conn.query(`
      CREATE TABLE role_assignments (
        id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        role VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        position VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        division VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        subdivision VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        group_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        family_role VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        assigned_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        note TEXT NULL,
        KEY role_assignments_user_id_idx (user_id),
        KEY role_assignments_role_idx (role),
        KEY role_assignments_group_id_idx (group_id),
        KEY role_assignments_assigned_by_idx (assigned_by)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('created role_assignments');
  } else {
    console.log('keep role_assignments (data preserved)');
  }

  await addColumnIfMissing(
    conn,
    'user_roles',
    'assignment_id',
    'ALTER TABLE user_roles ADD COLUMN assignment_id VARCHAR(64) NULL',
  );
  await addColumnIfMissing(
    conn,
    'group_members',
    'assignment_id',
    'ALTER TABLE group_members ADD COLUMN assignment_id VARCHAR(64) NULL',
  );

  console.log('role_assignments schema ready (idempotent, no drop)');
  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
