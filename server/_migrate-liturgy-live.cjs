/**
 * Idempotent (Liturgia — Tata Ibadah Live + Transpose Pemusik):
 *   service_order_items, service_song_settings, service_live_state
 *
 * Jalankan: npm run db:migrate:liturgy-live[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`service_order_items\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`kind\` VARCHAR(24) NOT NULL DEFAULT 'lagu',
    \`service_song_id\` VARCHAR(64) NULL,
    \`title\` VARCHAR(200) NULL,
    \`body\` MEDIUMTEXT NULL,
    \`owner\` VARCHAR(100) NULL,
    \`minutes\` INT NULL,
    \`note\` VARCHAR(500) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`service_order_items_event_id_sort_order_idx\`(\`event_id\`, \`sort_order\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`service_song_settings\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`service_song_id\` VARCHAR(64) NOT NULL,
    \`user_id\` VARCHAR(64) NOT NULL,
    \`transpose\` INT NOT NULL DEFAULT 0,
    \`capo\` INT NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY \`service_song_settings_song_user_uniq\`(\`service_song_id\`, \`user_id\`),
    INDEX \`service_song_settings_user_id_idx\`(\`user_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`service_live_state\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`access_code\` VARCHAR(16) NOT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    \`current_item_id\` VARCHAR(64) NULL,
    \`section_index\` INT NOT NULL DEFAULT 0,
    \`updated_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY \`service_live_state_event_id_uniq\`(\`event_id\`),
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

  // Jejak segmen pola per momen (kerangka Didaskalia → isi Liturgia) — idempotent.
  for (const [col, def] of [['segment_key', 'VARCHAR(64) NULL'], ['phase_no', 'INT NULL']]) {
    const [c] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_order_items' AND COLUMN_NAME = ?`,
      [col],
    );
    if (c.length) {
      console.log(`kolom service_order_items.${col} sudah ada`);
      continue;
    }
    await conn.query(`ALTER TABLE \`service_order_items\` ADD COLUMN \`${col}\` ${def}`);
    console.log(`✓ kolom service_order_items.${col} ditambahkan`);
  }

  await conn.end();
  console.log('✓ Selesai (Liturgia: tata ibadah live + transpose pemusik).');
})().catch((e) => {
  console.error('Gagal migrasi liturgy-live:', e?.message || e);
  process.exit(1);
});
