require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Tabel serving_cycle_pairs — urutan siklus serving (10 pasangan) agar dapat
 * diubah admin tanpa deploy. Di-seed dari SERVING_PAIRS di server/lib/serving-cycle.mjs.
 * Idempotent: tabel dibuat bila belum ada; seed hanya untuk cycle_index yang kosong.
 */

const SERVING_PAIRS = [
  ['Echad', 'Ruach'],
  ['Kairos', 'Shalom'],
  ['Agape', 'Metanoia'],
  ['Avodah', 'Hesed'],
  ['Logos', 'Dunamis'],
  ['Ruach', 'Echad'],
  ['Shalom', 'Kairos'],
  ['Metanoia', 'Agape'],
  ['Hesed', 'Avodah'],
  ['Dunamis', 'Logos'],
];

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

  const [tbl] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'serving_cycle_pairs'`,
  );
  if (!tbl.length) {
    // Kolom FK harus memakai collation yang sama dengan groups.id agar FK valid.
    const [collRows] = await conn.query(
      `SELECT COLLATION_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'id'`,
    );
    const coll = collRows[0]?.COLLATION_NAME ? String(collRows[0].COLLATION_NAME) : 'utf8mb4_unicode_ci';
    const idCol = `VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ${coll}`;
    await conn.query(`
      CREATE TABLE serving_cycle_pairs (
        cycle_index TINYINT NOT NULL PRIMARY KEY,
        responsible_group_id ${idCol} NOT NULL,
        host_group_id ${idCol} NOT NULL,
        updated_by_id VARCHAR(64) NULL,
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        CONSTRAINT fk_serv_cycle_resp FOREIGN KEY (responsible_group_id) REFERENCES \`groups\` (id),
        CONSTRAINT fk_serv_cycle_host FOREIGN KEY (host_group_id) REFERENCES \`groups\` (id)
      )
    `);
    console.log(`serving_cycle_pairs created (collation ${coll})`);
  } else {
    console.log('serving_cycle_pairs exists');
  }

  // Seed hanya bila belum ada isinya — resolusi nama grup case-insensitive,
  // utamakan id kanonik grp-<n>.
  const [countRows] = await conn.query('SELECT COUNT(*) AS c FROM serving_cycle_pairs');
  const existing = Number(countRows[0]?.c || 0);
  if (existing > 0) {
    console.log(`seed dilewati (sudah ada ${existing} baris)`);
    await conn.end();
    return;
  }
  const [groups] = await conn.query('SELECT id, name FROM `groups`');
  const idByName = (name) => {
    const target = String(name).trim().toUpperCase();
    const cands = (groups || []).filter((g) => String(g.name || '').toUpperCase() === target);
    if (!cands.length) return null;
    const canonical = cands.find((g) => /^grp-\d+$/.test(String(g.id)));
    return (canonical || cands[0]).id;
  };

  let seeded = 0;
  for (let i = 0; i < SERVING_PAIRS.length; i++) {
    const [respName, hostName] = SERVING_PAIRS[i];
    const respId = idByName(respName);
    const hostId = idByName(hostName);
    if (!respId || !hostId) {
      console.warn(`  cycle ${i}: grup ${respName}/${hostName} tidak ditemukan — dilewati`);
      continue;
    }
    await conn.query(
      `INSERT INTO serving_cycle_pairs (cycle_index, responsible_group_id, host_group_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE responsible_group_id = VALUES(responsible_group_id), host_group_id = VALUES(host_group_id)`,
      [i, respId, hostId],
    );
    seeded += 1;
  }
  console.log(`seed selesai: ${seeded}/${SERVING_PAIRS.length} pasangan`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
