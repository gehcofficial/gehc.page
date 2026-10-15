/**
 * Backfill status PUBLISHED untuk pekan yang dokumen khotbahnya sudah
 * diterbitkan (punya render.khutbah.snapshot) tapi status masih DRAFT.
 *
 * Latar: endpoint publish dulu hanya menandai PUBLISHED untuk doc
 * pembekalan/RHB — publish khotbah (kasus W1/W2 Okt 2026) tak mengubah status,
 * sehingga gerbang ringkasan publik tak pernah terbuka untuknya.
 *
 * AMAN: default DRY-RUN (hanya daftar kandidat). Tambahkan --apply untuk menulis.
 * Hanya menulis field status (isi/versi/snapshot tak disentuh). Dilewati bila
 * ada pendingRegen PENDING (materi sedang diajukan — jangan terbitkan diam-diam).
 *
 *   node scripts/backfill-published-khutbah.mjs
 *   dotenv -e .env.staging -- node scripts/backfill-published-khutbah.mjs --apply
 *   dotenv -e .env.production -- node scripts/backfill-published-khutbah.mjs --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';

const APPLY = process.argv.includes('--apply');
const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (tulis status)' : 'DRY-RUN (tidak menulis)'}\n`);

const plans = await prisma.ministryMonthPlan.findMany({ orderBy: { yearMonth: 'asc' } });
const candidates = [];
for (const plan of plans || []) {
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
  for (const w of weeks) {
    const st = w?.studio && typeof w.studio === 'object' ? w.studio : {};
    const status = String(st.status || 'DRAFT').toUpperCase();
    const snap = st.render?.khutbah?.snapshot || null;
    const pending = st.pendingRegen && String(st.pendingRegen.status || '').toUpperCase() === 'PENDING';
    if (snap && status !== 'PUBLISHED' && !pending) {
      candidates.push({ yearMonth: plan.yearMonth, index: Number(w?.index), theme: w?.mentoringTheme || w?.servingTheme || w?.theme || '' });
    }
  }
}

if (!candidates.length) {
  console.log('Tidak ada kandidat (semua pekan bersnapshot khutbah sudah PUBLISHED / tak ada snapshot).');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('Kandidat flip → PUBLISHED:');
for (const c of candidates) console.log(` - ${c.yearMonth} W${c.index} "${String(c.theme).slice(0, 60)}"`);

if (!APPLY) {
  console.log('\nDRY-RUN: tidak ada yang ditulis. Tambahkan --apply untuk menandai.');
  await prisma.$disconnect();
  process.exit(0);
}

let done = 0;
for (const c of candidates) {
  const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: c.yearMonth } });
  const weeks = (Array.isArray(plan?.weeks) ? plan.weeks : []).map((w) => ({ ...(w || {}) }));
  const idx = weeks.findIndex((w) => Number(w?.index) === c.index);
  if (idx < 0) continue;
  const st = weeks[idx].studio && typeof weeks[idx].studio === 'object' ? { ...weeks[idx].studio } : {};
  // Cek ulang sebelum tulis (snapshot masih ada, tak ada pending).
  if (!st.render?.khutbah?.snapshot) continue;
  if (st.pendingRegen && String(st.pendingRegen.status || '').toUpperCase() === 'PENDING') continue;
  st.status = 'PUBLISHED';
  weeks[idx] = { ...weeks[idx], studio: st };
  await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
  done += 1;
}
console.log(`\nOK: ${done}/${candidates.length} pekan ditandai PUBLISHED.`);
await prisma.$disconnect();
