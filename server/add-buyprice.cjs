require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE products ADD COLUMN buy_price INT DEFAULT NULL AFTER price');
  console.log('buy_price column added');
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
