/**
 * Backfill google_sub + link_status for users who registered via Google GIS
 * but were created before register/google set link fields.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const conn = await mysql.createConnection(url);
  try {
    const [result] = await conn.query(`
      UPDATE users
      SET google_sub = id, link_status = 'LINKED', auth_provider = 'GOOGLE'
      WHERE auth_provider = 'GOOGLE'
        AND (link_status IS NULL OR link_status = 'UNLINKED')
        AND (google_sub IS NULL OR google_sub = '')
    `);
    console.log(`Backfill google link: ${result.affectedRows || 0} rows updated`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
