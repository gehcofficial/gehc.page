/**
 * Seed 10 rumah Beyonders (cangkang grup, tanpa anggota/nama mentor).
 * Idempotent. Tidak membuat akun demo.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { INITIAL_GROUPS, INITIAL_TENANTS } from '../src/data/initialData.ts';

function resolveSeedDatabaseUrl() {
  const env = String(process.env.GEHC_ENV || process.env.DB_TARGET || '').toLowerCase();
  if (env === 'production' || env === 'prod' || env === 'main') {
    return process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL || '';
  }
  return process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING || '';
}

function maskDbUrl(url: string) {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '').split('?')[0];
    return `${u.hostname}:${u.port || 4000}/${db}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

const seedUrl = resolveSeedDatabaseUrl();
if (!seedUrl) {
  console.error('❌ DATABASE_URL tidak ada — gunakan db:seed:beyonders-houses:staging|prod');
  process.exit(1);
}
process.env.DATABASE_URL = seedUrl;
console.log(`🌱 seed-beyonders-houses → ${process.env.GEHC_ENV || 'default'} · ${maskDbUrl(seedUrl)}`);

const prisma = new PrismaClient();

async function main() {
  const youth = INITIAL_TENANTS.find((t) => t.id === 'tenant-youth');
  if (!youth) throw new Error('INITIAL_TENANTS missing tenant-youth');

  await prisma.tenant.upsert({
    where: { id: youth.id },
    create: {
      id: youth.id,
      name: youth.name,
      slug: youth.slug,
      domain: youth.domain,
      description: youth.description,
      isActive: youth.is_active,
    },
    update: { name: youth.name, isActive: youth.is_active },
  });

  for (const g of INITIAL_GROUPS) {
    const data = {
      tenantId: g.tenant_id,
      name: g.name,
      meaning: g.meaning,
      scripture: g.scripture,
      meetingSchedule: g.meetingSchedule,
      meetingLocation: g.meetingLocation,
      color: g.color,
      icon: g.icon,
      description: g.description,
    };
    const existing = await prisma.group.findUnique({ where: { id: g.id } });
    if (existing) {
      await prisma.group.update({ where: { id: g.id }, data });
    } else {
      await prisma.group.create({
        data: { id: g.id, ...data, memberCount: 0 },
      });
    }
  }

  const count = await prisma.group.count({
    where: { tenantId: 'tenant-youth', status: 'ACTIVE' },
  });
  console.log(`✓ Beyonders houses: ${INITIAL_GROUPS.length} upserted · active groups=${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
