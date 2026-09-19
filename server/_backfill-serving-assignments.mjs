/**
 * Lengkapi baris nyata `serving_assignments` dari siklus untuk event yang sudah ada
 * (mis. event dibuat manual sehingga generate tidak membuat penanggung/tuan rumah).
 * Idempoten — aman dijalankan berulang.
 *
 *   node server/_backfill-serving-assignments.mjs            (dry-run)
 *   node server/_backfill-serving-assignments.mjs --apply    (tulis)
 *   dotenv -e .env.production -- node server/_backfill-serving-assignments.mjs --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from './db.mjs';
import { applyServingBackfill, planServingBackfill } from './lib/serving-backfill.mjs';

const apply = process.argv.includes('--apply');

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  console.log(`DB: ${getDbLabel()} | mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const plan = await planServingBackfill(prisma);
  console.log(`Minggu layanan (dari anchor): ${plan.serviceDays.length} | sudah punya baris: ${plan.existing.length}`);
  console.log(`Akan dibuat: ${plan.rows.length}`);
  for (const r of plan.rows.slice(0, 20)) {
    console.log(`  ${r.date} idx=${r.cycleIndex} ${r.responsibleName} / ${r.hostName}`);
  }
  if (plan.rows.length > 20) console.log(`  …dan ${plan.rows.length - 20} minggu lain.`);

  if (!apply) {
    console.log('\n(dry-run) Jalankan dengan --apply untuk menulis.');
    return;
  }
  const result = await applyServingBackfill(prisma, plan.rows);
  console.log(`\nSelesai: ${result.created} dibuat, ${result.skipped} dilewati.`);
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => getPrisma()?.$disconnect?.());
