/**
 * Idempotent: Info & Peluang (Warta Internal) — tabel internal_warta.
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

  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    ['internal_warta'],
  );
  if (rows.length) {
    console.log('internal_warta sudah ada');
  } else {
    await conn.query(
      "CREATE TABLE `internal_warta` (`id` VARCHAR(64) NOT NULL,`title` VARCHAR(200) NOT NULL,`summary` TEXT NULL,`body` MEDIUMTEXT NULL,`category` VARCHAR(30) NOT NULL DEFAULT 'UMUM',`share_user_id` VARCHAR(64) NULL,`share_note` VARCHAR(190) NULL,`attachments` JSON NULL,`link` VARCHAR(500) NULL,`deadline` DATE NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',`is_pinned` BOOLEAN NOT NULL DEFAULT false,`view_count` INT NOT NULL DEFAULT 0,`created_by_id` VARCHAR(64) NULL,`published_at` DATETIME(3) NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `internal_warta_status_published_idx`(`status`, `published_at`), INDEX `internal_warta_category_idx`(`category`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    );
    console.log('internal_warta dibuat');
  }

  await conn.end();
  console.log('✓ Selesai.');
})().catch((e) => {
  console.error('Gagal migrasi internal warta:', e?.message || e);
  process.exit(1);
});
