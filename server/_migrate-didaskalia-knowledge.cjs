/**
 * Idempotent: Didaskalia knowledge base + instruksi AI (Gems-like).
 * Membuat tabel didaskalia_knowledge & didaskalia_ai_config bila belum ada.
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

  console.log('Migrasi didaskalia knowledge…');

  if (await hasTable('didaskalia_knowledge')) {
    console.log('didaskalia_knowledge sudah ada');
  } else {
    await conn.query(
      "CREATE TABLE `didaskalia_knowledge` (`id` VARCHAR(64) NOT NULL,`title` VARCHAR(200) NOT NULL,`content` MEDIUMTEXT NOT NULL,`category` VARCHAR(30) NOT NULL DEFAULT 'REFERENSI',`tags` JSON NULL,`source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',`file_name` VARCHAR(255) NULL,`is_active` BOOLEAN NOT NULL DEFAULT true,`sort_order` INT NOT NULL DEFAULT 0,`created_by_id` VARCHAR(64) NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `didaskalia_knowledge_active_sort_idx`(`is_active`, `sort_order`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    );
    console.log('didaskalia_knowledge dibuat');
  }

  if (await hasTable('didaskalia_ai_config')) {
    console.log('didaskalia_ai_config sudah ada');
  } else {
    await conn.query(
      "CREATE TABLE `didaskalia_ai_config` (`id` VARCHAR(64) NOT NULL,`instruction` TEXT NULL,`max_knowledge_chars` INT NOT NULL DEFAULT 12000,`updated_by_id` VARCHAR(64) NULL,`updated_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    );
    console.log('didaskalia_ai_config dibuat');
  }

  await conn.end();
  console.log('✓ Selesai.');
})().catch((e) => {
  console.error('Gagal migrasi didaskalia knowledge:', e?.message || e);
  process.exit(1);
});
