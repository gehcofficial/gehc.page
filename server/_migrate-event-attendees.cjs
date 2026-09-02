/**
 * Idempotent: create event_attendees table for event check-in (members + newcomers).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const TABLE_OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
const VC = 'VARCHAR(64) COLLATE utf8mb4_unicode_ci';

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
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
    if (await tableExists(conn, 'event_attendees')) {
      console.log('event_attendees already exists — skip');
      return;
    }
    await conn.query(`
      CREATE TABLE event_attendees (
        id ${VC} NOT NULL,
        event_id ${VC} NOT NULL,
        user_id ${VC} NOT NULL,
        registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        metadata JSON NULL,
        PRIMARY KEY (id),
        UNIQUE KEY event_attendees_event_id_user_id_key (event_id, user_id),
        KEY event_attendees_event_id_idx (event_id),
        CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES EventProgram(id) ON DELETE CASCADE,
        CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ${TABLE_OPTS}
    `);
    console.log('event_attendees created');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
