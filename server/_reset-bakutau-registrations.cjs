/**
 * Reset pendaftaran BAKU TAU 4.0 (kehadiran + scan), tanpa menghapus akun.
 *
 * - Hapus event_attendees & event_check_ins event BAKU TAU
 * - Hapus baris waiting_pool tamu (tanpa user)
 * - Lepas source_event BAKU TAU dari waiting_pool yang sudah punya akun
 *   (onboarding pipeline tetap ada)
 *
 * Usage:
 *   node server/_reset-bakutau-registrations.cjs
 *   dotenv -e .env.staging -- node server/_reset-bakutau-registrations.cjs
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const BAKU_TAU_EVENT_ID = 'evt-baku-tau-4-0';
const BAKU_TAU_SOURCE = 'BAKU TAU 4.0';

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

async function columnName(conn, table, candidates) {
  for (const col of candidates) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, col],
    );
    if (rows.length) return col;
  }
  return null;
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const u = new URL(raw);
  const dbName = u.pathname.replace(/^\//, '').split('?')[0];
  console.log(`Reset BAKU TAU regs on ${u.hostname} / ${dbName}`);

  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: dbName,
    ssl: { rejectUnauthorized: true },
  });

  try {
    if (await tableExists(conn, 'event_check_ins')) {
      const [scans] = await conn.query(
        `DELETE FROM event_check_ins WHERE event_id = ?`,
        [BAKU_TAU_EVENT_ID],
      );
      console.log(`event_check_ins dihapus: ${scans.affectedRows ?? 0}`);
    } else {
      console.log('event_check_ins tidak ada — skip');
    }

    if (await tableExists(conn, 'event_attendees')) {
      const [att] = await conn.query(
        `DELETE FROM event_attendees WHERE event_id = ?`,
        [BAKU_TAU_EVENT_ID],
      );
      console.log(`event_attendees dihapus: ${att.affectedRows ?? 0}`);
    } else {
      console.log('event_attendees tidak ada — skip');
    }

    if (await tableExists(conn, 'waiting_pool')) {
      const srcCol = await columnName(conn, 'waiting_pool', ['source_event', 'sourceEvent']);
      const userCol = await columnName(conn, 'waiting_pool', ['user_id', 'userId']);
      const checkAt = await columnName(conn, 'waiting_pool', ['event_checked_in_at', 'eventCheckedInAt']);
      const checkBy = await columnName(conn, 'waiting_pool', ['event_checked_in_by_id', 'eventCheckedInById']);
      if (!srcCol || !userCol) {
        console.log('waiting_pool tanpa kolom source/user — skip unlink');
      } else {
        const [guests] = await conn.query(
          `DELETE FROM waiting_pool WHERE \`${srcCol}\` = ? AND \`${userCol}\` IS NULL`,
          [BAKU_TAU_SOURCE],
        );
        console.log(`waiting_pool tamu dihapus: ${guests.affectedRows ?? 0}`);

        if (checkAt && checkBy) {
          const [unlink] = await conn.query(
            `UPDATE waiting_pool
                SET \`${srcCol}\` = NULL,
                    \`${checkAt}\` = NULL,
                    \`${checkBy}\` = NULL
              WHERE \`${srcCol}\` = ?`,
            [BAKU_TAU_SOURCE],
          );
          console.log(`waiting_pool dilepas dari BAKU TAU: ${unlink.affectedRows ?? 0}`);
        } else {
          const [unlink] = await conn.query(
            `UPDATE waiting_pool SET \`${srcCol}\` = NULL WHERE \`${srcCol}\` = ?`,
            [BAKU_TAU_SOURCE],
          );
          console.log(`waiting_pool dilepas dari BAKU TAU: ${unlink.affectedRows ?? 0}`);
        }

        const [left] = await conn.query(
          `SELECT COUNT(*) AS n FROM waiting_pool WHERE \`${srcCol}\` = ?`,
          [BAKU_TAU_SOURCE],
        );
        console.log(`sisa source BAKU TAU: ${left[0].n}`);
      }
    } else {
      console.log('waiting_pool tidak ada — skip');
    }

    if (await tableExists(conn, 'event_attendees')) {
      const [leftA] = await conn.query(
        `SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = ?`,
        [BAKU_TAU_EVENT_ID],
      );
      console.log(`sisa attendees: ${leftA[0].n}`);
    }
    console.log('Selesai. Akun user tidak dihapus — daftar ulang dari #/event/bakutau.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
