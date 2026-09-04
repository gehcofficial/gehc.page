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
  if (await columnExists(conn, table, column)) {
    console.log(`skip column ${table}.${column}`);
    return;
  }
  await conn.query(ddl);
  console.log(`added ${table}.${column}`);
}

(async () => {
  const conn = await connectFromUrl(process.env.DATABASE_URL);

  if (await columnExists(conn, 'users', 'account_kind')) {
    console.log('skip column users.account_kind');
  } else {
    await conn.query(
      `ALTER TABLE users ADD COLUMN account_kind VARCHAR(20) NOT NULL DEFAULT 'MEMBER'`,
    );
    console.log('added users.account_kind');
  }

  if (!(await tableExists(conn, 'platform_operators'))) {
    await conn.query(`
      CREATE TABLE platform_operators (
        id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
        email VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        display_name VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        password_hash TEXT NULL,
        webauthn_credentials JSON NULL,
        current_challenge JSON NULL,
        challenge_expires_at DATETIME(3) NULL,
        is_root BOOLEAN NOT NULL DEFAULT true,
        is_protected BOOLEAN NOT NULL DEFAULT true,
        status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
        last_login_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY platform_operators_email (email),
        KEY platform_operators_status_idx (status)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('created platform_operators');
  } else {
    console.log('keep platform_operators (data preserved)');
    await addColumnIfMissing(
      conn,
      'platform_operators',
      'password_hash',
      'ALTER TABLE platform_operators ADD COLUMN password_hash TEXT NULL',
    );
    await addColumnIfMissing(
      conn,
      'platform_operators',
      'webauthn_credentials',
      'ALTER TABLE platform_operators ADD COLUMN webauthn_credentials JSON NULL',
    );
    await addColumnIfMissing(
      conn,
      'platform_operators',
      'is_root',
      'ALTER TABLE platform_operators ADD COLUMN is_root BOOLEAN NOT NULL DEFAULT true',
    );
    await addColumnIfMissing(
      conn,
      'platform_operators',
      'is_protected',
      'ALTER TABLE platform_operators ADD COLUMN is_protected BOOLEAN NOT NULL DEFAULT true',
    );
  }

  if (!(await tableExists(conn, 'platform_admin_grants'))) {
    await conn.query(`
      CREATE TABLE platform_admin_grants (
        id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        granted_by_operator_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        granted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        revoked_at DATETIME(3) NULL,
        note TEXT NULL,
        KEY platform_admin_grants_user_id_idx (user_id),
        KEY platform_admin_grants_operator_idx (granted_by_operator_id),
        KEY platform_admin_grants_revoked_idx (revoked_at),
        CONSTRAINT platform_admin_grants_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT platform_admin_grants_operator_fk FOREIGN KEY (granted_by_operator_id) REFERENCES platform_operators(id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('created platform_admin_grants');
  } else {
    console.log('keep platform_admin_grants (data preserved)');
  }

  if (!(await tableExists(conn, 'platform_audit_logs'))) {
    await conn.query(`
      CREATE TABLE platform_audit_logs (
        id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
        actor_type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        actor_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        action VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        target_type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        target_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        meta JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY platform_audit_actor_idx (actor_type, actor_id),
        KEY platform_audit_created_idx (created_at)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('created platform_audit_logs');
  } else {
    console.log('keep platform_audit_logs (data preserved)');
  }

  console.log('platform_operators tables ready (idempotent, no drop)');
  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
