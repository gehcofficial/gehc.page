/**
 * Seed komponen penatalayan baku — dari serving-role-catalog (satu sumber).
 *
 * Idempotent: upsert per roleKey / alias nama lama. Tidak menghapus komponen manual.
 *
 *   npm run db:seed:service-roles
 *   npm run db:seed:service-roles:staging
 *   npm run db:seed:service-roles:prod
 */
import { getPrisma, getDbLabel } from './db.mjs';
import {
  SERVING_ROLE_CATALOG,
  resolveRoleKey,
  stripPersonSuffix,
  canonicalLabel,
} from './lib/serving-role-catalog.mjs';

const BOTH = 'SERVING_DAY,MENTORING_DAY';

async function findExistingRole(prisma, row) {
  const byKey = await prisma.serviceRole.findFirst({ where: { roleKey: row.key } }).catch(() => null);
  if (byKey) return byKey;
  const byName = await prisma.serviceRole.findUnique({ where: { name: row.labelId } }).catch(() => null);
  if (byName) return byName;
  const all = await prisma.serviceRole.findMany({ where: { isActive: true }, take: 300 }).catch(() => []);
  for (const r of all) {
    const base = stripPersonSuffix(r.name);
    if (resolveRoleKey(base) === row.key) return r;
    for (const a of row.aliases) {
      if (typeof a === 'string' && a.toLowerCase() === base.toLowerCase()) return r;
    }
  }
  return null;
}

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('DATABASE_URL belum dikonfigurasi.');
    process.exit(1);
  }
  console.log(`Seed komponen penatalayan → ${getDbLabel()}`);
  let created = 0;
  let updated = 0;
  let renamed = 0;
  const orderByDivision = {};
  for (const row of SERVING_ROLE_CATALOG) {
    orderByDivision[row.division] = (orderByDivision[row.division] || 0) + 10;
    const data = {
      name: row.labelId,
      roleKey: row.key,
      division: row.division,
      subDivision: row.subDivision || null,
      serviceTypes: row.serviceTypes || BOTH,
      checklistTemplate: row.checklist && row.checklist.length ? row.checklist : null,
      description: row.description || '',
      sortOrder: orderByDivision[row.division],
      isRequired: row.isRequired !== false,
      isActive: true,
    };
    const existing = await findExistingRole(prisma, row);
    if (existing) {
      const rename = stripPersonSuffix(existing.name) !== row.labelId && canonicalLabel(existing.name) === row.labelId;
      if (rename) renamed += 1;
      await prisma.serviceRole.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      const id = 'sr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await prisma.serviceRole.create({ data: { id, ...data } });
      created += 1;
    }
  }
  console.log(`✓ Selesai — ${created} dibuat, ${updated} diselaraskan (${renamed} dinormalisasi dari alias).`);
}

main()
  .catch((e) => {
    console.error('Gagal seed service roles:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    if (prisma) await prisma.$disconnect().catch(() => {});
  });
