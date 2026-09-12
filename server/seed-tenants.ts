/**
 * Seed tenant unit (id/domain English) + defaultBipra/registrationOpen.
 * Bersihkan tenant id lama (pra-English) bila tak dipakai.
 *
 * Jalankan:
 *   npm run db:seed:tenants           (lokal, .env)
 *   npm run db:seed:tenants:staging
 *   npm run db:seed:tenants:prod
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { INITIAL_TENANTS } from '../src/data/initialData';

const prisma = new PrismaClient();

const LEGACY_TENANT_IDS = ['tenant-bapak', 'tenant-ibu', 'tenant-rekreasi', 'tenant-teritorial'];

async function main() {
  for (const t of INITIAL_TENANTS) {
    const defaults = {
      name: t.name,
      slug: t.slug,
      domain: t.domain,
      description: t.description,
      isActive: t.is_active,
      defaultBipra: (t.defaultBipra ?? null) as never,
      registrationOpen: Boolean(t.registrationOpen),
    };
    await prisma.tenant.upsert({
      where: { id: t.id },
      create: { id: t.id, ...defaults },
      update: defaults,
    });
    console.log(`✓ tenant ${t.id} → ${t.domain}`);
  }

  for (const id of LEGACY_TENANT_IDS) {
    const [roles, groups] = await Promise.all([
      prisma.userRole.count({ where: { tenantId: id } }),
      prisma.group.count({ where: { tenantId: id } }),
    ]);
    if (roles === 0 && groups === 0) {
      await prisma.tenant.deleteMany({ where: { id } });
      console.log(`✓ legacy tenant dihapus: ${id}`);
    } else {
      console.warn(`⚠️ legacy tenant ${id} masih dipakai (roles=${roles}, groups=${groups}) — dilewati`);
    }
  }

  console.log('tenant seed selesai');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
