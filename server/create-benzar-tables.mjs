import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  // Test simplified DDL
  const ddl = `CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    price INT NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    images JSON NULL,
    category VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_by_id VARCHAR(64) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX products_category_active_idx (category, is_active)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
  
  await p.$executeRawUnsafe(ddl);
  console.log('products table created OK');

  const ddl2 = `CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) NOT NULL,
    order_code VARCHAR(20) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    items JSON NOT NULL,
    total INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    shipping VARCHAR(16) NOT NULL DEFAULT 'PICKUP',
    shipping_addr JSON NULL,
    notes TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE INDEX orders_order_code_key (order_code),
    INDEX orders_user_id_status_idx (user_id, status),
    INDEX orders_status_idx (status)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
  
  await p.$executeRawUnsafe(ddl2);
  console.log('orders table created OK');

  const ddl3 = `CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) NOT NULL,
    order_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    qty INT NOT NULL,
    price INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE INDEX order_items_order_id_product_id_key (order_id, product_id)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
  
  await p.$executeRawUnsafe(ddl3);
  console.log('order_items table created OK');

  // Add FKs
  try {
    await p.$executeRawUnsafe('ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE');
    console.log('FK order_items→orders OK');
  } catch(e) { console.log('FK o-i→orders skip:', e.message.substring(0,60)); }

  try {
    await p.$executeRawUnsafe('ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE');
    console.log('FK order_items→products OK');
  } catch(e) { console.log('FK o-i→products skip:', e.message.substring(0,60)); }

} catch(e) { console.error('ERROR:', e.message); }
finally { await p.$disconnect(); }
