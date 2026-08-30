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

  await conn.query(`
    CREATE TABLE IF NOT EXISTS placement_batches (
      id VARCHAR(64) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      createdBy VARCHAR(64) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      generated_at DATETIME(3) NULL,
      reviewed_at DATETIME(3) NULL,
      reviewedBy VARCHAR(64) NULL,
      committed_at DATETIME(3) NULL,
      committedBy VARCHAR(64) NULL,
      PRIMARY KEY (id),
      INDEX placement_batches_status_idx (status),
      INDEX placement_batches_createdBy_idx (createdBy)
    )
  `);
  console.log('placement_batches ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS placement_items (
      id VARCHAR(64) NOT NULL,
      batch_id VARCHAR(64) NOT NULL,
      newcomer_id VARCHAR(64) NOT NULL,
      newcomer_name VARCHAR(150) NOT NULL,
      newcomer_gender VARCHAR(20) NOT NULL,
      newcomer_gifts_top5 JSON NOT NULL,
      newcomer_maturity_score DOUBLE NULL,
      recommended_group_id VARCHAR(64) NULL,
      recommended_group_name VARCHAR(150) NULL,
      recommended_role VARCHAR(30) NULL,
      confidence DOUBLE NOT NULL,
      reasons JSON NOT NULL,
      score_breakdown JSON NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      final_group_id VARCHAR(64) NULL,
      final_role VARCHAR(30) NULL,
      final_is_individu BOOLEAN NOT NULL DEFAULT false,
      reviewed_by VARCHAR(64) NULL,
      reviewed_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      INDEX placement_items_batch_id_idx (batch_id),
      INDEX placement_items_newcomer_id_idx (newcomer_id),
      INDEX placement_items_status_idx (status),
      CONSTRAINT placement_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES placement_batches(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  console.log('placement_items ready');
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
