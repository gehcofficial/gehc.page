/**
 * Idempotent: create testimonials table for landing collage rotator.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

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
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'testimonials'`,
    );
    if (tables.length) {
      console.log('testimonials already exists — skip');
      return;
    }
    await conn.query(`
      CREATE TABLE testimonials (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-youth',
        author_name VARCHAR(150) NOT NULL,
        group_name VARCHAR(100) NULL,
        quote TEXT NOT NULL,
        photo_url TEXT NULL,
        is_published BOOLEAN NOT NULL DEFAULT false,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY testimonials_tenant_pub_sort_idx (tenant_id, is_published, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('testimonials created');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
