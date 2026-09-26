/**
 * Idempotent: tambah kolom `tenant_id` (+ index) pada `struktur_members`,
 * lalu tandai tenant baris lama:
 *   - divisi Panca Tugas Pemuda → tenant-youth
 *   - sisanya (BPMJ/KOMISI/…) → tenant-jemaat
 *
 * Jalankan: npm run db:migrate:struktur-tenant[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const YOUTH_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR', 'TIMKERJA'];

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

  const [t] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'struktur_members'`,
  );
  if (!t.length) {
    console.log('struktur_members belum ada — dilewati.');
    await conn.end();
    return;
  }

  const [c] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'struktur_members' AND COLUMN_NAME = 'tenant_id'`,
  );
  if (c.length) {
    console.log('struktur_members.tenant_id sudah ada');
  } else {
    await conn.query('ALTER TABLE `struktur_members` ADD COLUMN `tenant_id` VARCHAR(64) NULL');
    console.log('struktur_members.tenant_id ditambahkan');
  }

  const [idx] = await conn.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'struktur_members' AND INDEX_NAME = 'struktur_members_tenant_id_idx'`,
  );
  if (!idx.length) {
    await conn.query('CREATE INDEX `struktur_members_tenant_id_idx` ON `struktur_members` (`tenant_id`)');
    console.log('index struktur_members.tenant_id dibuat');
  }

  const placeholders = YOUTH_DIVISIONS.map(() => '?').join(', ');
  const [youth] = await conn.query(
    `UPDATE struktur_members SET tenant_id = 'tenant-youth' WHERE tenant_id IS NULL AND UPPER(COALESCE(division, '')) IN (${placeholders})`,
    YOUTH_DIVISIONS,
  );
  console.log(`baris Pemuda ditandai: ${youth.affectedRows}`);

  const [jemaat] = await conn.query(
    `UPDATE struktur_members SET tenant_id = 'tenant-jemaat' WHERE tenant_id IS NULL`,
  );
  console.log(`baris jemaat ditandai: ${jemaat.affectedRows}`);

  await conn.end();
  console.log('✓ Selesai.');
})().catch((e) => {
  console.error('Gagal migrasi struktur tenant:', e?.message || e);
  process.exit(1);
});
