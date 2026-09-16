require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Kembalikan 10 rumah ke generasi awal (2026-06):
 * - backup group_batches & group_members (10 rumah) ke backups/
 * - is_current: hanya batch period '2026-06' yang aktif
 * - group_members: batch_period non-2026-06 (atau null) → '2026-06'
 * Tidak menghapus data. Idempotent.
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

  const dir = path.join(process.cwd(), 'backups', `restore-gen0-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(dir, { recursive: true });

  const [batches] = await conn.query(`SELECT * FROM group_batches WHERE group_id IN (?)`, [HOMES]);
  const [members] = await conn.query(`SELECT * FROM group_members WHERE group_id IN (?)`, [HOMES]);
  fs.writeFileSync(path.join(dir, 'group_batches.json'), JSON.stringify(batches, null, 2));
  fs.writeFileSync(path.join(dir, 'group_members.json'), JSON.stringify(members, null, 2));
  console.log(`Backup → ${dir} (batches: ${batches.length}, members: ${members.length})`);

  const [bOff] = await conn.query(`UPDATE group_batches SET is_current = 0 WHERE group_id IN (?)`, [HOMES]);
  const [bOn] = await conn.query(`UPDATE group_batches SET is_current = 1 WHERE group_id IN (?) AND period = ?`, [HOMES, GEN0]);
  console.log(`batch is_current: ${bOff.affectedRows} off, ${bOn.affectedRows} on (${GEN0})`);

  const [m] = await conn.query(
    `UPDATE group_members SET batch_period = ? WHERE group_id IN (?) AND (batch_period IS NULL OR batch_period <> ?)`,
    [GEN0, HOMES, GEN0],
  );
  console.log(`group_members dipulihkan ke ${GEN0}: ${m.affectedRows} baris`);

  const [check] = await conn.query(
    `SELECT period, is_current, COUNT(*) c FROM group_batches WHERE group_id IN (?) GROUP BY period, is_current ORDER BY period`,
    [HOMES],
  );
  console.log('verifikasi batch:', JSON.stringify(check));
  const [mcheck] = await conn.query(
    `SELECT batch_period, status, COUNT(*) c FROM group_members WHERE group_id IN (?) GROUP BY batch_period, status`,
    [HOMES],
  );
  console.log('verifikasi members:', JSON.stringify(mcheck));

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
