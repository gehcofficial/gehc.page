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

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'membership_kind'`,
  );
  if (!cols.length) {
    await conn.query(
      `ALTER TABLE users ADD COLUMN membership_kind ENUM('JEMAAT', 'SIMPATISAN') NOT NULL DEFAULT 'JEMAAT'`,
    );
    console.log('users.membership_kind added');
  } else {
    console.log('users.membership_kind exists');
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS org_nodes (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      domain VARCHAR(24) NOT NULL,
      parent_id VARCHAR(64) NULL,
      slug VARCHAR(80) NOT NULL,
      label VARCHAR(150) NOT NULL,
      node_kind VARCHAR(24) NOT NULL,
      metadata JSON NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      UNIQUE KEY org_nodes_domain_slug (domain, slug),
      KEY org_nodes_domain_idx (domain),
      KEY org_nodes_parent_id_idx (parent_id)
    )
  `);
  console.log('org_nodes ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS org_assignments (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      org_node_id VARCHAR(64) NOT NULL,
      position VARCHAR(150) NULL,
      role_assignment_id VARCHAR(64) NULL,
      assigned_by VARCHAR(64) NOT NULL,
      assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      is_active BOOLEAN NOT NULL DEFAULT true,
      KEY org_assignments_user_id_idx (user_id),
      KEY org_assignments_org_node_id_idx (org_node_id),
      KEY org_assignments_assigned_by_idx (assigned_by)
    )
  `);
  console.log('org_assignments ready');

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
