/**
 * Settlement literal-MD pekan 2026-10 W2 (Serving Day 11 Okt 2026 — The Rescue Plan).
 *
 * Disetujui admin: isi khotbah mengikuti MD Service VERBATIM (4 bagian),
 * teksUtama diluruskan ke 2 Korintus 5:21, generation AI dinolkan sebagai
 * baseline baru. Riwayat dipertahankan (snapshot versi lama tersimpan di
 * regenHistory → bisa undo via regen-undo).
 *
 * Pakai:
 *   node scripts/settle-khutbah-literal-111026.mjs [--apply] [--target=staging|production] [--md=<path>]
 *
 * Tanpa --apply = dry-run (hanya tampilkan diff).
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1];
if (targetArg) process.env.GEHC_ENV = targetArg;
const mdArg = args.find((a) => a.startsWith('--md='))?.split('=')[1];
const MD_PATH = mdArg || 'D:\\AISaerang Life\\Services\\Khotbah\\Y111026\\For Service_111026.md';

const { getPrisma, getDbLabel } = await import('../server/db.mjs');
const { parseServiceMd } = await import('../server/lib/didaskalia-md.mjs');

const prisma = getPrisma();
if (!prisma) { console.error('DATABASE_URL belum dikonfigurasi.'); process.exit(1); }
console.log('Target DB:', getDbLabel(), APPLY ? '(APPLY)' : '(dry-run)');

const raw = fs.readFileSync(MD_PATH, 'utf8');
const parsed = parseServiceMd(raw);
console.log('Parse MD:', JSON.stringify({ ok: parsed.ok, missing: parsed.missing, info: parsed.info }));
if (!parsed.ok) { console.error('MD tidak lengkap — batal.'); await prisma.$disconnect(); process.exit(1); }

const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: '2026-10' } });
if (!plan) { console.error('Plan 2026-10 tidak ada.'); await prisma.$disconnect(); process.exit(1); }
const weeks = Array.isArray(plan.weeks) ? plan.weeks.map((w) => ({ ...w })) : [];
const idx = weeks.findIndex((w) => Number(w?.index) === 2);
if (idx < 0) { console.error('Week 2 tidak ada.'); await prisma.$disconnect(); process.exit(1); }
const week = weeks[idx];
const st = week.studio && typeof week.studio === 'object' ? week.studio : {};
const sm = st.sermon && typeof st.sermon === 'object' ? st.sermon : {};
const ol = sm.outline && typeof sm.outline === 'object' ? sm.outline : {};

const before = {
  generation: st.generation,
  status: st.status,
  teksUtama: sm.teksUtama || null,
  outlineLens: {
    pengantar: (ol.pengantar || '').length,
    bedahTeologis: (ol.bedahTeologis || '').length,
    jembatan: (ol.jembatan || '').length,
    kesimpulan: (ol.kesimpulan || '').length,
  },
  summaryLen: (sm.summary || '').length,
  historyLen: Array.isArray(st.regenHistory) ? st.regenHistory.length : 0,
};
console.log('SEBELUM:', JSON.stringify(before, null, 1));

const snapshot = {
  chapterNo: st.chapterNo || '',
  fundamentalFirman: st.fundamentalFirman || { ref: '', text: '' },
  kitabFokus: st.kitabFokus || '',
  homileticMethods: st.homileticMethods || [],
  methodMix: st.methodMix || [],
  paths: st.paths || [],
  sermon: sm,
};

const afterOutline = {
  pengantar: parsed.outline.pengantar,
  bedahTeologis: parsed.outline.bedahTeologis,
  jembatan: parsed.outline.jembatan,
  kesimpulan: parsed.outline.kesimpulan,
};
const newSermon = {
  ...sm,
  teksUtama: { ref: parsed.info.teksUtama || sm.teksUtama?.ref || '', text: sm.teksUtama?.text || '' },
  outline: afterOutline,
};
const newFundamental = {
  ref: parsed.info.teksJangkar || st.fundamentalFirman?.ref || '',
  text: st.fundamentalFirman?.text || '',
};
console.log('SESUDAH (rencana):', JSON.stringify({
  generation: 0,
  teksUtama: newSermon.teksUtama,
  fundamentalFirmanRef: newFundamental.ref,
  outlineLens: Object.fromEntries(Object.entries(afterOutline).map(([k, v]) => [k, v.length])),
  summaryLen: (newSermon.summary || '').length,
  catatan: 'summary/slideOutline AI dipertahankan apa adanya (masih dipakai modul Pembekalan 01); deck khutbah 02 kini 100% literal outline.',
}, null, 1));

if (!APPLY) {
  console.log('Dry-run selesai. Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

const entry = {
  id: `settle-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
  at: new Date().toISOString(),
  byName: 'Admin (settlement literal-MD)',
  kind: 'settlement',
  applied: true,
  summary: 'Settlement admin: outline khotbah = verbatim For Service_111026.md (4 bagian); teksUtama diluruskan 2 Kor 5:21; jangkar Kol 1:13-14; generation=0 baseline baru.',
  snapshot,
  meta: { source: 'For Service_111026.md', generationBefore: Number(st.generation) || 0, standard: 'literal-MD' },
};

weeks[idx] = {
  ...week,
  studio: {
    ...st,
    fundamentalFirman: newFundamental,
    sermon: newSermon,
    sourceMd: { ...(st.sourceMd || {}), service: { info: parsed.info, outline: afterOutline } },
    generation: 0,
    pendingRegen: null,
    regenHistory: [entry, ...(Array.isArray(st.regenHistory) ? st.regenHistory : [])].slice(0, 20),
  },
};
await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
console.log('OK — settlement tersimpan. generation=0, riwayat dipertahankan (+1 entri settlement).');
console.log('Langkah lanjut: generate 4 gambar per bagian via Studio (Ilustrasikan per bagian), lalu publish ulang doc 02.');
await prisma.$disconnect();
