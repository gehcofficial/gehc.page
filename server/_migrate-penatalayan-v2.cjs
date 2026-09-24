/**
 * Idempotent: Penatalayanan terpadu v2 —
 *  - service_roles: sub_division, service_types, checklist_template
 *  - service_schedules: audit status (confirmed/done) + status_note + checklist_state
 *  - event_meetings: attendees + agenda (rapat petugas ibadah)
 * Aman dijalankan berulang.
 */
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

  async function hasColumn(table, name) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }
  async function hasTable(table) {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }
  async function addColumn(table, name, ddl) {
    if (await hasColumn(table, name)) { console.log(`${table}.${name} sudah ada`); return; }
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    console.log(`${table}.${name} ditambahkan`);
  }

  console.log('Migrasi penatalayanan v2…');

  // service_roles
  if (await hasTable('service_roles')) {
    await addColumn('service_roles', 'sub_division', 'VARCHAR(100) NULL');
    await addColumn('service_roles', 'service_types', "VARCHAR(64) NOT NULL DEFAULT 'SERVING_DAY,MENTORING_DAY'");
    await addColumn('service_roles', 'checklist_template', 'JSON NULL');
  } else {
    console.log('service_roles belum ada — dilewati (dibuat saat bootstrap).');
  }

  // service_schedules
  if (await hasTable('service_schedules')) {
    await addColumn('service_schedules', 'status_note', 'TEXT NULL');
    await addColumn('service_schedules', 'confirmed_at', 'DATETIME(3) NULL');
    await addColumn('service_schedules', 'confirmed_by_id', 'VARCHAR(64) NULL');
    await addColumn('service_schedules', 'done_at', 'DATETIME(3) NULL');
    await addColumn('service_schedules', 'done_by_id', 'VARCHAR(64) NULL');
    await addColumn('service_schedules', 'checklist_state', 'JSON NULL');
  } else {
    console.log('service_schedules belum ada — dilewati.');
  }

  // event_meetings (nama tabel Prisma = EventMeeting, tanpa @@map)
  const meetingTable = (await hasTable('EventMeeting')) ? 'EventMeeting' : (await hasTable('event_meetings')) ? 'event_meetings' : null;
  if (meetingTable) {
    await addColumn(meetingTable, 'attendees', 'JSON NULL');
    await addColumn(meetingTable, 'agenda', 'JSON NULL');
  } else {
    console.log('EventMeeting belum ada — dilewati.');
  }

  await conn.end();
  console.log('✓ Selesai.');
})().catch((e) => {
  console.error('Gagal migrasi penatalayanan v2:', e?.message || e);
  process.exit(1);
});
