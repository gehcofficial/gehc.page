/**
 * Idempotent: tabel bank soal event + seed katalog v1.
 * ON DUPLICATE KEY hanya memperbarui label/hint/owner/sort — options/showIf/status tidak ditimpa.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function hasTable(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

async function main() {
  const { SEED_QUESTIONS, bankId } = await import('./lib/event-question-bank.mjs');
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
    if (!(await hasTable(conn, 'event_question_bank'))) {
      await conn.query(`
        CREATE TABLE event_question_bank (
          id VARCHAR(64) NOT NULL,
          \`key\` VARCHAR(64) NOT NULL,
          label VARCHAR(190) NOT NULL,
          hint TEXT NULL,
          \`type\` VARCHAR(16) NOT NULL,
          options JSON NULL,
          owner_division VARCHAR(24) NOT NULL,
          owner_subdivision VARCHAR(80) NOT NULL,
          show_if JSON NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
          sort_order INT NOT NULL DEFAULT 0,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY event_question_bank_key (\`key\`),
          KEY event_question_bank_status_sort (status, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('event_question_bank created');
    } else {
      console.log('event_question_bank already exists');
    }

    if (!(await hasTable(conn, 'event_question_requests'))) {
      await conn.query(`
        CREATE TABLE event_question_requests (
          id VARCHAR(64) NOT NULL,
          label VARCHAR(190) NOT NULL,
          hint TEXT NULL,
          \`type\` VARCHAR(16) NOT NULL,
          options JSON NULL,
          owner_division VARCHAR(24) NOT NULL,
          owner_subdivision VARCHAR(80) NOT NULL,
          reason TEXT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
          created_by_id VARCHAR(64) NOT NULL,
          reviewed_by_id VARCHAR(64) NULL,
          reviewed_at DATETIME(3) NULL,
          admin_note TEXT NULL,
          approved_question_id VARCHAR(64) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          KEY event_question_requests_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('event_question_requests created');
    } else {
      console.log('event_question_requests already exists');
    }

    if (!(await hasTable(conn, 'event_question_assignments'))) {
      await conn.query(`
        CREATE TABLE event_question_assignments (
          id VARCHAR(64) NOT NULL,
          event_id VARCHAR(64) NOT NULL,
          question_id VARCHAR(64) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          enabled TINYINT(1) NOT NULL DEFAULT 1,
          PRIMARY KEY (id),
          UNIQUE KEY event_question_assignments_event_q (event_id, question_id),
          KEY event_question_assignments_event (event_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('event_question_assignments created');
    } else {
      console.log('event_question_assignments already exists');
    }

    if (!(await hasTable(conn, 'event_question_answers'))) {
      await conn.query(`
        CREATE TABLE event_question_answers (
          id VARCHAR(64) NOT NULL,
          event_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          question_id VARCHAR(64) NOT NULL,
          value JSON NOT NULL,
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY event_question_answers_event_user_q (event_id, user_id, question_id),
          KEY event_question_answers_event_user (event_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('event_question_answers created');
    } else {
      console.log('event_question_answers already exists');
    }

    const values = SEED_QUESTIONS.map(() => '(?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, CAST(? AS JSON), \'ACTIVE\', ?)').join(', ');
    const params = [];
    for (const q of SEED_QUESTIONS) {
      params.push(
        bankId(q.key),
        q.key,
        q.label,
        q.hint,
        q.type,
        q.options ? JSON.stringify(q.options) : null,
        q.ownerDivision,
        q.ownerSubdivision,
        q.showIf ? JSON.stringify(q.showIf) : null,
        q.sortOrder,
      );
    }
    await conn.query(
      `INSERT INTO event_question_bank
        (id, \`key\`, label, hint, \`type\`, options, owner_division, owner_subdivision, show_if, status, sort_order)
       VALUES ${values}
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         hint = VALUES(hint),
         owner_division = VALUES(owner_division),
         owner_subdivision = VALUES(owner_subdivision),
         sort_order = VALUES(sort_order)`,
      params,
    );
    console.log(`seeded ${SEED_QUESTIONS.length} event questions (label/owner only on update)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
