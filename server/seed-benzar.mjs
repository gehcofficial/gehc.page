import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const products = [
  // MERCHANDISE
  {
    id: 'prod-tshirt-gehc-001',
    name: 'T-Shirt GEHC Youth',
    description: 'Kaos identitas GEHC Youth — warna hitam, bahan katun 30s, logo GEHC di dada kiri. Nyaman dipakai sehari-hari.',
    price: 100000,
    buyPrice: 85000,
    stock: 50,
    category: 'MERCHANDISE',
    sortOrder: 1,
    images: [{ url: 'https://placehold.co/400x400/1B1B1B/F6AE4A?text=T-Shirt%0AGEHC+Youth', caption: 'T-Shirt GEHC Youth — Black' }],
  },
  {
    id: 'prod-stiker-gehc-002',
    name: 'Stiker GEHC Youth',
    description: 'Stiker vinyl waterproof — logo Beyonders & GEHC. Tempel di laptop, botol, atau HP.',
    price: 15000,
    buyPrice: 5000,
    stock: 200,
    category: 'MERCHANDISE',
    sortOrder: 2,
    images: [{ url: 'https://placehold.co/400x400/F6AE4A/1B1B1B?text=Stiker%0AGEHC', caption: 'Stiker GEHC Youth' }],
  },
  {
    id: 'prod-totebag-gehc-003',
    name: 'Totebag GEHC Youth',
    description: 'Totebag canvas premium — desain eksklusif Beyonders. Muat buku & laptop 14 inch.',
    price: 75000,
    buyPrice: 45000,
    stock: 30,
    category: 'MERCHANDISE',
    sortOrder: 3,
    images: [{ url: 'https://placehold.co/400x400/FAF9F5/1B1B1B?text=Totebag%0ABeyonders', caption: 'Totebag GEHC Youth' }],
  },
  // FUNDRAISING
  {
    id: 'prod-ricebowl-004',
    name: 'Ricebowl GEHC',
    description: 'Nasi + ayam goreng + sayur + sambal. Porsi besar, harga mahasiswa! Cocok untuk makan siang.',
    price: 15000,
    stock: 100,
    category: 'FUNDRAISING',
    sortOrder: 4,
    images: [{ url: 'https://placehold.co/400x400/F59E0B/white?text=Ricebowl%0AGEHC', caption: 'Ricebowl GEHC' }],
  },
  {
    id: 'prod-puding-sedot-005',
    name: 'Puding Sedot GEHC',
    description: 'Puding sedot rasa buah-buahan segar. Praktis, enak, dan menyegarkan!',
    price: 10000,
    stock: 150,
    category: 'FUNDRAISING',
    sortOrder: 5,
    images: [{ url: 'https://placehold.co/400x400/EC4899/white?text=Puding%0ASedot', caption: 'Puding Sedot GEHC' }],
  },
  {
    id: 'prod-es-buah-006',
    name: 'Es Buah Segar',
    description: 'Es buah segar dengan campuran buah-buahan pilihan. Manis, segar, dan bikin adem!',
    price: 12000,
    stock: 80,
    category: 'FUNDRAISING',
    sortOrder: 6,
    images: [{ url: 'https://placehold.co/400x400/06B6D4/white?text=Es%0ABuah+Segar', caption: 'Es Buah Segar' }],
  },
  {
    id: 'prod-babi-sate-007',
    name: 'Babi Sate GEHC',
    description: 'Babi sate bakar bumbu khas Manado. Daging empuk, bumbu meresap. Favorit semua orang!',
    price: 25000,
    stock: 60,
    category: 'FUNDRAISING',
    sortOrder: 7,
    images: [{ url: 'https://placehold.co/400x400/DC2626/white?text=Babi%0ASate', caption: 'Babi Sate GEHC' }],
  },
  // DONATION
  {
    id: 'prod-donasi-008',
    name: 'Donasi Bebas',
    description: 'Donasi untuk program pelayanan GEHC Youth. Setiap rupiah yang kamu berkan akan membantu kegiatan pemuridan dan pelayanan pemuda.',
    price: 0,
    stock: 9999,
    category: 'DONATION',
    sortOrder: 8,
    images: [{ url: 'https://placehold.co/400x400/6366F1/white?text=Donasi%0ABebas', caption: 'Donasi GEHC Youth' }],
  },
];

async function main() {
  // Clear old products
  await prisma.product.deleteMany({});
  console.log('Old products cleared');

  for (const p of products) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        buyPrice: p.buyPrice ?? null,
        stock: p.stock,
        category: p.category,
        sortOrder: p.sortOrder,
        images: JSON.stringify(p.images),
        createdById: 'u-tech-001',
      },
    });
    console.log(`✓ ${p.name} — Rp ${p.price.toLocaleString('id-ID')}`);
  }

  console.log('\nDone! All products seeded.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
