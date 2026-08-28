import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole, attachUser } from '../server/auth.mjs';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[benzar] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

const VALID_CATEGORIES = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];
const VALID_ORDER_STATUSES = ['PENDING', 'PAID', 'VERIFIED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
const VALID_SHIPPING = ['PICKUP', 'DELIVERY'];

// ---------- Products ----------
app.get('/api/benzar/products', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { category, active } = req.query;
  const where = {};
  if (category) where.category = category;
  if (active !== undefined) where.isActive = active === 'true';

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ products });
}));

app.get('/api/benzar/products/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  res.json({ product });
}));

app.post('/api/benzar/products', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BENZARPR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { name, description, price, stock, images, category, isActive, sortOrder } = req.body || {};
  if (!name || !price || !category) return res.status(400).json({ error: 'name, price, category wajib diisi.' });
  if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'category tidak valid.' });

  const product = await prisma.product.create({
    data: {
      id: `prod-${crypto.randomUUID()}`,
      name,
      description: description ?? null,
      price: Number(price),
      stock: Number(stock) ?? 0,
      images: images ?? null,
      category,
      isActive: isActive !== false,
      sortOrder: Number(sortOrder) ?? 0,
      createdById: req.authUser.id,
    },
  });
  res.json({ ok: true, product });
}));

app.patch('/api/benzar/products/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BENZARPR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { name, description, price, stock, images, category, isActive, sortOrder } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = Number(price);
  if (stock !== undefined) data.stock = Number(stock);
  if (images !== undefined) data.images = images;
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'category tidak valid.' });
    data.category = category;
  }
  if (isActive !== undefined) data.isActive = isActive;
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, product });
}));

app.delete('/api/benzar/products/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Orders ----------
app.get('/api/benzar/orders', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { status, userId } = req.query;
  const where = { userId: req.authUser.id };
  if (status) where.status = status;
  if (userId && req.authUser.roles?.some(r => ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BENZARPR'].includes(r.role))) {
    where.userId = userId;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: true } } },
  });
  res.json({ orders });
}));

app.get('/api/benzar/orders/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
  if (order.userId !== req.authUser.id && !req.authUser.roles?.some(r => ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BENZARPR'].includes(r.role))) {
    return res.status(403).json({ error: 'Tidak punya akses ke order ini.' });
  }
  res.json({ order });
}));

app.post('/api/benzar/orders', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { items, shipping, shippingAddr, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items wajib diisi.' });
  if (!VALID_SHIPPING.includes(shipping)) return res.status(400).json({ error: 'shipping tidak valid.' });

  let total = 0;
  const orderItems = [];
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) return res.status(404).json({ error: `Produk ${item.productId} tidak ditemukan.` });
    if (!product.isActive) return res.status(400).json({ error: `Produk ${product.name} tidak aktif.` });
    if (product.stock < item.qty) return res.status(400).json({ error: `Stok ${product.name} tidak cukup.` });

    total += product.price * item.qty;
    orderItems.push({
      productId: product.id,
      qty: item.qty,
      price: product.price,
      name: product.name,
    });
  }

  const orderCode = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      id: `ord-${crypto.randomUUID()}`,
      orderCode,
      userId: req.authUser.id,
      items: { create: orderItems },
      total,
      status: 'PENDING',
      shipping,
      shippingAddr: shippingAddr ?? null,
      notes: notes ?? null,
    },
    include: { items: true },
  });

  for (const item of orderItems) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.qty } },
    });
  }

  // Notify admin
  try {
    const { notifyOrderUpdate } = await import('../server/push.mjs');
    await notifyOrderUpdate(order.id, 'PENDING');
  } catch { /* ignore */ }

  res.json({ ok: true, order });
}));

app.patch('/api/benzar/orders/:id/status', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BENZARPR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { status } = req.body || {};
  if (!VALID_ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'status tidak valid.' });

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status },
    include: { items: true, user: true },
  });

  try {
    const { notifyOrderUpdate } = await import('../server/push.mjs');
    await notifyOrderUpdate(order.id, status);
  } catch { /* ignore */ }

  res.json({ ok: true, order });
}));

// ---------- QRIS ----------
app.get('/api/benzar/qris', wrap(async (req, res) => {
  res.json({
    qrisImageUrl: '/Gopay QRIS.png',
    merchantName: 'GEHC Youth',
    merchantCity: 'Cikarang',
  });
}));

export default app;