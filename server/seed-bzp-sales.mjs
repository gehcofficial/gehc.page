/**
 * Seed BZP: role Jadwal Jual (10) + promo jemaat (JEMAAT25).
 * Idempoten — aman diulang, tidak menyentuh data produk.
 *
 *   node server/seed-bzp-sales.mjs
 *   $env:GEHC_ENV='production'; node server/seed-bzp-sales.mjs
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from './db.mjs';

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

const ROLES = [
  'Koordinator Penjualan',
  'Kasir',
  'Pramuniaga (Penjual)',
  'PIC Produk & Stok',
  'Operator Pembayaran (QRIS)',
  'Promosi & Konten',
  'Dokumentasi',
  'Perlengkapan & Logistik',
  'Runner / Antar Pesanan',
  'Kebersihan & Penutupan',
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

console.log(`Target DB: ${getDbLabel()}`);

let created = 0;
let updated = 0;
let pos = 0;
for (const name of ROLES) {
  const existing = await prisma.bzpSalesRole.findUnique({ where: { name } });
  const data = { sortOrder: pos, isActive: true };
  if (existing) {
    await prisma.bzpSalesRole.update({ where: { id: existing.id }, data });
    updated += 1;
  } else {
    await prisma.bzpSalesRole.create({ data: { id: `srole-${slug(name)}`, name, description: null, ...data } });
    created += 1;
  }
  pos += 1;
}
console.log(`Role jadwal jual: dibuat ${created}, diperbarui ${updated} (total ${ROLES.length}).`);

// Promo jemaat: potongan Rp25.000 untuk Kaos Eben Haezer (kode + otomatis).
const KAOS_ID = 'prod-kaos-ebenhaezer';
const promoData = {
  name: 'Potongan Jemaat — Kaos Eben Haezer',
  type: 'AMOUNT',
  value: 25000,
  audience: 'MEMBER',
  scope: 'PRODUCT',
  targetIds: [KAOS_ID],
  autoApply: true,
  maxDiscount: null,
  minSpend: 0,
  isActive: true,
};
const existingPromo = await prisma.promo.findUnique({ where: { code: 'JEMAAT25' } });
if (existingPromo) {
  await prisma.promo.update({ where: { id: existingPromo.id }, data: promoData });
  console.log('Promo JEMAAT25 diperbarui.');
} else {
  await prisma.promo.create({
    data: { id: 'promo-jemaat25', code: 'JEMAAT25', createdById: 'system-seed', ...promoData },
  });
  console.log('Promo JEMAAT25 dibuat.');
}

const roles = await prisma.bzpSalesRole.count();
const promoOk = await prisma.promo.findUnique({ where: { code: 'JEMAAT25' } });
console.log(`Verifikasi → role: ${roles} · promo JEMAAT25: ${promoOk ? 'ada' : 'tidak ada'}`);
await prisma.$disconnect();
