/**
 * Seed katalog BZP: sub-kategori terkelola (bilingual) + size chart Clothing.
 * Idempoten (upsert by slug). Opsi --demo menambah contoh produk varian (staging).
 *
 *   node server/seed-bzp-catalog.mjs
 *   node server/seed-bzp-catalog.mjs --demo
 *   $env:GEHC_ENV='production'; node server/seed-bzp-catalog.mjs
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from './db.mjs';

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

const SIZE_CHART_CLOTHING = {
  columns: ['SIZE', 'PANJANG (cm)', 'LEBAR (cm)', 'GRUP'],
  rows: [
    ['XS', '62', '45', 'Dewasa'],
    ['S', '68', '47', 'Dewasa'],
    ['M', '70', '49', 'Dewasa'],
    ['L', '72', '51', 'Dewasa'],
    ['XL', '74', '53', 'Dewasa'],
    ['2XL', '76', '55', 'Dewasa'],
    ['3XL', '78', '57', 'Dewasa'],
    ['4XL', '80', '60', 'Dewasa'],
    ['5XL', '80', '62', 'Dewasa'],
    ['No.2', '41', '29', 'Anak'],
    ['No.4', '44', '33', 'Anak'],
    ['No.6', '48', '35', 'Anak'],
    ['No.8', '51', '38', 'Anak'],
    ['No.10', '55', '40', 'Anak'],
  ],
  notes: [
    'Semua ukuran dalam sentimeter (cm).',
    'Lebar = jarak antar ketiak/bahu. Panjang = dari bahu sampai bagian paling bawah.',
    'Ukuran diukur sebelum susut (shrinkage).',
    'Toleransi ukuran 0,5–2 cm.',
    'Cotton 24s: ±175–185 gsm · Cotton 30s: ±140–150 gsm.',
  ],
};

const SUBCATEGORIES = [
  // Fashion
  { slug: 'clothing', nameId: 'Pakaian', nameEn: 'Clothing', group: 'Fashion', hasSize: true, optionNames: ['Warna', 'Ukuran'], sizeChart: SIZE_CHART_CLOTHING, sortOrder: 1 },
  { slug: 'hat', nameId: 'Topi', nameEn: 'Hat', group: 'Fashion', sortOrder: 2 },
  { slug: 'bag', nameId: 'Tas', nameEn: 'Bag', group: 'Fashion', sortOrder: 3 },
  { slug: 'shoes', nameId: 'Sepatu', nameEn: 'Shoes', group: 'Fashion', hasSize: true, sortOrder: 4 },
  { slug: 'accessories', nameId: 'Aksesori', nameEn: 'Accessories', group: 'Fashion', sortOrder: 5 },
  // Drinkware
  { slug: 'tumbler', nameId: 'Tumbler', nameEn: 'Tumbler', group: 'Drinkware', sortOrder: 10 },
  { slug: 'glass', nameId: 'Gelas', nameEn: 'Glass', group: 'Drinkware', sortOrder: 11 },
  { slug: 'mug', nameId: 'Mug', nameEn: 'Mug', group: 'Drinkware', sortOrder: 12 },
  { slug: 'bottle', nameId: 'Botol', nameEn: 'Bottle', group: 'Drinkware', sortOrder: 13 },
  // Food & Beverage
  { slug: 'food', nameId: 'Makanan', nameEn: 'Food', group: 'Food', sortOrder: 20 },
  { slug: 'dessert', nameId: 'Dessert', nameEn: 'Dessert', group: 'Food', sortOrder: 21 },
  { slug: 'beverage', nameId: 'Minuman', nameEn: 'Beverage', group: 'Food', sortOrder: 22 },
  { slug: 'snack', nameId: 'Camilan', nameEn: 'Snack', group: 'Food', sortOrder: 23 },
  // Lain
  { slug: 'stationery', nameId: 'Alat Tulis', nameEn: 'Stationery', group: 'Lain', sortOrder: 30 },
  { slug: 'craft', nameId: 'Kerajinan', nameEn: 'Craft', group: 'Lain', sortOrder: 31 },
  { slug: 'service', nameId: 'Jasa', nameEn: 'Service', group: 'Lain', sortOrder: 32 },
];

console.log(`Target DB: ${getDbLabel()}`);

let created = 0;
let updated = 0;
for (const s of SUBCATEGORIES) {
  const existing = await prisma.bzpSubcategory.findUnique({ where: { slug: s.slug } });
  const data = {
    nameId: s.nameId,
    nameEn: s.nameEn,
    group: s.group || null,
    hasSize: Boolean(s.hasSize),
    sizeChart: s.sizeChart || null,
    optionNames: s.optionNames || null,
    sortOrder: s.sortOrder || 0,
    isActive: true,
  };
  if (existing) {
    await prisma.bzpSubcategory.update({ where: { id: existing.id }, data });
    updated += 1;
  } else {
    await prisma.bzpSubcategory.create({ data: { id: `subcat-${s.slug}`, slug: s.slug, ...data } });
    created += 1;
  }
}
console.log(`Sub-kategori: dibuat ${created}, diperbarui ${updated} (total ${SUBCATEGORIES.length}).`);

if (process.argv.includes('--demo')) {
  const clothing = await prisma.bzpSubcategory.findUnique({ where: { slug: 'clothing' } });
  const id = 'prod-demo-kaos-ebenhaezer';
  const existing = await prisma.product.findUnique({ where: { id } });
  const base = {
    name: 'Kaos Eben Haezer',
    description: 'Kaos GEHC Youth — "Thus far the Lord has helped us" (1 Samuel 7:12). Bahan cotton 24s, sablon depan-belakang.',
    price: 95000,
    buyPrice: 62000,
    category: 'MERCHANDISE',
    subCategory: 'Clothing',
    subcategoryId: clothing?.id || null,
    hasVariants: true,
    isActive: true,
    isOnSale: true,
    sortOrder: 0,
    images: [],
    createdById: 'u-tech-001',
  };
  let productId = existing?.id;
  if (existing) {
    await prisma.product.update({ where: { id }, data: base });
  } else {
    await prisma.product.create({ data: { id, ...base } });
    productId = id;
  }
  await prisma.productOption.deleteMany({ where: { productId } });
  await prisma.productOption.createMany({
    data: [
      { id: 'opt-demo-warna', productId, name: 'Warna', values: ['Putih', 'Ungu'], position: 0 },
      { id: 'opt-demo-ukuran', productId, name: 'Ukuran', values: ['S', 'M', 'L', 'XL', '2XL', '3XL'], position: 1 },
    ],
  });
  await prisma.productVariant.deleteMany({ where: { productId } });
  const colors = ['Putih', 'Ungu'];
  const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
  let pos = 0;
  for (const c of colors) {
    for (const sz of sizes) {
      await prisma.productVariant.create({
        data: {
          id: `var-demo-${c.toLowerCase()}-${sz.toLowerCase()}`,
          productId,
          sku: `EH-${c.slice(0, 1).toUpperCase()}-${sz}`,
          options: { Warna: c, Ukuran: sz },
          price: ['3XL'].includes(sz) ? 105000 : 95000,
          stock: 10,
          position: pos++,
        },
      });
    }
  }
  const agg = await prisma.productVariant.aggregate({ where: { productId, isActive: true }, _sum: { stock: true } });
  await prisma.product.update({ where: { id: productId }, data: { stock: Number(agg?._sum?.stock || 0) } });
  console.log(`Demo produk varian dibuat: ${base.name} (${colors.length} warna × ${sizes.length} ukuran = ${colors.length * sizes.length} varian).`);
}

console.log('Seed katalog BZP selesai.');
await prisma.$disconnect();
