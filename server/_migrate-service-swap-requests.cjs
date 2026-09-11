/**
 * Idempotent: antrean request tukar jadwal antar-grup (mutualisme).
 * Mentor/co grup peminta mengusulkan -> approver (Komisi/BOD/LEAD) putus.
 * Approve mengeksekusi transaksi swap yang sama dengan swap langsung.
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

  await conn.query(`
    CREATE TABLE IF NOT EXISTS service_swap_requests (
      id VARCHAR(64) NOT NULL,
      a_event_date DATE NOT NULL,
      b_event_date DATE NOT NULL,
      scope VARCHAR(16) NOT NULL DEFAULT 'RESPONSIBLE',
      requester_group_id VARCHAR(64) NOT NULL,
      requester_id VARCHAR(64) NOT NULL,
      peer_mentor VARCHAR(190) NULL,
      mutual_agreed TINYINT(1) NOT NULL DEFAULT 0,
      reason VARCHAR(500) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      decided_by_id VARCHAR(64) NULL,
      decided_at DATETIME(3) NULL,
      decide_note VARCHAR(500) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX service_swap_status (status),
      INDEX service_swap_group (requester_group_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('service_swap_requests OK');

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
