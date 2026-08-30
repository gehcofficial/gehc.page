require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const raw = process.env.DATABASE_URL;
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
    multipleStatements: true,
  });

  const [tables] = await conn.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('kolom','recreational_groups','recreational_memberships')"
  );
  console.log('tables', tables);

  const [kolom] = await conn.query('SELECT COUNT(*) AS c FROM kolom');
  console.log('kolom rows', kolom);

  let rec = [];
  try {
    [rec] = await conn.query('SELECT COUNT(*) AS c FROM recreational_groups');
    console.log('rec groups', rec);
  } catch (e) {
    console.log('rec groups missing', e.message);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS recreational_groups (
        id VARCHAR(64) NOT NULL,
        slug VARCHAR(40) NOT NULL,
        name VARCHAR(80) NOT NULL,
        kind VARCHAR(24) NOT NULL,
        UNIQUE INDEX recreational_groups_slug_key (slug),
        PRIMARY KEY (id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      CREATE TABLE IF NOT EXISTS recreational_memberships (
        user_id VARCHAR(64) NOT NULL,
        group_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (user_id, group_id),
        INDEX recreational_memberships_group_id_idx (group_id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
  }

  await conn.query(`INSERT IGNORE INTO kolom (id, number, name) VALUES
    ('kolom-1', 1, 'Kolom 1'), ('kolom-2', 2, 'Kolom 2'), ('kolom-3', 3, 'Kolom 3'),
    ('kolom-4', 4, 'Kolom 4'), ('kolom-5', 5, 'Kolom 5')`);
  await conn.query(`UPDATE users SET kolom_id = NULL WHERE kolom_id IN ('kolom-6','kolom-7','kolom-8','kolom-9','kolom-10','kolom-11','kolom-12')`);
  await conn.query(`DELETE FROM kolom WHERE number > 5`);
  await conn.query(`UPDATE users SET link_status = CASE
    WHEN password_hash IS NOT NULL OR (email IS NOT NULL AND email <> '') THEN 'LINKED'
    ELSE 'UNLINKED' END
    WHERE link_status IS NULL OR link_status = 'UNLINKED'`);

  const [k2] = await conn.query('SELECT COUNT(*) AS c FROM kolom');
  console.log('kolom', k2);
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
