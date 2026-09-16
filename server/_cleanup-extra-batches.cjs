require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Bersihkan batch generasi selain Gen0 (2026-06) untuk 10 rumah.
 * Backup dulu, lalu hapus. Idempotent.
 */
const HOMES = ['grp-1', 'grp-2', 'grp-3', 'grp-4', 'grp-5', 'grp-6', 'grp-7', 'grp-8', 'grp-9', 'grp-10'];
const GEN0 = '2026-06';

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
    `SELECT * FROM group_batches WHERE group_id IN (?) AND period <> ?`,
    [HOMES, GEN0],
  );
  if (!rows.length) {
    console.log('Tidak ada batch ekstra. Sudah bersih.');
    await conn.end();
    return;
  }

  const dir = path.join(process.cwd(), 'backups', `cleanup-extra-batches-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'group_batches_deleted.json'), JSON.stringify(rows, null, 2));
  console.log(`Backup ${rows.length} baris → ${dir}`);

  const [del] = await conn.query(
    `DELETE FROM group_batches WHERE group_id IN (?) AND period <> ?`,
    [HOMES, GEN0],
  );
  console.log(`Dihapus: ${del.affectedRows} batch`);

  const [check] = await conn.query(
    `SELECT period, is_current, COUNT(*) c FROM group_batches WHERE group_id IN (?) GROUP BY period, is_current`,
    [HOMES],
  );
  console.log('verifikasi batch:', JSON.stringify(check));

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
