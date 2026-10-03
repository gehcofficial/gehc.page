/**
 * Seed master tempat pos pola ibadah (F5.3, Didaskalia).
 * Idempotent: upsert per code. Aman dijalankan berulang.
 *
 *   npm run db:seed:worship-venues[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('node:crypto');

const VENUES = [
  { code: 'LT1', name: 'Lt 1 — Ruang Utama', capacity: 40, kind: 'LANTAI', note: 'Ruang ibadah utama', sortOrder: 10 },
  { code: 'LT2', name: 'Lt 2', capacity: 100, kind: 'LANTAI', note: '', sortOrder: 20 },
  { code: 'LT3', name: 'Lt 3', capacity: 25, kind: 'LANTAI', note: '', sortOrder: 30 },
  { code: 'TR_KANAN', name: 'Teras Kanan', capacity: 20, kind: 'TERAS', note: 'Depan gereja antara GMIM dan GNKP', sortOrder: 40 },
  { code: 'TR_KIRI', name: 'Teras Kiri', capacity: 25, kind: 'TERAS', note: 'Gereja antara GMIM dan HKBP', sortOrder: 50 },
  { code: 'CW1', name: 'Citywalk 1', capacity: 30, kind: 'CITYWALK', note: 'Area Arbies, Makyes', sortOrder: 60 },
  { code: 'CW2', name: 'Citywalk 2', capacity: 30, kind: 'CITYWALK', note: 'Area dekat PUSH', sortOrder: 70 },
];

const uid = (p) => `${p}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

async function main() {
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
  let created = 0, updated = 0;
  for (const v of VENUES) {
    const [rows] = await conn.query('SELECT id FROM worship_venues WHERE code = ? LIMIT 1', [v.code]);
    if (rows[0]?.id) {
      await conn.query(
        'UPDATE worship_venues SET name=?, capacity=?, kind=?, note=?, sort_order=?, is_active=1 WHERE code=?',
        [v.name, v.capacity, v.kind, v.note || null, v.sortOrder, v.code],
      );
      updated += 1;
    } else {
      await conn.query(
        'INSERT INTO worship_venues (id, code, name, capacity, kind, note, is_active, sort_order) VALUES (?,?,?,?,?,?,1,?)',
        [uid('wv'), v.code, v.name, v.capacity, v.kind, v.note || null, v.sortOrder],
      );
      created += 1;
      console.log(`✓ tempat ${v.code} (${v.capacity} orang)`);
    }
  }
  await conn.end();
  console.log(`✓ Selesai (tempat pos): ${created} dibuat, ${updated} diselaraskan.`);
}

main().catch((e) => {
  console.error('Gagal seed worship-venues:', e?.message || e);
  process.exit(1);
});
