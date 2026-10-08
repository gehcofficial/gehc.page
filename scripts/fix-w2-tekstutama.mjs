/** Koreksi teks kutipan teksUtama W2 (tanpa menyentuh history/generation). */
import fs from 'node:fs';

const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1];
if (targetArg) process.env.GEHC_ENV = targetArg;
const APPLY = args.includes('--apply');

const { getPrisma, getDbLabel } = await import('../server/db.mjs');
const prisma = getPrisma();
console.log('Target DB:', getDbLabel(), APPLY ? '(APPLY)' : '(dry-run)');

const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: '2026-10' } });
const weeks = plan.weeks.map((w) => ({ ...w }));
const idx = weeks.findIndex((w) => Number(w?.index) === 2);
const sm = weeks[idx].studio.sermon;
console.log('SEBELUM:', JSON.stringify(sm.teksUtama));
const fixed = 'Dia yang tidak mengenal dosa telah dibuat-Nya menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.';
if (APPLY) {
  weeks[idx].studio.sermon = { ...sm, teksUtama: { ref: '2 Korintus 5:21', text: fixed } };
  await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
  console.log('OK — teksUtama.text diluruskan ke kutipan 2 Kor 5:21.');
} else {
  console.log('Akan diset ke:', fixed);
}
await prisma.$disconnect();
