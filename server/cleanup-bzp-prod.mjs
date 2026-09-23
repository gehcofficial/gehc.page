/**
 * Bersihkan data BZP di DB (destruktif, sekali jalan).
 *
 * Menghapus:
 *   - SEMUA pesanan BZP (cascade order_items) — status pesanan lama di prod.
 *   - Produk lama: 'tes', 'Kaos Benzar', 'Onde-Onde' (beserta varian/opsi/riwayat).
 *
 * AMAN: default DRY-RUN. Tambahkan --apply untuk menulis.
 *   node server/cleanup-bzp-prod.mjs                 # dry-run (staging)
 *   $env:GEHC_ENV='production'; node server/cleanup-bzp-prod.mjs --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from './db.mjs';

const APPLY = process.argv.includes('--apply');
const PRODUCT_NAMES = ['tes', 'Kaos Benzar', 'Onde-Onde'];

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);

const orders = await prisma.order.findMany({ select: { id: true, orderCode: true, status: true, total: true } });
const products = await prisma.product.findMany({
  where: { name: { in: PRODUCT_NAMES } },
  select: { id: true, name: true, _count: { select: { orderItems: true, variants: true, options: true, priceHistory: true } } },
});

console.log(`\nPesanan akan dihapus: ${orders.length}`);
for (const o of orders) console.log(`  - ${o.orderCode} · ${o.status} · Rp${o.total}`);
console.log(`\nProduk akan dihapus: ${products.length}`);
for (const p of products) {
  console.log(`  - ${p.name} (${p.id}) · orderItems ${p._count.orderItems} · varian ${p._count.variants} · opsi ${p._count.options} · riwayat ${p._count.priceHistory}`);
}

if (!APPLY) {
  console.log('\n(dry-run) Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

// 1) Hapus pesanan (cascade ke order_items) → membebaskan FK product.
const delOrders = await prisma.order.deleteMany({});
console.log(`\nPesanan terhapus: ${delOrders.count}`);

// 2) Hapus produk lama (cascade varian/opsi/riwayat harga).
const delProducts = await prisma.product.deleteMany({ where: { name: { in: PRODUCT_NAMES } } });
console.log(`Produk terhapus: ${delProducts.count}`);

const sisaOrders = await prisma.order.count();
const sisaProduk = await prisma.product.count();
console.log(`\nVerifikasi → pesanan tersisa: ${sisaOrders} · produk tersisa: ${sisaProduk}`);
const sisaNames = await prisma.product.findMany({ select: { name: true, isActive: true }, orderBy: { sortOrder: 'asc' } });
for (const p of sisaNames) console.log(`  - ${p.name}${p.isActive ? ' (aktif)' : ' (draf)'}`);

await prisma.$disconnect();
