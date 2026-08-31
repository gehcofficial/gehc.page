/**
 * Idempotent: create event_attendees table for event check-in (members + newcomers).
 */
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const conn = await mysql.createConnection(url);
  try {
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_attendees'`,
    );
    if (tables.length) {
      console.log('event_attendees already exists — skip');
      return;
    }
    await conn.query(`
      CREATE TABLE event_attendees (
        id VARCHAR(64) NOT NULL,
        event_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        metadata JSON NULL,
        PRIMARY KEY (id),
        UNIQUE KEY event_attendees_event_id_user_id_key (event_id, user_id),
        KEY event_attendees_event_id_idx (event_id),
        CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES EventProgram(id) ON DELETE CASCADE,
        CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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
