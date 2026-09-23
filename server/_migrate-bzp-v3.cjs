/**
 * Idempotent: Benzarpreneurship v3 — sub-kategori terkelola + varian produk.
 * Aman dijalankan berulang: hanya menambah kolom/tabel yang belum ada.
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
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
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
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
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

  // ---------- products ----------
  await addColumn('products', 'subcategory_id', 'VARCHAR(64) NULL');
  await addColumn('products', 'has_variants', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addIndex('products', 'products_subcategory_id_idx', 'subcategory_id');

  // ---------- order_items ----------
  await addColumn('order_items', 'variant_id', 'VARCHAR(64) NULL');
  await addColumn('order_items', 'variant_label', 'VARCHAR(120) NULL');
  // Index pendukung FK (order_id & product_id) harus ada SEBELUM unique dihapus,
  // karena MySQL memakai index unique komposit itu untuk menopang kedua FK.
  await addIndex('order_items', 'order_items_order_id_idx', 'order_id');
  await addIndex('order_items', 'order_items_product_id_idx', 'product_id');
  if (await hasIndex('order_items', 'order_items_order_id_product_id_key')) {
    await conn.query('ALTER TABLE order_items DROP INDEX order_items_order_id_product_id_key');
    console.log('unique order_items(order_id, product_id) dihapus (mendukung multi-varian)');
  } else {
    console.log('unique order_items(order_id, product_id) tidak ada');
  }

  // ---------- bzp_subcategories ----------
  if (!(await hasTable('bzp_subcategories'))) {
    await conn.query(`
      CREATE TABLE bzp_subcategories (
        id VARCHAR(64) NOT NULL,
        name_id VARCHAR(60) NOT NULL,
        name_en VARCHAR(60) NOT NULL,
        slug VARCHAR(60) NOT NULL,
        \`group\` VARCHAR(40) NULL,
        has_size TINYINT(1) NOT NULL DEFAULT 0,
        size_chart JSON NULL,
        option_names JSON NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX bzp_subcategories_slug_key (slug),
        INDEX bzp_subcategories_is_active_idx (is_active)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel bzp_subcategories dibuat');
  } else {
    console.log('tabel bzp_subcategories sudah ada');
  }

  // ---------- product_options ----------
  if (!(await hasTable('product_options'))) {
    await conn.query(`
      CREATE TABLE product_options (
        id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        name VARCHAR(40) NOT NULL,
        \`values\` JSON NOT NULL,
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX product_options_product_id_idx (product_id),
        CONSTRAINT product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel product_options dibuat');
  } else {
    console.log('tabel product_options sudah ada');
  }

  // ---------- product_variants ----------
  if (!(await hasTable('product_variants'))) {
    await conn.query(`
      CREATE TABLE product_variants (
        id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        sku VARCHAR(60) NULL,
        options JSON NOT NULL,
        price INT NULL,
        buy_price INT NULL,
        stock INT NOT NULL DEFAULT 0,
        image_file_id VARCHAR(128) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX product_variants_product_id_idx (product_id),
        CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel product_variants dibuat');
  } else {
    console.log('tabel product_variants sudah ada');
  }

  await conn.end();
  console.log('Migrasi BZP v3 selesai.');
})().catch((e) => {
  console.error('Migrasi BZP v3 gagal:', e.message);
  process.exit(1);
});
