/**
 * Idempotent: multi-unit / host-aware onboarding.
 *
 * - users.bipra dibuat NULLABLE (null = belum ditempatkan, registrasi netral dari hub)
 * - users.registration_origin VARCHAR(64) (hub | youth | teen | kids | men | women | districts | community)
 * - tenants.default_bipra ENUM NULL + tenants.registration_open BOOLEAN
 * - Backfill baris lama: registration_origin = 'youth'
 *
 * Tidak ada DROP. Aman dijalankan berulang.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const BIPRA_ENUM = "ENUM('BAPAK','IBU','PEMUDA','REMAJA','ANAK')";

async function columnInfo(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
  );
  return rows[0] || null;
}

async function ensureColumn(conn, table, col, ddl) {
  if (await columnInfo(conn, table, col)) {
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

  await ensureColumn(conn, 'users', 'registration_origin', '`registration_origin` VARCHAR(64) NULL');
  await ensureColumn(conn, 'tenants', 'default_bipra', `\`default_bipra\` ${BIPRA_ENUM} NULL`);
  await ensureColumn(
    conn,
    'tenants',
    'registration_open',
    '`registration_open` BOOLEAN NOT NULL DEFAULT false',
  );

  const bipra = await columnInfo(conn, 'users', 'bipra');
  if (bipra && bipra.IS_NULLABLE === 'NO') {
    await conn.query(`ALTER TABLE \`users\` MODIFY COLUMN \`bipra\` ${BIPRA_ENUM} NULL`);
    console.log('users.bipra -> NULL allowed');
  } else {
    console.log('users.bipra already nullable');
  }

  const [backfill] = await conn.query(
    `UPDATE \`users\` SET registration_origin = 'youth' WHERE registration_origin IS NULL`,
  );
  console.log('registration_origin backfill', backfill.affectedRows);

  console.log('host-tenancy migration done');
  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
