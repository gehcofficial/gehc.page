/**
 * Seed struktur unit pelayanan jemaat (BPMJ + 4 unit) ke `struktur_members`.
 * Idempotent: upsert berdasarkan id tetap (posisi terbuka bila belum diisi pengurus).
 *
 *   npm run db:seed:church-org[:staging|:prod]
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from './db.mjs';
import { CHURCH_UNITS } from './lib/church-org.mjs';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const prisma = getPrisma();
  if (!prisma) { console.error('DATABASE_URL belum dikonfigurasi.'); process.exit(1); }
  console.log(`Seed unit jemaat → ${getDbLabel()}`);

  let created = 0;
  let updated = 0;
  for (const unit of CHURCH_UNITS) {
    let order = 0;
    for (const position of unit.positions) {
      order += 10;
      const id = `sm-church-${slug(unit.code)}-${slug(position)}`;
      const data = {
        name: `${position} — Posisi Terbuka`,
        position,
        division: unit.code,
        subdivision: unit.subdivisions[0] || null,
        role: 'COMMITTEE',
        roleOrder: order,
        isOpenRole: true,
        sortOrder: order,
      };
      const existing = await prisma.strukturMember.findUnique({ where: { id } }).catch(() => null);
      if (existing) {
        // Jangan timpa bila sudah diisi pengurus nyata.
        if (existing.isOpenRole) {
          await prisma.strukturMember.update({ where: { id }, data });
          updated += 1;
        }
      } else {
        await prisma.strukturMember.create({ data: { id, ...data } });
        created += 1;
      }
    }
    console.log(`  ✓ ${unit.label} (${unit.positions.length} posisi)`);
  }
  console.log(`✓ Selesai — ${created} dibuat, ${updated} diselaraskan.`);
}

main()
  .catch((e) => { console.error('Gagal seed unit jemaat:', e?.message || e); process.exit(1); })
  .finally(async () => { const p = getPrisma(); if (p) await p.$disconnect().catch(() => {}); });
