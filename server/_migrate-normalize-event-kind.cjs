require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Normalisasi kind event mingguan: RECURRING (nilai lama dari generator) → UMUM.
 * Hanya menyentuh baris ibadah mingguan (service_type MENTORING_DAY/SERVING_DAY).
 * Idempotent.
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

  const [before] = await conn.query(
    `SELECT COUNT(*) AS c FROM EventProgram WHERE kind = 'RECURRING' AND service_type IN ('MENTORING_DAY','SERVING_DAY')`,
  );
  const [res] = await conn.query(
    `UPDATE EventProgram SET kind = 'UMUM'
     WHERE kind = 'RECURRING' AND service_type IN ('MENTORING_DAY','SERVING_DAY')`,
  );
  console.log(`EventProgram RECURRING→UMUM: ${res.affectedRows} diperbaiki (dari ${Number(before[0]?.c || 0)})`);

  const [left] = await conn.query(
    `SELECT COUNT(*) AS c FROM EventProgram WHERE kind = 'RECURRING' AND service_type IN ('MENTORING_DAY','SERVING_DAY')`,
  );
  console.log('sisa yang belum normal:', Number(left[0]?.c || 0));
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
