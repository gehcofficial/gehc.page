/**
 * Idempotent: Voting logo kelompok — tabel group_logo_votes/options/ballots.
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

  async function hasTable(table) {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }
  async function create(table, ddl) {
    if (await hasTable(table)) { console.log(`${table} sudah ada`); return; }
    await conn.query(ddl);
    console.log(`${table} dibuat`);
  }

  console.log('Migrasi voting logo…');

  await create('group_logo_votes',
    "CREATE TABLE `group_logo_votes` (`id` VARCHAR(64) NOT NULL,`title` VARCHAR(200) NOT NULL,`description` TEXT NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',`closes_at` DATETIME(3) NULL,`created_by_id` VARCHAR(64) NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

  await create('group_logo_options',
    "CREATE TABLE `group_logo_options` (`id` VARCHAR(64) NOT NULL,`session_id` VARCHAR(64) NOT NULL,`group_id` VARCHAR(64) NOT NULL,`option_no` INT NOT NULL,`label` VARCHAR(100) NOT NULL,`image_file_id` VARCHAR(120) NULL,`philosophy` TEXT NULL,`vote_count` INT NOT NULL DEFAULT 0,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, UNIQUE INDEX `group_logo_options_session_group_no_key`(`session_id`, `group_id`, `option_no`), INDEX `group_logo_options_group_id_idx`(`group_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

  await create('group_logo_ballots',
    "CREATE TABLE `group_logo_ballots` (`id` VARCHAR(64) NOT NULL,`session_id` VARCHAR(64) NOT NULL,`group_id` VARCHAR(64) NOT NULL,`option_id` VARCHAR(64) NOT NULL,`user_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, UNIQUE INDEX `group_logo_ballots_session_group_user_key`(`session_id`, `group_id`, `user_id`), INDEX `group_logo_ballots_option_id_idx`(`option_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

  await conn.end();
  console.log('✓ Selesai.');
})().catch((e) => {
  console.error('Gagal migrasi voting logo:', e?.message || e);
  process.exit(1);
});
