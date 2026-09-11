require('dotenv').config();
const mysql = require('mysql2/promise');

async function collationOf(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
    [table, col],
  );
  return r[0] && r[0].COLLATION_NAME ? r[0].COLLATION_NAME : null;
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
  try {
    // EventProgram: service_type, metadata (CamelCase table)
    let [cols] = await conn.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='EventProgram' AND COLUMN_NAME='service_type'`);
    if (!cols.length) {
      await conn.query(`ALTER TABLE \`EventProgram\` ADD COLUMN service_type VARCHAR(16) NULL`);
      console.log('EventProgram.service_type added');
    } else console.log('EventProgram.service_type exists');
    [cols] = await conn.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='EventProgram' AND COLUMN_NAME='metadata'`);
    if (!cols.length) {
      await conn.query(`ALTER TABLE \`EventProgram\` ADD COLUMN metadata JSON NULL`);
      console.log('EventProgram.metadata added');
    } else console.log('EventProgram.metadata exists');
    await conn.query(`CREATE INDEX idx_event_programs_service_type ON \`EventProgram\`(service_type)`).catch(()=>{});

    // ministry_week_deliverables: service_type
    [cols] = await conn.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ministry_week_deliverables' AND COLUMN_NAME='service_type'`);
    if (!cols.length) {
      await conn.query(`ALTER TABLE ministry_week_deliverables ADD COLUMN service_type VARCHAR(16) NULL`);
      console.log('ministry_week_deliverables.service_type added');
    } else console.log('ministry_week_deliverables.service_type exists');

    // serving_assignments table
    const [tbl] = await conn.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='serving_assignments'`);
    if (!tbl.length) {
      // Collation kolom harus sama dengan kolom referensi agar FK valid.
      // Prod: EventProgram.id = utf8mb4_bin, groups.id = utf8mb4_unicode_ci.
      const evColl = await collationOf(conn, 'EventProgram', 'id');
      const grpColl = await collationOf(conn, 'groups', 'id');
      const evCol = evColl ? `COLLATE ${evColl}` : '';
      const grpCol = grpColl ? `COLLATE ${grpColl}` : '';
      const tableColl = evColl || 'utf8mb4_bin';
      await conn.query(`
        CREATE TABLE serving_assignments (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) ${evCol} NULL UNIQUE,
          event_date DATE NOT NULL,
          service_type VARCHAR(16) NOT NULL,
          responsible_group_id VARCHAR(64) ${grpCol} NOT NULL,
          host_group_id VARCHAR(64) ${grpCol} NOT NULL,
          cycle_index INT NOT NULL,
          is_swapped TINYINT(1) NOT NULL DEFAULT 0,
          swap_reason TEXT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          UNIQUE KEY uniq_event_date (event_date),
          KEY idx_event_date (event_date),
          KEY idx_cycle_index (cycle_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${tableColl}
      `);
      console.log('serving_assignments created');
      // FK best-effort — jangan blokir migrasi bila collation engine berbeda.
      await conn.query(`ALTER TABLE serving_assignments ADD CONSTRAINT fk_serv_assign_event FOREIGN KEY (event_id) REFERENCES \`EventProgram\`(id) ON DELETE SET NULL`)
        .then(() => console.log('fk_serv_assign_event added'))
        .catch((e) => console.log('fk event skipped:', String(e.message).slice(0, 140)));
      await conn.query(`ALTER TABLE serving_assignments ADD CONSTRAINT fk_serv_assign_resp FOREIGN KEY (responsible_group_id) REFERENCES \`groups\`(id)`)
        .then(() => console.log('fk_serv_assign_resp added'))
        .catch((e) => console.log('fk resp skipped:', String(e.message).slice(0, 140)));
      await conn.query(`ALTER TABLE serving_assignments ADD CONSTRAINT fk_serv_assign_host FOREIGN KEY (host_group_id) REFERENCES \`groups\`(id)`)
        .then(() => console.log('fk_serv_assign_host added'))
        .catch((e) => console.log('fk host skipped:', String(e.message).slice(0, 140)));
    } else console.log('serving_assignments exists');
  } finally { await conn.end(); }
  console.log('OK serving-cycle');
})().catch(e=>{ console.error(e.message); process.exit(1); });
