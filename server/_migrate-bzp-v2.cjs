/**
 * Idempotent: Benzarpreneurship v2 — perluasan Product/Order + tabel baru
 * (riwayat harga, promo, campaign donasi, pengaturan BZP, jadwal penjualan).
 *
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

  async function hasIndex(table, name) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }

  async function hasTable(table) {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }

  async function addColumn(table, name, ddl) {
    if (await hasColumn(table, name)) {
      console.log(`${table}.${name} sudah ada`);
      return;
    }
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    console.log(`${table}.${name} ditambahkan`);
  }

  async function addIndex(table, name, cols) {
    if (await hasIndex(table, name)) {
      console.log(`index ${table}.${name} sudah ada`);
      return;
    }
    await conn.query(`ALTER TABLE ${table} ADD INDEX ${name} (${cols})`);
    console.log(`index ${table}.${name} ditambahkan`);
  }

  // ---------- products ----------
  await addColumn('products', 'sub_category', 'VARCHAR(40) NULL');
  await addColumn('products', 'fundraising_type', 'VARCHAR(16) NULL');
  await addColumn('products', 'is_on_sale', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn('products', 'is_preorder', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('products', 'fulfillment_options', 'JSON NULL');
  await addColumn('products', 'cogs', 'INT NULL');
  await addColumn('products', 'operating_cost', 'INT NULL');
  await addColumn('products', 'yield_qty', 'INT NULL');
  await addColumn('products', 'event_id', 'VARCHAR(64) NULL');
  await addIndex('products', 'products_is_active_is_on_sale_idx', 'is_active, is_on_sale');
  await addIndex('products', 'products_sub_category_idx', 'sub_category');

  // ---------- orders ----------
  {
    const [rows] = await conn.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'user_id'`,
    );
    if (rows.length && rows[0].IS_NULLABLE === 'NO') {
      await conn.query('ALTER TABLE orders MODIFY COLUMN user_id VARCHAR(64) NULL');
      console.log('orders.user_id dibuat nullable');
    } else {
      console.log('orders.user_id sudah nullable');
    }
  }
  await addColumn('orders', 'guest_name', 'VARCHAR(120) NULL');
  await addColumn('orders', 'guest_phone', 'VARCHAR(32) NULL');
  await addColumn('orders', 'guest_email', 'VARCHAR(160) NULL');
  await addColumn('orders', 'subtotal', 'INT NOT NULL DEFAULT 0');
  await addColumn('orders', 'discount_total', 'INT NOT NULL DEFAULT 0');
  await addColumn('orders', 'delivery_fee', 'INT NOT NULL DEFAULT 0');
  await addColumn('orders', 'promo_code', 'VARCHAR(32) NULL');
  await addColumn('orders', 'fulfillment', 'VARCHAR(16) NULL');
  await addColumn('orders', 'cancel_reason', 'TEXT NULL');
  await addColumn('orders', 'timeline', 'JSON NULL');
  await addColumn('orders', 'event_id', 'VARCHAR(64) NULL');
  await addIndex('orders', 'orders_guest_phone_idx', 'guest_phone');

  // ---------- product_price_history ----------
  if (!(await hasTable('product_price_history'))) {
    await conn.query(`
      CREATE TABLE product_price_history (
        id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        price INT NOT NULL,
        buy_price INT NULL,
        note TEXT NULL,
        changed_by_id VARCHAR(64) NULL,
        changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX product_price_history_product_id_changed_at_idx (product_id, changed_at),
        CONSTRAINT product_price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel product_price_history dibuat');
  } else {
    console.log('tabel product_price_history sudah ada');
  }

  // ---------- promos ----------
  if (!(await hasTable('promos'))) {
    await conn.query(`
      CREATE TABLE promos (
        id VARCHAR(64) NOT NULL,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(120) NOT NULL,
        type VARCHAR(16) NOT NULL,
        value INT NOT NULL,
        audience VARCHAR(16) NOT NULL DEFAULT 'ALL',
        min_spend INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        starts_at DATETIME(3) NULL,
        ends_at DATETIME(3) NULL,
        event_id VARCHAR(64) NULL,
        created_by_id VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX promos_code_key (code),
        INDEX promos_is_active_idx (is_active)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel promos dibuat');
  } else {
    console.log('tabel promos sudah ada');
  }

  // ---------- campaigns ----------
  if (!(await hasTable('campaigns'))) {
    await conn.query(`
      CREATE TABLE campaigns (
        id VARCHAR(64) NOT NULL,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(80) NOT NULL,
        description TEXT NULL,
        image_file_id VARCHAR(128) NULL,
        target INT NOT NULL DEFAULT 0,
        event_id VARCHAR(64) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        starts_at DATETIME(3) NULL,
        ends_at DATETIME(3) NULL,
        created_by_id VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX campaigns_slug_key (slug),
        INDEX campaigns_is_active_idx (is_active)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel campaigns dibuat');
  } else {
    console.log('tabel campaigns sudah ada');
  }

  // ---------- campaign_donations ----------
  if (!(await hasTable('campaign_donations'))) {
    await conn.query(`
      CREATE TABLE campaign_donations (
        id VARCHAR(64) NOT NULL,
        campaign_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NULL,
        donor_name VARCHAR(120) NOT NULL,
        donor_phone VARCHAR(32) NULL,
        is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
        amount INT NOT NULL,
        message TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        proof_drive_file_id VARCHAR(128) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX campaign_donations_campaign_id_status_idx (campaign_id, status),
        CONSTRAINT campaign_donations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel campaign_donations dibuat');
  } else {
    console.log('tabel campaign_donations sudah ada');
  }

  // ---------- bzp_settings ----------
  if (!(await hasTable('bzp_settings'))) {
    await conn.query(`
      CREATE TABLE bzp_settings (
        id VARCHAR(64) NOT NULL,
        pic_phones JSON NULL,
        delivery_fee INT NOT NULL DEFAULT 0,
        qris JSON NULL,
        wa_group_url VARCHAR(300) NULL,
        updated_by_id VARCHAR(64) NULL,
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel bzp_settings dibuat');
  } else {
    console.log('tabel bzp_settings sudah ada');
  }

  // ---------- sales_shifts ----------
  if (!(await hasTable('sales_shifts'))) {
    await conn.query(`
      CREATE TABLE sales_shifts (
        id VARCHAR(64) NOT NULL,
        event_id VARCHAR(64) NULL,
        date VARCHAR(10) NOT NULL,
        title VARCHAR(120) NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        roles JSON NULL,
        notes TEXT NULL,
        created_by_id VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX sales_shifts_date_idx (date)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel sales_shifts dibuat');
  } else {
    console.log('tabel sales_shifts sudah ada');
  }

  // ---------- sales_shift_assignments ----------
  if (!(await hasTable('sales_shift_assignments'))) {
    await conn.query(`
      CREATE TABLE sales_shift_assignments (
        id VARCHAR(64) NOT NULL,
        shift_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NULL,
        name VARCHAR(120) NOT NULL,
        role VARCHAR(60) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'INVITED',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX sales_shift_assignments_shift_id_idx (shift_id),
        CONSTRAINT sales_shift_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES sales_shifts(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('tabel sales_shift_assignments dibuat');
  } else {
    console.log('tabel sales_shift_assignments sudah ada');
  }

  await conn.end();
  console.log('Migrasi BZP v2 selesai.');
})().catch((e) => {
  console.error('Migrasi BZP v2 gagal:', e.message);
  process.exit(1);
});
