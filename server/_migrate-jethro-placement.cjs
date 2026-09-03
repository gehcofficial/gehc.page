require('dotenv').config();
const mysql = require('mysql2/promise');

const TABLE_OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
/** Prisma @default(cuid()) → varchar(191) on MySQL/TiDB */
const ID = 'VARCHAR(191) COLLATE utf8mb4_unicode_ci';

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
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

  if (!(await tableExists(conn, 'placement_batches'))) {
    await conn.query(`
      CREATE TABLE placement_batches (
        id ${ID} NOT NULL,
        status VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
        createdBy VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        generated_at DATETIME(3) NULL,
        reviewed_at DATETIME(3) NULL,
        reviewedBy VARCHAR(64) COLLATE utf8mb4_unicode_ci NULL,
        committed_at DATETIME(3) NULL,
        committedBy VARCHAR(64) COLLATE utf8mb4_unicode_ci NULL,
        PRIMARY KEY (id),
        INDEX placement_batches_status_idx (status),
        INDEX placement_batches_createdBy_idx (createdBy)
      ) ${TABLE_OPTS}
    `);
    console.log('placement_batches created');
  } else {
    console.log('placement_batches already exists — skip');
  }

  if (!(await tableExists(conn, 'placement_items'))) {
    await conn.query(`
      CREATE TABLE placement_items (
        id ${ID} NOT NULL,
        batch_id ${ID} NOT NULL,
        newcomer_id VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
        newcomer_name VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
        newcomer_gender VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL,
        newcomer_gifts_top5 JSON NOT NULL,
        newcomer_maturity_score DOUBLE NULL,
        recommended_group_id VARCHAR(64) COLLATE utf8mb4_unicode_ci NULL,
        recommended_group_name VARCHAR(150) COLLATE utf8mb4_unicode_ci NULL,
        recommended_role VARCHAR(30) COLLATE utf8mb4_unicode_ci NULL,
        confidence DOUBLE NOT NULL,
        reasons JSON NOT NULL,
        score_breakdown JSON NULL,
        status VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
        final_group_id VARCHAR(64) COLLATE utf8mb4_unicode_ci NULL,
        final_role VARCHAR(30) COLLATE utf8mb4_unicode_ci NULL,
        final_is_individu BOOLEAN NOT NULL DEFAULT false,
        reviewed_by VARCHAR(64) COLLATE utf8mb4_unicode_ci NULL,
        reviewed_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX placement_items_batch_id_idx (batch_id),
        INDEX placement_items_newcomer_id_idx (newcomer_id),
        INDEX placement_items_status_idx (status),
        CONSTRAINT placement_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES placement_batches(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ${TABLE_OPTS}
    `);
    console.log('placement_items created');
  } else {
    console.log('placement_items already exists — skip');
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
