/**
 * Archive BAKU TAU 4.0 EventProgram after event date.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npm run db:archive:bakutau
 *   npm run db:archive:bakutau:staging
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const EVENT_ID = 'evt-baku-tau-4-0';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL belum diset.');
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);
  try {
    const [rows] = await conn.query(
      `SELECT id, status FROM EventProgram WHERE id = ? LIMIT 1`,
      [EVENT_ID],
    );
    if (!rows.length) {
      console.log(`EventProgram ${EVENT_ID} tidak ditemukan — lewati.`);
      return;
    }

    const current = rows[0].status;
    if (current === 'ARCHIVED') {
      console.log(`${EVENT_ID} sudah ARCHIVED.`);
      return;
    }

    await conn.query(
      `UPDATE EventProgram SET status = 'ARCHIVED' WHERE id = ?`,
      [EVENT_ID],
    );
    console.log(`${EVENT_ID}: ${current} → ARCHIVED`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
