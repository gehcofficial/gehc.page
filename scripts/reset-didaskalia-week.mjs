/**
 * Reset hasil AI Studio Didaskalia.
 *
 * Menyisakan HANYA: 2 referensi bacaan (fundamentalFirman + kitabFokus) dan
 * metode yang akan dipakai (homileticMethods + methodMix). Semua keluaran AI
 * lain dibersihkan (paths, sermon, discussion, rituals, generation, presentation,
 * render, pendingRegen, regenHistory), chapterNo dikosongkan, status → DRAFT.
 *
 * AMAN: default DRY-RUN. Tambahkan --apply untuk menulis.
 *
 *   node scripts/reset-didaskalia-week.mjs --ym 2026-09 --week 4            # 1 pekan (dry-run)
 *   node scripts/reset-didaskalia-week.mjs --ym 2026-09                     # semua pekan bulan itu
 *   node scripts/reset-didaskalia-week.mjs --all                            # semua bulan
 *   npm run db:reset:didaskalia:staging                                     # --all --apply (staging)
 *   $env:GEHC_ENV='production'; node scripts/reset-didaskalia-week.mjs --all --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? String(process.argv[i + 1] || '') : '';
}

const yearMonth = argValue('--ym');
const weekArg = argValue('--week');
const weekIndex = weekArg ? Number(weekArg) : null;

if (!ALL && !/^\d{4}-\d{2}$/.test(yearMonth)) {
  console.error('Wajib: --ym YYYY-MM (mis. --ym 2026-09) atau --all.');
  process.exit(1);
}
if (weekArg && (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > 6)) {
  console.error('--week harus 1..6.');
  process.exit(1);
}

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

function resetStudio(studio) {
  const s = studio && typeof studio === 'object' ? studio : {};
  return {
    fundamentalFirman: s.fundamentalFirman || { ref: '', text: '' },
    kitabFokus: s.kitabFokus || '',
    homileticMethods: Array.isArray(s.homileticMethods) ? s.homileticMethods : [],
    methodMix: Array.isArray(s.methodMix) ? s.methodMix : [],
    authorId: s.authorId ?? null,
    reviewerId: s.reviewerId ?? null,
    chapterNo: '',
    status: 'DRAFT',
    paths: [],
    sermon: { methods: [], rationale: '', summary: '', slideOutline: [], deliveryPlan: [], prepChecklist: [], discussionFlow: [] },
    discussion: [],
    rituals: [],
    generation: 0,
    presentation: {},
    render: {},
    pendingRegen: null,
    regenHistory: [],
  };
}

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);
console.log(`Sasaran   : ${ALL ? 'SEMUA bulan' : yearMonth}${weekIndex ? ` · pekan ${weekIndex}` : ' · semua pekan'}`);
console.log('Menyisakan: fundamentalFirman, kitabFokus, homileticMethods, methodMix\n');

const plans = ALL
  ? await prisma.ministryMonthPlan.findMany({ orderBy: { yearMonth: 'asc' } })
  : await prisma.ministryMonthPlan.findMany({ where: { yearMonth } });

if (!plans.length) {
  console.error('Tidak ada rencana bulan yang cocok.');
  await prisma.$disconnect();
  process.exit(1);
}

let changedPlans = 0;
let changedWeeks = 0;

for (const plan of plans) {
  const weeks = Array.isArray(plan.weeks) ? plan.weeks.map((w) => ({ ...w })) : [];
  let planChanged = false;

  weeks.forEach((w, idx) => {
    const wi = Number(w?.index) || idx + 1;
    if (weekIndex && wi !== weekIndex) return;
    const before = w?.studio && typeof w.studio === 'object' ? w.studio : {};
    const after = resetStudio(before);
    const hadOutput = (Array.isArray(before.paths) && before.paths.length)
      || String(before.sermon?.summary || '').length
      || (before.generation || 0) > 0
      || (Array.isArray(before.discussion) && before.discussion.length)
      || (Array.isArray(before.rituals) && before.rituals.length)
      || !!before.chapterNo
      || (before.presentation && Object.keys(before.presentation).length)
      || (before.render && Object.keys(before.render).length)
      || !!before.pendingRegen
      || before.status !== 'DRAFT';
    if (!hadOutput) return;
    weeks[idx] = { ...w, studio: after };
    planChanged = true;
    changedWeeks += 1;
    console.log(`  ${plan.yearMonth} · W${wi} -> paths/sermon/discussion/rituals/generation dibersihkan; bacaan & metode dipertahankan`);
  });

  if (planChanged) {
    changedPlans += 1;
    if (APPLY) {
      await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
    }
  }
}

console.log(`\n${APPLY ? 'Selesai' : '(dry-run)'} — ${changedWeeks} pekan pada ${changedPlans} bulan${APPLY ? ' ditulis' : ' akan ditulis'}.`);
if (!APPLY) console.log('Tambahkan --apply untuk menulis.');

await prisma.$disconnect();
