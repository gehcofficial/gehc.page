/**
 * Copy missing tables/columns from staging TiDB onto production.
 * Never DROP. Usage:
 *   node scripts/sync-schema-from-staging.mjs           # dry-run
 *   node scripts/sync-schema-from-staging.mjs --apply
 */
import fs from 'node:fs';
import mysql from 'mysql2/promise';

function loadEnvFile(p) {
  const out = {};
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i)] = v;
  }
  return out;
}

function connect(url) {
  const u = new URL(url);
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
    multipleStatements: true,
  });
}

function stripForeignKeys(createSql) {
  let sql = createSql.replace(/^CREATE TABLE `/i, 'CREATE TABLE IF NOT EXISTS `');
  sql = sql.replace(
    /,\s*CONSTRAINT\s+`[^`]+`\s+FOREIGN KEY\s*\([^)]+\)\s+REFERENCES\s+`[^`]+`\s*\([^)]+\)(?:\s+ON DELETE [\w\s]+)?(?:\s+ON UPDATE \w+)?/gi,
    '',
  );
  sql = sql.replace(/,\s*KEY `[^`]+_fkey` \([^)]+\)(?:\s+NULL)?(?:\s+ON UPDATE \w+)?(?:\s+ON DELETE [\w\s]+)?/gi, '');
  sql = sql.replace(/\s+ON DELETE (?:SET NULL|CASCADE|RESTRICT|NO ACTION)/gi, '');
  sql = sql.replace(/\s+ON UPDATE (?:SET NULL|CASCADE|RESTRICT|NO ACTION)/gi, '');
  sql = sql.replace(/\/\*T!\[[^*]+\*\//g, '');
  return sql;
}

function sqlLiteral(value) {
  if (value === null) return 'NULL';
  const v = String(value);
  if (/^current_timestamp/i.test(v)) return 'CURRENT_TIMESTAMP';
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  return `'${v.replace(/'/g, "''")}'`;
}

function columnDdl(col) {
  let ddl = `\`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE}`;
  if (col.CHARACTER_SET_NAME && /char|text|enum|set/i.test(col.COLUMN_TYPE)) {
    ddl += ` CHARACTER SET ${col.CHARACTER_SET_NAME}`;
    if (col.COLLATION_NAME) ddl += ` COLLATE ${col.COLLATION_NAME}`;
  }
  ddl += col.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';
  if (col.COLUMN_DEFAULT !== null && col.EXTRA !== 'DEFAULT_GENERATED') {
    const def = col.COLUMN_DEFAULT;
    if (col.DATA_TYPE === 'bit') ddl += ` DEFAULT ${def}`;
    else ddl += ` DEFAULT ${sqlLiteral(def)}`;
  }
  if (col.EXTRA && col.EXTRA.includes('auto_increment')) ddl += ' AUTO_INCREMENT';
  if (col.EXTRA && /on update current_timestamp/i.test(col.EXTRA)) ddl += ' ON UPDATE CURRENT_TIMESTAMP';
  return ddl;
}

const apply = process.argv.includes('--apply');
const stagingEnv = loadEnvFile('.env.staging');
const prodEnv = loadEnvFile('.env.production');
const stagingUrl = stagingEnv.DATABASE_URL_STAGING || stagingEnv.DATABASE_URL;
const prodUrl = prodEnv.DATABASE_URL_PRODUCTION || prodEnv.DATABASE_URL;

const src = await connect(stagingUrl);
const dst = await connect(prodUrl);
const srcHost = new URL(stagingUrl);
const dstHost = new URL(prodUrl);
console.log('SRC', srcHost.hostname, srcHost.pathname.split('?')[0], decodeURIComponent(srcHost.username).split('.')[0].slice(0, 8));
console.log('DST', dstHost.hostname, dstHost.pathname.split('?')[0], decodeURIComponent(dstHost.username).split('.')[0].slice(0, 8));
if (decodeURIComponent(srcHost.username) === decodeURIComponent(dstHost.username)) {
  throw new Error('Refusing: staging and prod URLs look identical');
}

const colSql = `
  SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
         EXTRA, CHARACTER_SET_NAME, COLLATION_NAME, ORDINAL_POSITION
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
   ORDER BY TABLE_NAME, ORDINAL_POSITION`;

const [srcCols] = await src.query(colSql);
const [dstCols] = await dst.query(colSql);

const srcByTable = new Map();
const dstByTable = new Map();
for (const c of srcCols) {
  if (!srcByTable.has(c.TABLE_NAME)) srcByTable.set(c.TABLE_NAME, []);
  srcByTable.get(c.TABLE_NAME).push(c);
}
for (const c of dstCols) {
  if (!dstByTable.has(c.TABLE_NAME)) dstByTable.set(c.TABLE_NAME, []);
  dstByTable.get(c.TABLE_NAME).push(c);
}

const missingTables = [...srcByTable.keys()].filter((t) => !dstByTable.has(t)).sort();
const extraTables = [...dstByTable.keys()].filter((t) => !srcByTable.has(t)).sort();
console.log('\nMissing tables on prod:', missingTables.length ? missingTables.join(', ') : '(none)');
console.log('Extra tables on prod (kept):', extraTables.length ? extraTables.join(', ') : '(none)');

const missingCols = [];
for (const [table, cols] of srcByTable) {
  if (!dstByTable.has(table)) continue;
  const have = new Set(dstByTable.get(table).map((c) => c.COLUMN_NAME));
  for (const col of cols) {
    if (!have.has(col.COLUMN_NAME)) missingCols.push(col);
  }
}
console.log('Missing columns on prod:', missingCols.length);
for (const c of missingCols) console.log(`  ${c.TABLE_NAME}.${c.COLUMN_NAME} ${c.COLUMN_TYPE}`);
const [srcIdx] = await src.query(`
  SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND INDEX_NAME != 'PRIMARY'
   GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
`);
const [dstIdx] = await dst.query(`
  SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND INDEX_NAME != 'PRIMARY'
   GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
`);
const dstIdxSet = new Set(dstIdx.map((i) => `${i.TABLE_NAME}.${i.INDEX_NAME}`));
const missingIdx = srcIdx.filter((i) => dstByTable.has(i.TABLE_NAME) && !dstIdxSet.has(`${i.TABLE_NAME}.${i.INDEX_NAME}`));
console.log('Missing indexes on prod:', missingIdx.length);
for (const i of missingIdx) console.log(`  ${i.TABLE_NAME}.${i.INDEX_NAME} (${i.cols}) unique=${i.NON_UNIQUE === 0}`);

if (!apply) {
  console.log('\nDry-run. Re-run with --apply to write.');
  await src.end();
  await dst.end();
  process.exit(0);
}

for (const table of missingTables) {
  const [rows] = await src.query(`SHOW CREATE TABLE \`${table}\``);
  const raw = rows[0]['Create Table'];
  const sql = stripForeignKeys(raw);
  try {
    await dst.query(sql);
    console.log('created', table);
  } catch (e) {
    console.error('FAIL create', table, e.code, e.message);
    throw e;
  }
}

for (const col of missingCols) {
  const ddl = `ALTER TABLE \`${col.TABLE_NAME}\` ADD COLUMN ${columnDdl(col)}`;
  try {
    await dst.query(ddl);
    console.log('added', `${col.TABLE_NAME}.${col.COLUMN_NAME}`);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('skip exists', `${col.TABLE_NAME}.${col.COLUMN_NAME}`);
      continue;
    }
    console.error('FAIL alter', `${col.TABLE_NAME}.${col.COLUMN_NAME}`, e.code, e.message);
    throw e;
  }
}

for (const i of missingIdx) {
  if (/_fkey$/.test(i.INDEX_NAME)) continue;
  const kind = i.NON_UNIQUE === 0 ? 'UNIQUE KEY' : 'KEY';
  const cols = String(i.cols)
    .split(',')
    .map((c) => `\`${c.trim()}\``)
    .join(',');
  const ddl = `ALTER TABLE \`${i.TABLE_NAME}\` ADD ${kind} \`${i.INDEX_NAME}\` (${cols})`;
  try {
    await dst.query(ddl);
    console.log('index', `${i.TABLE_NAME}.${i.INDEX_NAME}`);
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_DUP_INDEX') {
      console.log('skip index', `${i.TABLE_NAME}.${i.INDEX_NAME}`);
      continue;
    }
    console.error('FAIL index', `${i.TABLE_NAME}.${i.INDEX_NAME}`, e.code, e.message);
    throw e;
  }
}

console.log('\n✓ prod schema catch-up complete (no drops)');
await src.end();
await dst.end();
