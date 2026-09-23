/**
 * Reset hasil AI untuk satu minggu Didaskalia (hapus 7 Path + Ringkasan Khotbah),
 * TANPA menyentuh brief: Chapter, Fundamental Firman, Kitab Fokus, metode, mix,
 * diskusi, ritual, gambar presentasi, dan status.
 *
 * AMAN: default DRY-RUN. Tambahkan --apply untuk menulis.
 *   node scripts/reset-didaskalia-week.mjs --ym 2026-09 --week 4            # dry-run (staging)
 *   node scripts/reset-didaskalia-week.mjs --ym 2026-09 --week 4 --apply    # apply (staging)
 *   $env:GEHC_ENV='production'; node scripts/reset-didaskalia-week.mjs --ym 2026-09 --week 4
 *   $env:GEHC_ENV='production'; node scripts/reset-didaskalia-week.mjs --ym 2026-09 --week 4 --apply
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';

const APPLY = process.argv.includes('--apply');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? String(process.argv[i + 1] || '') : '';
}

const yearMonth = argValue('--ym');
const weekIndex = Number(argValue('--week'));
if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
  console.error('Wajib: --ym YYYY-MM (mis. --ym 2026-09)');
  process.exit(1);
}
if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > 6) {
  console.error('Wajib: --week 1..6 (mis. --week 4)');
  process.exit(1);
}

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);
console.log(`Sasaran   : ${yearMonth} minggu ke-${weekIndex}`);

const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
if (!plan) {
  console.error(`Rencana bulan ${yearMonth} tidak ditemukan.`);
  await prisma.$disconnect();
  process.exit(1);
}

const weeks = Array.isArray(plan.weeks) ? plan.weeks.map((w) => ({ ...w })) : [];
const idx = weeks.findIndex((w) => Number(w?.index) === weekIndex);
if (idx < 0) {
  console.error(`Minggu ke-${weekIndex} tidak ada di ${yearMonth}.`);
  await prisma.$disconnect();
  process.exit(1);
}

const week = weeks[idx];
const studio = week.studio && typeof week.studio === 'object' ? { ...week.studio } : {};
const paths = Array.isArray(studio.paths) ? studio.paths : [];
const sermonLen = String(studio.sermon?.summary || '').length;

console.log('\nSebelum:');
console.log(`  tema            : ${week.mentoringTheme || week.servingTheme || week.theme || '(kosong)'}`);
console.log(`  status          : ${studio.status || '(kosong)'}`);
console.log(`  chapterNo       : ${studio.chapterNo || '(kosong)'}`);
console.log(`  fundamentalFirman: ${studio.fundamentalFirman?.ref || '(kosong)'}`);
console.log(`  kitabFokus      : ${studio.kitabFokus || '(kosong)'}`);
console.log(`  homileticMethods: ${(studio.homileticMethods || []).length} metode`);
console.log(`  methodMix       : ${(studio.methodMix || []).length} baris`);
console.log(`  paths           : ${paths.length} Path (judul: ${paths.slice(0, 3).map((p) => p.title).join(' | ') || '-'})`);
console.log(`  sermon.summary  : ${sermonLen} karakter`);
console.log(`  render (PDF)    : ${Object.keys(studio.render || {}).join(', ') || '(kosong)'}`);

console.log('\nSesudah (rencana):');
console.log('  paths           : [] (dihapus)');
console.log('  sermon          : { methods:[], rationale:"", summary:"", slideOutline:[] }');
console.log('  lainnya         : DIPERTAHANKAN (chapterNo, fundamentalFirman, kitabFokus, metode, mix, diskusi, ritual, presentasi, status)');

if (!APPLY) {
  console.log('\n(dry-run) Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

const nextStudio = {
  ...studio,
  paths: [],
  sermon: { methods: [], rationale: '', summary: '', slideOutline: [] },
};
weeks[idx] = { ...week, studio: nextStudio };

await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });

const after = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
const w2 = (after?.weeks || []).find((w) => Number(w?.index) === weekIndex) || {};
console.log('\nSelesai. Verifikasi:');
console.log(`  paths  : ${(w2.studio?.paths || []).length}`);
console.log(`  sermon : ${String(w2.studio?.sermon?.summary || '').length} karakter`);
console.log(`  chapterNo tetap: ${w2.studio?.chapterNo || '(kosong)'} · kitabFokus tetap: ${w2.studio?.kitabFokus || '(kosong)'}`);

await prisma.$disconnect();
