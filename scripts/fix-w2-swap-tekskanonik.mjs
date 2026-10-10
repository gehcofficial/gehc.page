/**
 * Koreksi swap teks kanonis pekan 2026-10 W2 (Serving Day 11 Okt — The Rescue Plan).
 *
 * Temuan audit prod (10 Okt 2026): ref benar, tetapi ISI tertukar —
 *   sermon.teksUtama { ref: 2 Korintus 5:21, text: <isi Kolose 1:13-14> } ❌
 *   studio.fundamentalFirman { ref: Kolose 1:13-14, text: <isi 2 Kor 5:21> } ❌
 * Outline 4 bagian SUDAH benar (Bedah = Korintus, Jembatan = Kolose).
 *
 * Teks pengganti = TB kanonis, diverifikasi live via bolls.life
 * (get-verse TB 47/5/21 + get-text TB 51/1) pada 10 Okt 2026.
 * Riwayat dipertahankan (snapshot versi lama → bisa undo via regen-undo).
 *
 * Pakai:
 *   node scripts/fix-w2-swap-tekskanonik.mjs [--apply] [--target=staging|production]
 * Tanpa --apply = dry-run (hanya tampilkan diff).
 */
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1];
if (targetArg) process.env.GEHC_ENV = targetArg;

const { getPrisma, getDbLabel } = await import('../server/db.mjs');

const KORINTUS_TB = 'Dia yang tidak mengenal dosa telah dibuat-Nya menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.';
const KOLOSE_TB = 'Ia telah melepaskan kita dari kuasa kegelapan dan memindahkan kita ke dalam Kerajaan Anak-Nya yang kekasih; di dalam Dia kita memiliki penebusan kita, yaitu pengampunan dosa.';

const prisma = getPrisma();
if (!prisma) { console.error('DATABASE_URL belum dikonfigurasi.'); process.exit(1); }
console.log('Target DB:', getDbLabel(), APPLY ? '(APPLY)' : '(dry-run)');

const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: '2026-10' } });
if (!plan) { console.error('Plan 2026-10 tidak ada.'); await prisma.$disconnect(); process.exit(1); }
const weeks = Array.isArray(plan.weeks) ? plan.weeks.map((w) => ({ ...w })) : [];
const idx = weeks.findIndex((w) => Number(w?.index) === 2);
if (idx < 0) { console.error('Week 2 tidak ada.'); await prisma.$disconnect(); process.exit(1); }
const week = weeks[idx];
const st = week.studio && typeof week.studio === 'object' ? week.studio : {};
const sm = st.sermon && typeof st.sermon === 'object' ? st.sermon : {};

console.log('SEBELUM:', JSON.stringify({
  teksUtama: sm.teksUtama || null,
  fundamentalFirman: st.fundamentalFirman || null,
}, null, 1));
console.log('SESUDAH (rencana):', JSON.stringify({
  teksUtama: { ref: '2 Korintus 5:21', text: KORINTUS_TB },
  fundamentalFirman: { ref: st.fundamentalFirman?.ref || 'Kolose 1:13–14', text: KOLOSE_TB },
  catatan: 'ref tidak diubah (sudah benar); hanya isi dikembalikan ke kitabnya masing-masing (TB bolls.life). kitabFokus dibiarkan.',
}, null, 1));

if (!APPLY) {
  console.log('Dry-run selesai. Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

const snapshot = {
  chapterNo: st.chapterNo || '',
  fundamentalFirman: st.fundamentalFirman || { ref: '', text: '' },
  kitabFokus: st.kitabFokus || '',
  homileticMethods: st.homileticMethods || [],
  methodMix: st.methodMix || [],
  paths: st.paths || [],
  sermon: sm,
};
const entry = {
  id: `fix-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
  at: new Date().toISOString(),
  byName: 'Admin (koreksi swap kanonis)',
  kind: 'correction',
  applied: true,
  summary: 'Koreksi manual: teksUtama.text = 2 Kor 5:21 TB, fundamentalFirman.text = Kol 1:13-14 TB (sebelumnya tertukar); ref & outline tak diubah.',
  snapshot,
  meta: { source: 'bolls.life TB (get-verse 47/5/21 + get-text 51/1)', generationBefore: Number(st.generation) || 0 },
};

weeks[idx] = {
  ...week,
  studio: {
    ...st,
    fundamentalFirman: { ...(st.fundamentalFirman || {}), text: KOLOSE_TB },
    sermon: { ...sm, teksUtama: { ...(sm.teksUtama || {}), text: KORINTUS_TB } },
    pendingRegen: null,
    regenHistory: [entry, ...(Array.isArray(st.regenHistory) ? st.regenHistory : [])].slice(0, 20),
  },
};
await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
console.log('OK — swap terkoreksi. Langkah lanjut: buka deck pembekalan + khutbah W2, lalu publish ulang doc 01/02 bila perlu.');
await prisma.$disconnect();
