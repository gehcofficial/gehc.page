/**
 * Perbaiki data Studio Didaskalia per pekan (tanpa menghapus konten):
 *  1. dayLabel Path 1-7 dipaksa hari kalender (Path 1 = Minggu).
 *  2. Slot regenerate dibersihkan (pendingRegen=null, regenHistory=[], generation=0).
 *
 * Paths/khotbah/diskusi/metode/firman TIDAK disentuh.
 *
 * AMAN: default DRY-RUN. Tambahkan --apply untuk menulis.
 *
 *   node scripts/fix-didaskalia-week.mjs --ym 2026-10 --week 2          # 1 pekan (dry-run)
 *   node scripts/fix-didaskalia-week.mjs --ym 2026-10                   # semua pekan bulan itu
 *   node scripts/fix-didaskalia-week.mjs --all                          # semua bulan
 *   npm run db:fix:didaskalia:staging                                   # staging (dry-run; tambah --apply)
 *   $env:GEHC_ENV='production'; node scripts/fix-didaskalia-week.mjs --all --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
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
  console.error('Wajib: --ym YYYY-MM (mis. --ym 2026-10) atau --all.');
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

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);
console.log(`Sasaran   : ${ALL ? 'SEMUA bulan' : yearMonth}${weekIndex ? ` · pekan ${weekIndex}` : ' · semua pekan'}\n`);

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
    const st = w?.studio && typeof w.studio === 'object' ? { ...w.studio } : null;
    if (!st) return;
    const notes = [];

    // 1. dayLabel kalender.
    const paths = Array.isArray(st.paths) ? st.paths.map((p) => ({ ...(p || {}) })) : [];
    paths.forEach((p, i) => {
      const want = DAY_LABELS[i] || `Hari ${i + 1}`;
      if (p.dayLabel !== want) {
        notes.push(`Path ${i + 1}: "${p.dayLabel || '(kosong)'}" → "${want}"`);
        p.dayLabel = want;
      }
      p.pathIndex = i + 1;
    });
    if (paths.length && notes.length === 0 && (st.paths || []).length !== 7) {
      // Struktur tidak lengkap — biarkan (bukan tugas skrip ini).
    }

    // 2. Slot regenerate.
    const hadPending = !!st.pendingRegen;
    const histCount = Array.isArray(st.regenHistory) ? st.regenHistory.length : 0;
    const hadGen = (Number(st.generation) || 0) > 0;
    if (hadPending || histCount || hadGen) {
      notes.push(`regenerate dibersihkan (pending=${hadPending}, riwayat=${histCount}, generasi=${st.generation || 0}→0)`);
      st.pendingRegen = null;
      st.regenHistory = [];
      st.generation = 0;
    }

    if (!notes.length) return;
    if (paths.length) st.paths = paths;
    weeks[idx] = { ...w, studio: st };
    planChanged = true;
    changedWeeks += 1;
    console.log(`  ${plan.yearMonth} · W${wi}`);
    for (const n of notes) console.log(`    - ${n}`);
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
