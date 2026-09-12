/**
 * Idempotent: profil gereja church-wide + kolom sosial unit.
 *
 * - Tabel `church_profile` (singleton id `church-profile`) dibuat bila belum ada.
 * - `tenants.tagline` / `contact_email` / `socials` ditambah bila belum ada.
 * - Baris default di-seed dengan INSERT IGNORE (tidak menimpa editan user).
 *
 * Tidak ada DROP. Aman dijalankan berulang.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DEFAULT_ADDRESS =
  'Gereja GMIM Eben Haezer, Jl. Kasuari No. 12, Cikarang Baru, Kab. Bekasi, Jawa Barat, Indonesia';
const DEFAULT_SCHEDULES = JSON.stringify([
  { label: 'Ibadah Umum', day: 'Minggu', time: '10.00 WIB' },
  { label: 'Ibadah Pemuda', day: 'Minggu', time: '13.00 WIB' },
]);

async function columnInfo(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
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

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return rows.length > 0;
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

  if (!(await tableExists(conn, 'church_profile'))) {
    await conn.query(`
      CREATE TABLE \`church_profile\` (
        \`id\` VARCHAR(64) NOT NULL,
        \`name\` VARCHAR(200) NOT NULL,
        \`tagline\` VARCHAR(300) NULL,
        \`description\` TEXT NULL,
        \`address_text\` TEXT NULL,
        \`map_share_url\` TEXT NULL,
        \`map_embed_query\` VARCHAR(300) NULL,
        \`contact_email\` VARCHAR(190) NULL,
        \`contact_phone\` VARCHAR(40) NULL,
        \`whatsapp\` VARCHAR(40) NULL,
        \`schedules\` JSON NULL,
        \`socials\` JSON NULL,
        \`updated_by_id\` VARCHAR(64) NULL,
        \`updated_at\` DATETIME(3) NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('church_profile table created');
  } else {
    console.log('church_profile exists');
  }

  await ensureColumn(conn, 'tenants', 'tagline', '`tagline` VARCHAR(300) NULL');
  await ensureColumn(conn, 'tenants', 'contact_email', '`contact_email` VARCHAR(190) NULL');
  await ensureColumn(conn, 'tenants', 'socials', '`socials` JSON NULL');

  await conn.query(
    `INSERT IGNORE INTO \`church_profile\`
       (\`id\`, \`name\`, \`address_text\`, \`map_share_url\`, \`map_embed_query\`, \`schedules\`, \`socials\`, \`updated_at\`)
     VALUES ('church-profile', 'GMIM Eben Haezer Cikarang', ?, ?, ?, ?, '{}', NOW(3))`,
    [
      DEFAULT_ADDRESS,
      process.env.GEHC_MAP_URL?.trim() || 'https://share.google/Ro2jBSuGfrzfg49nP',
      process.env.BAKU_TAU_MAP_EMBED_QUERY?.trim() || 'GMIM Eben Haezer Cikarang',
      DEFAULT_SCHEDULES,
    ],
  );
  console.log('church_profile default seeded (ignore-if-exists)');

  console.log('church-profile migration done');
  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
