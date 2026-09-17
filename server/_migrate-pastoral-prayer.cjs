require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Portal Doa lanjutan:
 * - pastoral_care_notes.occurred_on (tanggal kejadian, boleh mundur)
 * - pastoral_care_notes.context_event_id (tautan ke kegiatan)
 * - pastoral_care_notes.prayed_at / prayed_count (ringkasan doa terakhir)
 * - pastoral_prayer_logs (riwayat doa per tanggal — Doa Minggu/backdate)
 * Idempotent: aman dijalankan berulang.
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

  async function columnExists(table, column) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows.length > 0;
  }

  async function tableExists(table) {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }

  const TABLE = 'pastoral_care_notes';

  if (!(await columnExists(TABLE, 'occurred_on'))) {
    await conn.query(`ALTER TABLE ${TABLE} ADD COLUMN occurred_on DATE NULL`);
    console.log(`${TABLE}.occurred_on added (nullable)`);
  }
  // Backfill dari tanggal pencatatan, lalu kunci NOT NULL bila TiDB mendukung.
  const [bf] = await conn.query(
    `UPDATE ${TABLE} SET occurred_on = DATE(created_at) WHERE occurred_on IS NULL`,
  );
  if (bf.affectedRows) console.log(`  backfill occurred_on: ${bf.affectedRows} baris`);
  try {
    await conn.query(
      `ALTER TABLE ${TABLE} MODIFY COLUMN occurred_on DATE NOT NULL DEFAULT (CURRENT_DATE)`,
    );
    console.log(`${TABLE}.occurred_on NOT NULL DEFAULT (CURRENT_DATE)`);
  } catch (e) {
    console.warn(`  occurred_on default ekspresi tidak didukung: ${e.message}`);
  }

  if (!(await columnExists(TABLE, 'context_event_id'))) {
    await conn.query(`ALTER TABLE ${TABLE} ADD COLUMN context_event_id VARCHAR(64) NULL`);
    console.log(`${TABLE}.context_event_id added`);
  }

  if (!(await columnExists(TABLE, 'prayed_at'))) {
    await conn.query(`ALTER TABLE ${TABLE} ADD COLUMN prayed_at DATETIME(3) NULL`);
    console.log(`${TABLE}.prayed_at added`);
  }

  if (!(await columnExists(TABLE, 'prayed_count'))) {
    await conn.query(`ALTER TABLE ${TABLE} ADD COLUMN prayed_count INT NOT NULL DEFAULT 0`);
    console.log(`${TABLE}.prayed_count added`);
  }

  if (!(await tableExists('pastoral_prayer_logs'))) {
    await conn.query(`
      CREATE TABLE pastoral_prayer_logs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        note_id VARCHAR(64) NOT NULL,
        prayed_on DATE NOT NULL,
        service_event_id VARCHAR(64) NULL,
        prayed_by_id VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY pastoral_prayer_logs_note_day (note_id, prayed_on),
        KEY pastoral_prayer_logs_prayed_on_idx (prayed_on),
        CONSTRAINT pastoral_prayer_logs_note_fk FOREIGN KEY (note_id)
          REFERENCES pastoral_care_notes (id) ON DELETE CASCADE
      )
    `);
    console.log('pastoral_prayer_logs created');
  } else {
    console.log('pastoral_prayer_logs already exists');
  }

  // Sinkronkan ringkasan dari log (bila tabel baru diisi ulang / log tertinggal).
  const [sync] = await conn.query(`
    UPDATE pastoral_care_notes n
    JOIN (
      SELECT note_id, MAX(prayed_on) AS last_on, COUNT(*) AS total
      FROM pastoral_prayer_logs GROUP BY note_id
    ) l ON l.note_id = n.id
    SET n.prayed_at = TIMESTAMP(l.last_on), n.prayed_count = l.total
    WHERE n.prayed_count <> l.total
       OR n.prayed_at IS NULL
       OR DATE(n.prayed_at) <> l.last_on
  `);
  if (sync.affectedRows) console.log(`  ringkasan doa disinkronkan: ${sync.affectedRows} baris`);

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
