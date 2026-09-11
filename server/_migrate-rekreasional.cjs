#!/usr/bin/env node
// Idempotent: RECURRING -> REKREASIONAL
const mysql = require('mysql2/promise');
require('dotenv').config();
async function main() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING;
  if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
  const u = new URL(url.replace(/^mysql:\/\//, 'http://'));
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port) || 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
  const [rows] = await conn.query(`SELECT id, kind FROM eventprogram WHERE kind='RECURRING'`);
  console.log('RECURRING rows:', rows.length);
  if (rows.length) {
    const [res] = await conn.query(`UPDATE eventprogram SET kind='REKREASIONAL' WHERE kind='RECURRING'`);
    console.log('updated:', res.affectedRows);
  } else console.log('no RECURRING to migrate');
  await conn.end();
}
main().catch((e)=>{ console.error(e); process.exit(1); });
