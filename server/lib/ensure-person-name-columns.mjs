import mysql from 'mysql2/promise';

const COLS = [
  ['given_name', 'VARCHAR(80) NULL'],
  ['middle_name', 'VARCHAR(80) NULL'],
  ['family_name', 'VARCHAR(80) NULL'],
  ['church_title', 'VARCHAR(8) NULL'],
  ['academic_titles', 'JSON NULL'],
];

let once = null;

function mysqlConfig(raw) {
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

/** Satu SELECT lalu satu ALTER untuk kolom nama yang belum ada. Idempotent. */
export async function ensurePersonNameColumns(rawUrl) {
  if (!rawUrl) return { skipped: true };
  const conn = await mysql.createConnection(mysqlConfig(rawUrl));
  try {
    const names = COLS.map((c) => c[0]);
    const [found] = await conn.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'
         AND column_name IN (${names.map(() => '?').join(',')})`,
      names,
    );
    const have = new Set((found || []).map((r) => String(r.column_name || r.COLUMN_NAME)));
    const missing = COLS.filter(([name]) => !have.has(name));
    if (!missing.length) return { added: [] };
    const ddl = missing.map(([name, spec]) => `ADD COLUMN ${name} ${spec}`).join(', ');
    await conn.query(`ALTER TABLE users ${ddl}`);
    console.log('[person-name] added columns:', missing.map((c) => c[0]).join(', '));
    return { added: missing.map((c) => c[0]) };
  } finally {
    await conn.end();
  }
}

export function ensurePersonNameColumnsOnce(rawUrl) {
  if (!once) {
    once = ensurePersonNameColumns(rawUrl).catch((err) => {
      once = null;
      throw err;
    });
  }
  return once;
}
