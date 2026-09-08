/**
 * Migrasi 32: ministry_week_deliverables.event_id (tautan ke EventProgram).
 * Idempotent — aman dijalankan berulang.
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
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ministry_week_deliverables' AND COLUMN_NAME = 'event_id'`,
    );
    if (!cols.length) {
      await conn.query('ALTER TABLE ministry_week_deliverables ADD COLUMN event_id VARCHAR(64) NULL');
      console.log('event_id added');
    } else {
      console.log('event_id exists');
    }
    const [idx] = await conn.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ministry_week_deliverables' AND INDEX_NAME = 'ministry_week_deliverables_event_id'`,
    );
    if (!idx.length) {
      await conn.query('CREATE INDEX ministry_week_deliverables_event_id ON ministry_week_deliverables (event_id)').catch(() => null);
      console.log('event_id index ok');
    }
    // Samakan collation dengan EventProgram.id agar FK bisa dibuat
    // (tiap cluster bisa beda: lokal unicode_ci, prod bin).
    // TiDB menolak MODIFY saat index menempel — lepas index dulu, pasang lagi sesudahnya.
    let parentCollation = 'utf8mb4_unicode_ci';
    try {
      const [pc] = await conn.query(
        `SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EventProgram' AND COLUMN_NAME = 'id'`,
      );
      if (pc[0]?.COLLATION_NAME) parentCollation = pc[0].COLLATION_NAME;
    } catch { /* pakai default */ }
    await conn.query('ALTER TABLE ministry_week_deliverables DROP INDEX ministry_week_deliverables_event_id').catch(() => null);
    await conn.query(
      `ALTER TABLE ministry_week_deliverables MODIFY COLUMN event_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ${parentCollation} NULL`,
    ).then(() => console.log(`event_id collation ok (${parentCollation})`)).catch((e) => console.log('event_id collation skipped:', e.message.slice(0, 120)));
    await conn.query('CREATE INDEX ministry_week_deliverables_event_id ON ministry_week_deliverables (event_id)').catch(() => null);
    // FK opsional — lewati bila tabel induk belum ada agar migrasi tidak gagal.
    await conn.query(
      'ALTER TABLE ministry_week_deliverables ADD CONSTRAINT ministry_deliverables_event_fk FOREIGN KEY (event_id) REFERENCES EventProgram (id) ON DELETE SET NULL',
    ).then(() => console.log('event fk ok')).catch((e) => console.log('event fk skipped:', e.message.slice(0, 120)));
  } finally {
    await conn.end();
  }
  console.log('OK deliverable event link');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
