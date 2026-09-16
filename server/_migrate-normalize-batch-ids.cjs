require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Normalisasi id batch lama: `batch-<groupId>-<periode-lama>` yang sudah tidak
 * cocok dengan kolom `period` → `batch-<groupId>-<period>`.
 *
 * Aman & idempotent:
 * - Hanya menyentuh id yang berakhiran pola `-YYYY-MM` (id baru bersufiks acak
 *   hex tidak akan cocok), dan yang periodenya berbeda dari kolom `period`.
 * - Melewati bila id kanonis sudah dipakai atau > 64 char.
 * - Tidak ada tabel lain yang menyimpan id batch (hanya referensi internal).
 *
 *   node server/_migrate-normalize-batch-ids.cjs
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

  const [rows] = await conn.query(
    `SELECT id, group_id, period FROM group_batches
     WHERE id LIKE 'batch-%' AND id REGEXP '-[0-9]{4}-[0-9]{2}$'`,
  );

  let fixed = 0;
  let skipped = 0;
  for (const row of rows) {
    const m = String(row.id).match(/-(\d{4}-\d{2})$/);
    const idPeriod = m ? m[1] : null;
    if (!idPeriod || idPeriod === row.period) continue; // sudah selaras

    const canonical = `batch-${row.group_id}-${row.period}`;
    if (canonical.length > 64) { skipped += 1; continue; }

    const [clash] = await conn.query(
      `SELECT id FROM group_batches WHERE id = ? LIMIT 1`, [canonical],
    );
    if (clash.length) { skipped += 1; continue; }

    await conn.query(`UPDATE group_batches SET id = ? WHERE id = ?`, [canonical, row.id]);
    fixed += 1;
    console.log(`  ${row.id} → ${canonical}`);
  }

  console.log(`normalize batch ids: ${fixed} diperbaiki, ${skipped} dilewati, ${rows.length} diperiksa`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
