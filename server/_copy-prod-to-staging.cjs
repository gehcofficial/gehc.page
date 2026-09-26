/**
 * Salin DATA dari DB PRODUCTION ke DB STAGING (snapshot real untuk uji).
 *
 * Arah: DATABASE_URL_PRODUCTION (sumber) -> DATABASE_URL_STAGING (target).
 * Kebalikan dari server/_copy-church-profile-to-prod.cjs.
 *
 * Aman by default: DRY-RUN (hitung baris, tidak menulis) kecuali `--apply`.
 * Manifest tabel dibaca otomatis dari prisma/schema.prisma (model + @@map),
 * jadi tidak ada drift dengan schema.
 *
 * Keamanan:
 *   - passwordHash di `users` DIGANTI hash scrypt dari DEMO_PASSWORD
 *     (default "password123") agar akun prod tidak bisa login di staging.
 *     Pakai `--keep-password-hash` untuk mempertahankan hash asli.
 *   - Tabel rahasia/opsional dikecualikan default (lihat DEFAULT_EXCLUDE):
 *     operator platform, secret, push subscription, blob avatar, config AI.
 *
 * Flags:
 *   --apply                 benar-benar menulis ke staging (tanpa ini dry-run)
 *   --truncate              kosongkan tabel target dulu (DELETE, FK off)
 *   --only=a,b,c            hanya tabel ini
 *   --exclude=a,b           tambahan tabel yang dilewati
 *   --include-blobs         ikutkan `user_avatars` (MediumBlob, bisa besar)
 *   --include-excluded      ikutkan juga tabel default-exclude
 *   --keep-password-hash    jangan ganti password_hash user
 *   --batch=500             ukuran batch insert (default 500)
 *
 * Env (dari .env): DATABASE_URL_PRODUCTION, DATABASE_URL_STAGING
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');
const TRUNCATE = process.argv.includes('--truncate');
const INCLUDE_BLOBS = process.argv.includes('--include-blobs');
const INCLUDE_EXCLUDED = process.argv.includes('--include-excluded');
const KEEP_HASH = process.argv.includes('--keep-password-hash');
const ONLY = listFlag('--only=');
const EXTRA_EXCLUDE = new Set(listFlag('--exclude='));
const BATCH = Number((process.argv.find((a) => a.startsWith('--batch=')) || '').split('=')[1] || 500);

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';

/** Tabel yang tidak ikut default (rahasia / perangkat / blob besar). */
const DEFAULT_EXCLUDE = [
  'platform_operators',
  'platform_admin_grants',
  'platform_audit_logs',
  'push_subscriptions',
  'didaskalia_ai_config',
  'user_avatars',
];

function listFlag(prefix) {
  const raw = process.argv.find((a) => a.startsWith(prefix)) || '';
  return raw
    .slice(prefix.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function connConfig(raw, label) {
  if (!raw) throw new Error(`${label} kosong di .env`);
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  };
}

/** Hash scrypt "salt:hash" — format identik server/auth.mjs. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Baca manifest tabel dari prisma/schema.prisma. */
function readTables() {
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const src = fs.readFileSync(schemaPath, 'utf8');
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const model = m[1];
    const map = /@@map\("([^"]+)"\)/.exec(m[2]);
    out.push({ model, table: map ? map[1] : model });
  }
  return out;
}

async function columnsOf(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map((r) => ({ field: r.Field, type: String(r.Type || '').toLowerCase() }));
}

function normalize(v, isJson = false) {
  if (v === undefined || v === null) return null;
  if (Buffer.isBuffer(v) || v instanceof Date) return v;
  if (isJson) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t === '') return null;
      try {
        JSON.parse(t);
        return t;
      } catch {
        return JSON.stringify(v);
      }
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return JSON.stringify(v);
  }
  // Kolom JSON / String[] bisa kembali sebagai objek/array; serialisasi ulang.
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function insertBatch(conn, table, cols, jsonFields, rows) {
  if (!rows.length) return 0;
  const colSql = cols.map((c) => `\`${c}\``).join(', ');
  const values = rows.map((r) => cols.map((c) => normalize(r[c], jsonFields.has(c))));
  await conn.query(`INSERT INTO \`${table}\` (${colSql}) VALUES ?`, [values]);
  return rows.length;
}

async function main() {
  const srcUrl = process.env.DATABASE_URL_PRODUCTION;
  const dstUrl = process.env.DATABASE_URL_STAGING;
  const src = await mysql.createConnection(connConfig(srcUrl, 'DATABASE_URL_PRODUCTION'));
  const dst = await mysql.createConnection(connConfig(dstUrl, 'DATABASE_URL_STAGING'));

  // TiDB Cloud memakai hostname gateway yang sama antar cluster; identitas
  // sesungguhnya = host + port + database + user (kredensial beda = cluster beda).
  const srcUrlObj = new URL(srcUrl);
  const dstUrlObj = new URL(dstUrl);
  const srcHost = srcUrlObj.hostname;
  const dstHost = dstUrlObj.hostname;
  const ident = (u) => `${u.hostname}:${u.port || 4000}${u.pathname}@${u.username}`;
  if (ident(srcUrlObj) === ident(dstUrlObj)) {
    throw new Error('Sumber dan target menunjuk DB yang sama — dibatalkan.');
  }

  const tables = readTables();
  const excluded = new Set(DEFAULT_EXCLUDE);
  if (INCLUDE_BLOBS) excluded.delete('user_avatars');
  if (INCLUDE_EXCLUDED) DEFAULT_EXCLUDE.forEach((t) => excluded.delete(t));

  const selected = tables.filter(({ table }) => {
    if (ONLY.length) return ONLY.includes(table);
    if (excluded.has(table) || EXTRA_EXCLUDE.has(table)) return false;
    return true;
  });

  console.log(`Mode   : ${APPLY ? 'APPLY (tulis staging)' : 'DRY-RUN'} | truncate=${TRUNCATE} | batch=${BATCH}`);
  console.log(`Sumber : ${srcHost} -> Target: ${dstHost}`);
  console.log(
    `Tabel  : ${selected.length}/${tables.length} dipilih` +
      (excluded.size ? ` | dikecualikan: ${[...excluded].join(', ')}` : ''),
  );
  if (!KEEP_HASH) console.log('User   : password_hash diganti (DEMO_PASSWORD).');
  console.log('');

  const newHash = KEEP_HASH ? null : hashPassword(DEMO_PASSWORD);
  let totalRows = 0;
  const failures = [];
  const started = Date.now();

  try {
    if (APPLY) {
      await dst.query('SET FOREIGN_KEY_CHECKS=0');
      if (TRUNCATE) {
        for (const { table } of selected) {
          try {
            await dst.query(`DELETE FROM \`${table}\``);
          } catch (e) {
            console.warn(`  ! gagal kosongkan ${table}: ${e.message}`);
          }
        }
      }
    }

    for (const { model, table } of selected) {
      let meta;
      try {
        meta = await columnsOf(src, table);
      } catch {
        console.warn(`- ${table}: dilewati (tidak ada di sumber).`);
        continue;
      }
      const cols = meta.map((m) => m.field);
      const jsonFields = new Set(meta.filter((m) => m.type.startsWith('json')).map((m) => m.field));
      let rows = [];
      try {
        const [r] = await src.query(`SELECT * FROM \`${table}\``);
        rows = r;
      } catch (e) {
        console.warn(`- ${table}: gagal baca (${e.message}).`);
        continue;
      }

      if (!KEEP_HASH && table === 'users' && cols.includes('password_hash')) {
        for (const row of rows) row.password_hash = newHash;
      }

      totalRows += rows.length;
      if (!APPLY) {
        console.log(`- ${table.padEnd(28)} ${String(rows.length).padStart(6)} baris (${model})`);
        continue;
      }

      try {
        let written = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
          written += await insertBatch(dst, table, cols, jsonFields, rows.slice(i, i + BATCH));
        }
        console.log(`- ${table.padEnd(28)} ${String(written).padStart(6)} baris ditulis`);
      } catch (e) {
        failures.push(table);
        console.warn(`- ${table.padEnd(28)} GAGAL tulis: ${e.message}`);
      }
    }

    if (APPLY) await dst.query('SET FOREIGN_KEY_CHECKS=1');
  } finally {
    await src.end();
    await dst.end();
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} selesai: ${totalRows} baris dalam ${secs}s.`);
  if (failures.length) console.warn(`Gagal di ${failures.length} tabel: ${failures.join(', ')}`);
  if (!APPLY) console.log('Jalankan ulang dengan --truncate --apply untuk menulis ke staging.');
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
