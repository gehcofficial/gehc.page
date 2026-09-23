/**
 * Seed produk BZP (draf) — idempoten, aman diulang.
 *
 * Produk dibuat NONAKTIF (belum tampil) dengan harga 0 agar tidak salah harga;
 * Bapak/Ibu mengisi harga/gambar di panel lalu mengaktifkan.
 *
 *   node server/seed-bzp-products.mjs                 # dry-run (staging)
 *   node server/seed-bzp-products.mjs --apply
 *   $env:GEHC_ENV='production'; node server/seed-bzp-products.mjs
 *   $env:GEHC_ENV='production'; node server/seed-bzp-products.mjs --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from './db.mjs';

const APPLY = process.argv.includes('--apply');

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

const DEWASA = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const ANAK = ['No.2', 'No.4', 'No.6', 'No.8', 'No.10'];

function cartesian(opts) {
  let out = [{}];
  for (const o of opts) {
    const next = [];
    for (const acc of out) for (const v of o.values) next.push({ ...acc, [o.name]: v });
    out = next;
  }
  return out;
}

/** Definisi produk (urutan tampil = sortOrder). Semua DRAF. */
const PRODUCTS = [
  {
    id: 'prod-kaos-ebenhaezer',
    name: 'Kaos Eben Haezer',
    description: 'Kaos GEHC Youth — "Thus far the Lord has helped us" (1 Samuel 7:12). Tersedia warna Putih & Ungu.',
    category: 'MERCHANDISE',
    subcategorySlug: 'clothing',
    options: [
      { name: 'Warna', values: ['Putih', 'Ungu'] },
      { name: 'Ukuran', values: [...DEWASA, ...ANAK] },
    ],
    sortOrder: 1,
  },
  {
    id: 'prod-ricebowl-ayam-ricarica',
    name: 'Rice Bowl (Ayam Rica-rica)',
    description: 'Rice bowl ayam rica-rica.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'food',
    sortOrder: 10,
  },
  {
    id: 'prod-ricebowl-ayam-suir',
    name: 'Rice Bowl (Ayam Suir)',
    description: 'Rice bowl ayam suir.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'food',
    sortOrder: 11,
  },
  {
    id: 'prod-sate-babi',
    name: 'Sate Babi',
    description: 'Sate babi.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'food',
    sortOrder: 12,
  },
  {
    id: 'prod-babi-utang',
    name: 'Babi Utang',
    description: 'Babi utang.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'food',
    sortOrder: 13,
  },
  {
    id: 'prod-es-buah',
    name: 'Es Buah',
    description: 'Es buah segar.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'beverage',
    options: [{ name: 'Isi', values: ['Es Campur', 'Es Campur pakai Sirup'] }],
    sortOrder: 20,
  },
  {
    id: 'prod-air-mineral',
    name: 'Air Mineral',
    description: 'Air mineral kemasan.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'beverage',
    options: [{ name: 'Ukuran', values: ['330 ml', '600 ml', '1.500 ml'] }],
    sortOrder: 21,
  },
  {
    id: 'prod-puding-sedot',
    name: 'Puding Sedot',
    description: 'Puding sedot aneka rasa.',
    category: 'FUNDRAISING',
    fundraisingType: 'PRODUCT',
    subcategorySlug: 'dessert',
    options: [{ name: 'Rasa', values: ['Coklat', 'Matcha', 'Strawberi', 'Buah'] }],
    sortOrder: 30,
  },
];

const DEACTIVATE = ['Kaos Benzar', 'tes'];

console.log(`Target DB: ${getDbLabel()} · mode: ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN'}`);

// Pemilik pembuatan produk (SUPERADMIN bila ada).
async function pickCreatorId() {
  try {
    const admin = await prisma.user.findFirst({
      where: { roles: { some: { role: 'SUPERADMIN' } } },
      select: { id: true },
    });
    if (admin?.id) return admin.id;
  } catch { /* lanjut */ }
  const any = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }).catch(() => null);
  return any?.id || 'u-tech-001';
}

const subcats = await prisma.bzpSubcategory.findMany({ select: { id: true, slug: true, nameId: true } }).catch(() => []);
const subBySlug = new Map(subcats.map((s) => [s.slug, s]));
const creatorId = await pickCreatorId();

console.log(`\nSub-kategori terpakai: ${[...new Set(PRODUCTS.map((p) => p.subcategorySlug))].join(', ')}`);

for (const p of PRODUCTS) {
  const sub = subBySlug.get(p.subcategorySlug);
  if (!sub) console.log(`  ! sub-kategori '${p.subcategorySlug}' tidak ada untuk ${p.name}`);
  const variants = p.options ? cartesian(p.options) : [];
  console.log(`  ${APPLY ? '•' : '·'} ${p.name} — ${p.category}${p.fundraisingType ? '/' + p.fundraisingType : ''} · sub ${sub ? sub.nameId : '-'} · ${variants.length} varian · DRAF (harga 0)`);
}

if (!APPLY) {
  console.log(`\n(dry-run) Nonaktifkan: ${DEACTIVATE.join(', ')}`);
  console.log('Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

let created = 0;
let updated = 0;

for (const p of PRODUCTS) {
  const sub = subBySlug.get(p.subcategorySlug) || null;
  const base = {
    name: p.name,
    description: p.description || null,
    price: 0,
    buyPrice: null,
    stock: 0,
    images: [],
    category: p.category,
    subCategory: sub?.nameId || null,
    subcategoryId: sub?.id || null,
    fundraisingType: p.fundraisingType || null,
    hasVariants: Boolean(p.options?.length),
    isActive: false, // DRAF
    isOnSale: true,
    sortOrder: p.sortOrder || 0,
  };
  const existing = await prisma.product.findUnique({ where: { id: p.id } });
  if (existing) {
    await prisma.product.update({ where: { id: p.id }, data: base });
    updated += 1;
  } else {
    await prisma.product.create({ data: { id: p.id, ...base, createdById: creatorId } });
    created += 1;
  }

  if (p.options?.length) {
    await prisma.productOption.deleteMany({ where: { productId: p.id } });
    let pos = 0;
    for (const o of p.options) {
      await prisma.productOption.create({
        data: { id: `opt-${p.id}-${pos}`, productId: p.id, name: o.name, values: o.values, position: pos },
      });
      pos += 1;
    }
    await prisma.productVariant.deleteMany({ where: { productId: p.id } });
    let vpos = 0;
    for (const combo of cartesian(p.options)) {
      const label = Object.values(combo).join('-').replace(/\s+/g, '').toLowerCase();
      await prisma.productVariant.create({
        data: {
          id: `var-${p.id}-${label}`.slice(0, 64),
          productId: p.id,
          sku: null,
          options: combo,
          price: null,
          buyPrice: null,
          stock: 0,
          isActive: true,
          position: vpos,
        },
      });
      vpos += 1;
    }
  }
}

let deactivated = 0;
for (const name of DEACTIVATE) {
  const rows = await prisma.product.findMany({ where: { name } });
  for (const r of rows) {
    if (r.isActive) {
      await prisma.product.update({ where: { id: r.id }, data: { isActive: false } });
      deactivated += 1;
    }
  }
}

console.log(`\nSelesai. Produk dibuat: ${created}, diperbarui: ${updated}. Dinonaktifkan: ${deactivated}.`);

// Verifikasi ringkas
const ids = PRODUCTS.map((p) => p.id);
const check = await prisma.product.findMany({
  where: { id: { in: ids } },
  select: { id: true, name: true, isActive: true, hasVariants: true, _count: { select: { variants: true } } },
  orderBy: { sortOrder: 'asc' },
});
console.log('\nVerifikasi:');
for (const c of check) console.log(`  ${c.name} · draf=${!c.isActive} · varian=${c._count.variants}`);
const totalVarian = check.reduce((n, c) => n + c._count.variants, 0);
console.log(`  total varian: ${totalVarian}`);

await prisma.$disconnect();
