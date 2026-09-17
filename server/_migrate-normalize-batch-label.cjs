require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Normalisasi batch_label yang memuat periode keliru
 * (mis. "Batch 2026-09" pada baris period "2026-06").
 * - Ganti periode di label dengan period baris.
 * - Bila gen0 & label generik "Batch <periode>" → "Generasi 0 — Retreat UNSHAKABLE".
 * Idempotent.
 */
const GEN0_LABEL = 'Generasi 0 — Retreat UNSHAKABLE';

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
    `SELECT id, period, generation, batch_label FROM group_batches WHERE batch_label IS NOT NULL`,
  );

  let fixed = 0;
  for (const row of rows) {
    const label = String(row.batch_label || '');
    const m = label.match(/(\d{4}-\d{2})/);
    if (!m) continue;
    if (m[1] === row.period) continue;
    let next = label.replace(m[1], row.period);
    if (Number(row.generation) === 0 && /^Batch \d{4}-\d{2}$/.test(next)) next = GEN0_LABEL;
    await conn.query(`UPDATE group_batches SET batch_label = ? WHERE id = ?`, [next, row.id]);
    fixed += 1;
    console.log(`  ${row.id} [${row.period}] "${label}" → "${next}"`);
  }
  console.log(`normalize batch_label: ${fixed} diperbaiki dari ${rows.length} baris`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
