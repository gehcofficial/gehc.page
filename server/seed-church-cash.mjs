/**
 * Seed idempotent: akun kas unit + petty cash BZP (P5).
 *
 * Jalankan:
 *   npm run db:seed:church-cash            (lokal, .env)
 *   npm run db:seed:church-cash:staging
 *   npm run db:seed:church-cash:prod
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { UNIT_ACCOUNTS, BZP_PETTY_CODE } from './lib/church-cash.mjs';

const prisma = new PrismaClient();
const BZP_SETTING_ID = 'bzp-settings';

async function main() {
  let created = 0;
  for (const a of UNIT_ACCOUNTS) {
    const existing = await prisma.cashAccount.findUnique({ where: { code: a.code } }).catch(() => null);
    if (existing) continue;
    await prisma.cashAccount.create({
      data: { id: `acc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...a },
    });
    created += 1;
    console.log(`✓ akun ${a.code} (${a.name})`);
  }
  console.log(`akun dibuat: ${created} (sisanya sudah ada)`);

  const petty = await prisma.cashAccount.findUnique({ where: { code: BZP_PETTY_CODE } }).catch(() => null);
  if (petty) {
    await prisma.bzpSetting.upsert({
      where: { id: BZP_SETTING_ID },
      update: { pettyCashAllowanceAccountId: petty.id },
      create: { id: BZP_SETTING_ID, pettyCashAllowanceAccountId: petty.id },
    });
    console.log(`✓ petty cash BZP → ${petty.id}`);
  }
  console.log('seed kas unit selesai');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
