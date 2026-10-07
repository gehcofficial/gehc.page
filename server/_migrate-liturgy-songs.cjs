/**
 * Idempotent (Liturgia — Pustaka Lagu + Setlist Ibadah, lintas unit):
 *   songs, service_songs
 *
 * Jalankan: npm run db:migrate:liturgy-songs[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`songs\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`source\` VARCHAR(24) NOT NULL DEFAULT 'LOKAL',
    \`source_ref\` VARCHAR(64) NULL,
    \`source_url\` VARCHAR(500) NULL,
    \`authors\` VARCHAR(300) NULL,
    \`copyright\` VARCHAR(500) NULL,
    \`ccli\` VARCHAR(32) NULL,
    \`default_key\` VARCHAR(8) NULL,
    \`tempo\` INT NULL,
    \`lyrics_chord_pro\` MEDIUMTEXT NULL,
    \`tenant_scope\` VARCHAR(64) NOT NULL DEFAULT 'GLOBAL',
    \`is_active\` BOOLEAN NOT NULL DEFAULT true,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`songs_source_title_idx\`(\`source\`, \`title\`),
    INDEX \`songs_tenant_scope_is_active_idx\`(\`tenant_scope\`, \`is_active\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`service_songs\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NULL,
    \`session_id\` VARCHAR(64) NULL,
    \`song_id\` VARCHAR(64) NOT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`sections\` JSON NULL,
    \`base_key\` VARCHAR(8) NULL,
    \`transpose\` INT NOT NULL DEFAULT 0,
    \`capo\` INT NULL,
    \`moment\` VARCHAR(32) NULL,
    \`note\` VARCHAR(500) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`service_songs_event_id_sort_order_idx\`(\`event_id\`, \`sort_order\`),
    INDEX \`service_songs_session_id_sort_order_idx\`(\`session_id\`, \`sort_order\`),
    INDEX \`service_songs_song_id_idx\`(\`song_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
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

  for (const ddl of DDL) {
    const name = /`([a-z_]+)`/.exec(ddl)?.[1] || '?';
    const [t] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [name],
    );
    if (t.length) {
      console.log(`tabel ${name} sudah ada`);
      continue;
    }
    await conn.query(ddl);
    console.log(`✓ tabel ${name} dibuat`);
  }

  // Kolom kurasi bedah lagu (kisah + makna) — idempotent.
  for (const [col, def] of [['story', 'MEDIUMTEXT NULL'], ['meaning', 'TEXT NULL']]) {
    const [c] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'songs' AND COLUMN_NAME = ?`,
      [col],
    );
    if (c.length) {
      console.log(`kolom songs.${col} sudah ada`);
      continue;
    }
    await conn.query(`ALTER TABLE \`songs\` ADD COLUMN \`${col}\` ${def}`);
    console.log(`✓ kolom songs.${col} ditambahkan`);
  }

  await conn.end();
  console.log('✓ Selesai (Liturgia: pustaka lagu + setlist).');
})().catch((e) => {
  console.error('Gagal migrasi liturgy-songs:', e?.message || e);
  process.exit(1);
});
