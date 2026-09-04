/**
 * Idempotent: kolom users yang ada di Prisma tapi sering absen di prod
 * (onboarding_status, is_beyonders, …) — tanpa itu prisma.user.findFirst gagal.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const COLUMNS = [
  ['account_status', "VARCHAR(191) NOT NULL DEFAULT 'ACTIVE'"],
  ['address', 'TEXT NULL'],
  ['origin', 'VARCHAR(190) NULL'],
  ['gifts_top5', 'JSON NULL'],
  ['gifts_scores', 'JSON NULL'],
  ['talents', 'JSON NULL'],
  ['onboarding_status', "VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'"],
  ['is_beyonders', 'BOOLEAN NOT NULL DEFAULT false'],
  ['gender', 'VARCHAR(20) NULL'],
  ['password_hash', 'TEXT NULL'],
  ['auth_provider', "VARCHAR(16) NOT NULL DEFAULT 'GOOGLE'"],
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
  ['address_scope', "VARCHAR(8) NOT NULL DEFAULT 'ID'"],
  ['address_country', "VARCHAR(2) NOT NULL DEFAULT 'ID'"],
  ['province_code', 'VARCHAR(8) NULL'],
  ['city_code', 'VARCHAR(12) NULL'],
  ['district_code', 'VARCHAR(16) NULL'],
  ['village_code', 'VARCHAR(20) NULL'],
  ['life_statuses', 'JSON NULL'],
  ['school_level', 'VARCHAR(24) NULL'],
  ['school_name', 'VARCHAR(190) NULL'],
  ['institution_id', 'VARCHAR(64) NULL'],
  ['major', 'VARCHAR(150) NULL'],
  ['workplace_name', 'VARCHAR(190) NULL'],
  ['workplace_place_id', 'VARCHAR(255) NULL'],
  ['emergency_contact_name', 'VARCHAR(150) NULL'],
  ['emergency_contact_relation', 'VARCHAR(50) NULL'],
  ['emergency_contact_phone', 'VARCHAR(40) NULL'],
  ['emergency_contact_address', 'TEXT NULL'],
  ['last_profile_update', 'DATETIME(3) NULL'],
  ['profile_reminder_days', 'INT NOT NULL DEFAULT 60'],
  ['login_username', 'VARCHAR(40) NULL'],
  ['onboarding_path', "VARCHAR(16) NOT NULL DEFAULT 'ORGANIC'"],
  ['username_changed_at', 'DATETIME(3) NULL'],
  ['must_change_password', 'BOOLEAN NOT NULL DEFAULT FALSE'],
  ['account_kind', "VARCHAR(20) NOT NULL DEFAULT 'MEMBER'"],
  ['link_status', "VARCHAR(16) NOT NULL DEFAULT 'UNLINKED'"],
  ['google_sub', 'VARCHAR(64) NULL'],
  ['claim_token', 'VARCHAR(64) NULL'],
  ['claim_token_expires_at', 'DATETIME(3) NULL'],
  ['reset_token', 'VARCHAR(64) NULL'],
  ['reset_token_expires_at', 'DATETIME(3) NULL'],
  ['birth_date', 'DATE NULL'],
  ['domicile_kind', 'VARCHAR(20) NULL'],
  ['domicile_detail', 'VARCHAR(190) NULL'],
  ['major_other', 'VARCHAR(150) NULL'],
  ['work_industry', 'VARCHAR(80) NULL'],
  ['work_role', 'VARCHAR(120) NULL'],
  ['avatar_google', 'TEXT NULL'],
  ['avatar_source', "VARCHAR(16) NOT NULL DEFAULT 'GOOGLE'"],
  ['avatar_drive_file_id', 'VARCHAR(128) NULL'],
  ['kolom_id', 'VARCHAR(64) NULL'],
];

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

  async function hasColumn(name) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
      [name],
    );
    return rows.length > 0;
  }

  async function hasIndex(name) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = ?`,
      [name],
    );
    return rows.length > 0;
  }

  let added = 0;
  for (const [name, ddl] of COLUMNS) {
    if (await hasColumn(name)) {
      console.log(`exists ${name}`);
      continue;
    }
    await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
    console.log(`added ${name}`);
    added += 1;
  }

  if (await hasColumn('bipra')) {
    console.log('exists bipra');
  } else {
    await conn.query(
      "ALTER TABLE users ADD COLUMN bipra ENUM('BAPAK','IBU','PEMUDA','REMAJA','ANAK') NOT NULL DEFAULT 'PEMUDA'",
    );
    console.log('added bipra');
    added += 1;
  }

  if (await hasColumn('membership_kind')) {
    console.log('exists membership_kind');
  } else {
    await conn.query(
      "ALTER TABLE users ADD COLUMN membership_kind ENUM('JEMAAT','SIMPATISAN') NOT NULL DEFAULT 'JEMAAT'",
    );
    console.log('added membership_kind');
    added += 1;
  }

  if (!(await hasIndex('users_is_beyonders_idx')) && (await hasColumn('is_beyonders'))) {
    await conn.query('CREATE INDEX users_is_beyonders_idx ON users(is_beyonders)');
    console.log('index users_is_beyonders_idx added');
  }

  async function ensureUniqueIndex(name, ddl) {
    if (await hasIndex(name)) {
      console.log(`exists index ${name}`);
      return;
    }
    try {
      await conn.query(ddl);
      console.log(`index ${name} added`);
    } catch (e) {
      console.log(`index ${name} skip: ${e.message}`);
    }
  }

  if (await hasColumn('login_username')) {
    await ensureUniqueIndex(
      'users_login_username_key',
      'CREATE UNIQUE INDEX users_login_username_key ON users(login_username)',
    );
  }
  if (await hasColumn('google_sub')) {
    await ensureUniqueIndex('users_google_sub_key', 'CREATE UNIQUE INDEX users_google_sub_key ON users(google_sub)');
  }
  if (await hasColumn('claim_token')) {
    await ensureUniqueIndex('users_claim_token_key', 'CREATE UNIQUE INDEX users_claim_token_key ON users(claim_token)');
  }
  if (await hasColumn('reset_token')) {
    await ensureUniqueIndex('users_reset_token_key', 'CREATE UNIQUE INDEX users_reset_token_key ON users(reset_token)');
  }

  console.log(`user prisma-parity: ${added} columns added`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
