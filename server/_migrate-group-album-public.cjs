require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Album kelompok dapat ditampilkan ke publik (landing & detail grup).
 * Aditif & idempotent: show_on_landing (default FALSE) + published_at.
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

  async function columnExists(column) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_albums' AND COLUMN_NAME = ?`,
      [column],
    );
    return rows.length > 0;
  }

  if (!(await columnExists('show_on_landing'))) {
    await conn.query(`ALTER TABLE group_albums ADD COLUMN show_on_landing BOOLEAN NOT NULL DEFAULT FALSE`);
    console.log('group_albums.show_on_landing added (default FALSE)');
  } else {
    console.log('group_albums.show_on_landing exists');
  }

  if (!(await columnExists('published_at'))) {
    await conn.query(`ALTER TABLE group_albums ADD COLUMN published_at DATETIME(3) NULL`);
    console.log('group_albums.published_at added');
  } else {
    console.log('group_albums.published_at exists');
  }

  const [pub] = await conn.query('SELECT COUNT(*) AS c FROM group_albums WHERE show_on_landing = TRUE');
  console.log('album publik saat ini:', Number(pub[0]?.c || 0));
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
