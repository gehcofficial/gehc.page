/**
 * Idempotent: check-in, channel links, church programs, month plan, EventProgram.kind.
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

async function hasColumn(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
  );
  return rows.length > 0;
}

async function addColumn(conn, table, col, ddl) {
  if (await hasColumn(conn, table, col)) {
    console.log(`${table}.${col} exists`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`${table}.${col} added`);
}

async function hasIndex(conn, table, index) {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index],
  );
  return rows.length > 0;
}

async function addIndex(conn, table, index, cols) {
  if (await hasIndex(conn, table, index)) {
    console.log(`${table}.${index} exists`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX ${index} (${cols})`);
  console.log(`${table}.${index} added`);
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
    if (!(await hasTable(conn, 'church_programs'))) {
      await conn.query(`
        CREATE TABLE church_programs (
          id VARCHAR(64) NOT NULL,
          tenant_id VARCHAR(16) NOT NULL DEFAULT 'tenant-youth',
          scope VARCHAR(16) NOT NULL,
          parent_id VARCHAR(64) NULL,
          kolom_id VARCHAR(64) NULL,
          season VARCHAR(32) NULL,
          name VARCHAR(160) NOT NULL,
          description TEXT NULL,
          year INT NULL,
          created_by_id VARCHAR(64) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          KEY church_programs_tenant_scope_idx (tenant_id, scope),
          KEY church_programs_parent_idx (parent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('church_programs created');
    } else {
      console.log('church_programs already exists');
    }

    if (await hasTable(conn, 'EventProgram')) {
      await addColumn(conn, 'EventProgram', 'kind', `kind VARCHAR(16) NOT NULL DEFAULT 'KHUSUS'`);
      await addColumn(conn, 'EventProgram', 'church_program_id', `church_program_id VARCHAR(64) NULL`);
      await addIndex(conn, 'EventProgram', 'EventProgram_church_program_idx', 'church_program_id');
    }

    if (await hasTable(conn, 'event_attendees')) {
      await addColumn(conn, 'event_attendees', 'checked_in_at', `checked_in_at DATETIME(3) NULL`);
      await addColumn(conn, 'event_attendees', 'checked_in_by_id', `checked_in_by_id VARCHAR(64) NULL`);
    }

    if (await hasTable(conn, 'waiting_pool')) {
      await addColumn(conn, 'waiting_pool', 'event_checked_in_at', `event_checked_in_at DATETIME(3) NULL`);
      await addColumn(conn, 'waiting_pool', 'event_checked_in_by_id', `event_checked_in_by_id VARCHAR(64) NULL`);
    }

    if (!(await hasTable(conn, 'event_check_ins'))) {
      await conn.query(`
        CREATE TABLE event_check_ins (
          id VARCHAR(64) NOT NULL,
          event_id VARCHAR(64) NOT NULL,
          waiting_pool_id VARCHAR(64) NULL,
          user_id VARCHAR(64) NULL,
          code VARCHAR(190) NOT NULL,
          result VARCHAR(16) NOT NULL,
          scanned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          scanned_by_id VARCHAR(64) NOT NULL,
          PRIMARY KEY (id),
          KEY event_check_ins_event_scanned_idx (event_id, scanned_at),
          KEY event_check_ins_pool_idx (waiting_pool_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('event_check_ins created');
    } else {
      console.log('event_check_ins already exists');
    }

    if (!(await hasTable(conn, 'channel_links'))) {
      await conn.query(`
        CREATE TABLE channel_links (
          id VARCHAR(64) NOT NULL,
          kind VARCHAR(24) NOT NULL,
          ref_id VARCHAR(64) NOT NULL,
          label VARCHAR(160) NULL,
          url VARCHAR(512) NOT NULL,
          updated_by_id VARCHAR(64) NULL,
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY channel_links_kind_ref (kind, ref_id),
          KEY channel_links_kind_idx (kind)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('channel_links created');
    } else {
      console.log('channel_links already exists');
    }

    if (!(await hasTable(conn, 'ministry_month_plans'))) {
      await conn.query(`
        CREATE TABLE ministry_month_plans (
          id VARCHAR(64) NOT NULL,
          \`year_month\` VARCHAR(7) NOT NULL,
          theme VARCHAR(190) NULL,
          notes TEXT NULL,
          weeks JSON NULL,
          created_by_id VARCHAR(64) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY ministry_month_plans_year_month (\`year_month\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('ministry_month_plans created');
    } else {
      console.log('ministry_month_plans already exists');
    }

    if (!(await hasTable(conn, 'ministry_week_deliverables'))) {
      await conn.query(`
        CREATE TABLE ministry_week_deliverables (
          id VARCHAR(64) NOT NULL,
          plan_id VARCHAR(64) NOT NULL,
          week_index INT NOT NULL,
          division VARCHAR(24) NOT NULL,
          kind VARCHAR(24) NULL,
          title VARCHAR(190) NOT NULL,
          notes TEXT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'TODO',
          PRIMARY KEY (id),
          KEY ministry_week_deliverables_plan_week (plan_id, week_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('ministry_week_deliverables created');
    } else {
      console.log('ministry_week_deliverables already exists');
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
