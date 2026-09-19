require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Default event dari Profil Gereja: kolom whatsapp_group_url (grup WA default,
 * mis. grup Pemuda) untuk mengisi otomatis event mingguan. Aditif & idempotent.
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

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'church_profile' AND COLUMN_NAME = 'whatsapp_group_url'`,
  );
  if (!cols.length) {
    await conn.query(`ALTER TABLE church_profile ADD COLUMN whatsapp_group_url TEXT NULL`);
    console.log('church_profile.whatsapp_group_url added');
  } else {
    console.log('church_profile.whatsapp_group_url exists');
  }
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
