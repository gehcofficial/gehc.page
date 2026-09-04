/**
 * Deactivate leftover Youth org slots from the pre-v2 panca/BZP rename.
 * Idempotent. Usage:
 *   npm run db:prune:org-legacy:staging
 *   npm run db:prune:org-legacy:prod
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { pruneLegacyOrgSlots } from './services/org-prune-legacy.mjs';

function resolveUrl() {
  const env = String(process.env.GEHC_ENV || process.env.DB_TARGET || '').toLowerCase();
  if (env === 'production' || env === 'prod' || env === 'main') {
    return process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL || '';
  }
  return process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING || '';
}

function maskDbUrl(url) {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '').split('?')[0];
    return `${u.hostname}:${u.port || 4000}/${db}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

const seedUrl = resolveUrl();
if (!seedUrl) {
  console.error('❌ DATABASE_URL tidak ada — gunakan db:prune:org-legacy:staging atau :prod');
  process.exit(1);
}
process.env.DATABASE_URL = seedUrl;
console.log(`🧹 prune-legacy-org-slots → ${process.env.GEHC_ENV || 'default'} · ${maskDbUrl(seedUrl)}`);

const prisma = new PrismaClient();

const stats = await pruneLegacyOrgSlots(prisma);
console.log(
  `✓ legacy slots: scanned=${stats.scanned} leftover=${stats.legacy} moved=${stats.moved} deactivated=${stats.deactivated} no-target=${stats.skipped}`,
);
await prisma.$disconnect();
