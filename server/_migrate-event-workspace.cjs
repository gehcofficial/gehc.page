require('dotenv').config();
const mysql = require('mysql2/promise');

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

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

  if (!(await tableExists(conn, 'EventProgram'))) {
    await conn.query(`
      CREATE TABLE EventProgram (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(16) NOT NULL,
        slug VARCHAR(60) NOT NULL,
        name VARCHAR(160) NOT NULL,
        description TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'PLANNING',
        start_date DATETIME(3) NULL,
        end_date DATETIME(3) NULL,
        drive_folder_id VARCHAR(128) NULL,
        gmeet_link VARCHAR(512) NULL,
        whatsapp_group_url VARCHAR(512) NULL,
        created_by_id VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY EventProgram_slug_key (slug),
        KEY EventProgram_tenant_id_idx (tenant_id)
      )
    `);
    console.log('EventProgram created');
  } else {
    console.log('EventProgram already exists');
  }

  if (!(await tableExists(conn, 'EventDivision'))) {
    await conn.query(`
      CREATE TABLE EventDivision (
        id VARCHAR(64) NOT NULL,
        event_id VARCHAR(64) NOT NULL,
        division VARCHAR(24) NOT NULL,
        drive_folder_id VARCHAR(128) NULL,
        extra_user_ids JSON NULL,
        approval_status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
        approved_by_id VARCHAR(64) NULL,
        approved_at DATETIME(3) NULL,
        reject_reason TEXT NULL,
        published_at DATETIME(3) NULL,
        content_item_id VARCHAR(64) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY EventDivision_event_id_division_key (event_id, division),
        UNIQUE KEY EventDivision_content_item_id_key (content_item_id),
        KEY EventDivision_approval_status_idx (approval_status)
      )
    `);
    console.log('EventDivision created');
  } else {
    console.log('EventDivision already exists');
  }

  if (!(await tableExists(conn, 'EventMeeting'))) {
    await conn.query(`
      CREATE TABLE EventMeeting (
        id VARCHAR(64) NOT NULL,
        event_id VARCHAR(64) NOT NULL,
        division VARCHAR(24) NULL,
        title VARCHAR(200) NOT NULL,
        scheduled_at DATETIME(3) NOT NULL,
        gmeet_link VARCHAR(512) NULL,
        notes TEXT NULL,
        created_by_id VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY EventMeeting_event_id_idx (event_id)
      )
    `);
    console.log('EventMeeting created');
  } else {
    console.log('EventMeeting already exists');
  }

  if (!(await tableExists(conn, 'EventUpdate'))) {
    await conn.query(`
      CREATE TABLE EventUpdate (
        id VARCHAR(64) NOT NULL,
        event_division_id VARCHAR(64) NOT NULL,
        author_id VARCHAR(64) NOT NULL,
        body TEXT NOT NULL,
        parent_update_id VARCHAR(64) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY EventUpdate_event_division_id_idx (event_division_id),
        KEY EventUpdate_parent_update_id_idx (parent_update_id)
      )
    `);
    console.log('EventUpdate created');
  } else {
    console.log('EventUpdate already exists');
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
