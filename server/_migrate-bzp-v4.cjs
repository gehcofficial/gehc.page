/**
 * Idempotent: Benzarpreneurship v4 — role jadwal jual + promo spesifik + PIC dari user.
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
  async function hasIndex(table, name) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }
  async function addColumn(table, name, ddl) {
    if (await hasColumn(table, name)) { console.log(`${table}.${name} sudah ada`); return; }
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    console.log(`${table}.${name} ditambahkan`);
  }
  async function addIndex(table, name, cols) {
    if (await hasIndex(table, name)) { console.log(`index ${table}.${name} sudah ada`); return; }
    await conn.query(`ALTER TABLE ${table} ADD INDEX ${name} (${cols})`);
    console.log(`index ${table}.${name} ditambahkan`);
  }

  // ---------- bzp_settings ----------
  await addColumn('bzp_settings', 'pic_user_ids', 'JSON NULL');

  // ---------- promos ----------
  await addColumn('promos', 'scope', "VARCHAR(16) NOT NULL DEFAULT 'GLOBAL'");
  await addColumn('promos', 'target_ids', 'JSON NULL');
  await addColumn('promos', 'auto_apply', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('promos', 'max_discount', 'INT NULL');

  // ---------- bzp_sales_roles ----------
  if (!(await hasTable('bzp_sales_roles'))) {
    await conn.query(`
      CREATE TABLE bzp_sales_roles (
        id VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX bzp_sales_roles_name_key (name),
        INDEX bzp_sales_roles_is_active_idx (is_active)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel bzp_sales_roles dibuat');
  } else {
    console.log('tabel bzp_sales_roles sudah ada');
  }

  // ---------- sales_shift_assignments.sales_role_id ----------
  await addColumn('sales_shift_assignments', 'sales_role_id', 'VARCHAR(64) NULL');
  await addIndex('sales_shift_assignments', 'sales_shift_assignments_sales_role_id_idx', 'sales_role_id');
  {
    const [fks] = await conn.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_shift_assignments'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'sales_shift_assignments_sales_role_id_fkey'`,
    );
    if (!fks.length) {
      await conn.query(
        `ALTER TABLE sales_shift_assignments
         ADD CONSTRAINT sales_shift_assignments_sales_role_id_fkey
         FOREIGN KEY (sales_role_id) REFERENCES bzp_sales_roles(id) ON DELETE SET NULL ON UPDATE CASCADE`,
      ).catch((e) => console.log('FK sales_role_id dilewati:', e.message));
      console.log('FK sales_shift_assignments.sales_role_id dibuat');
    } else {
      console.log('FK sales_shift_assignments.sales_role_id sudah ada');
    }
  }

  await conn.end();
  console.log('Migrasi BZP v4 selesai.');
})().catch((e) => {
  console.error('Migrasi BZP v4 gagal:', e.message);
  process.exit(1);
});
