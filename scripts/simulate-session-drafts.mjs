#!/usr/bin/env node
/**
 * Simulasi draft sesi 6 pola ibadah — konteks fix "More Than Good News".
 *
 * Menjalankan generateSessionDraft LIVE (OpenAI primary, Groq fallback)
 * untuk 6 pola dengan DUA perikop studio yang dibedakan perannya:
 *   - Fundamental Firman (1 Korintus 15:3-4) = JANGKAR TEMA
 *   - Kitab Fokus (1 Korintus 15) = BAHAN BACAAN & PENDALAMAN
 *
 * AMAN: read-only terhadap DB (hanya baca pola dari worship_patterns untuk
 * nama/ringkasan/playbook). Tidak menulis sesi, tidak menyentuh prod.
 * Keluaran: docs/preview/simulasi-more-than-good-news.md (+ JSON per pola).
 *
 *   node scripts/simulate-session-drafts.mjs
 *   node scripts/simulate-session-drafts.mjs --pattern=DEBAT
 *   node scripts/simulate-session-drafts.mjs --upload --event-date=2026-10-04
 *   node scripts/simulate-session-drafts.mjs --upload-only --event-date=2026-10-04
 *   dotenv -e .env.staging -- node scripts/simulate-session-drafts.mjs --upload-only --event-date=2026-10-04
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPrisma } from '../server/db.mjs';
import { generateSessionDraft } from '../server/lib/didaskalia-ai.mjs';
import { getDriveMode, uploadFile, listFiles, deleteFile } from '../server/gdrive.mjs';
import { createEventFolder } from '../server/gdrive-events.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'preview');

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const eq = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!eq) return fallback;
  if (eq.includes('=')) return eq.slice(eq.indexOf('=') + 1) || true;
  const next = args[args.indexOf(eq) + 1];
  return next && !next.startsWith('--') ? next : true;
};
const ONLY = String(flag('pattern', '') || '').toUpperCase();

// Konteks fix — More Than Good News (dari sesi mentoring-2026-10-04).
const CONTEXT = {
  yearMonth: '2026-10',
  weekIndex: 1,
  date: '2026-10-04',
  monthTheme: 'Injil yang Mengubahkan',
  theme: 'More Than Good News',
  fundamentalFirman: {
    ref: '1 Korintus 15:3-4',
    text: 'Sebab yang sangat penting telah kusampaikan kepadamu, yaitu apa yang telah kuterima sendiri, ialah bahwa Kristus telah mati karena dosa-dosa kita, sesuai dengan Kitab Suci, bahwa Ia telah dikuburkan, dan bahwa Ia telah dibangkitkan, pada hari yang ketiga, sesuai dengan Kitab Suci.',
  },
  kitabFokus: '1 Korintus 15',
  sermonSummary:
    'Injil bukan sekadar tiket ke surga — kematian dan kebangkitan Kristus adalah solusi praktis bagi pergumulan Hubungan, Pekerjaan, dan Keluarga kita hari ini.',
  pathsOutline: [
    'Path 1: The Gospel Core — ringkasan Injil dari 1 Kor 15:3-4',
    'Path 2-7: pendalaman progresif 1 Korintus 15 per bagian harian',
  ].join('\n'),
};

// Kunci template per pola (cermin src/lib/worship-session-draft.ts → templateFieldKeys).
const FIELD_KEYS = {
  MONOLOG: [
    ['fgd-observe', 'Observasi'], ['fgd-interpret', 'Interpretasi'], ['fgd-apply', 'Aplikasi'],
  ],
  DUAL_MONOLOG: [
    ['outer-exile', 'Outer Exile'], ['inner-exile', 'Inner Exile'], ['song', 'Lagu bedah'],
    ['deep-q1', 'Pertanyaan 1'], ['deep-q2', 'Pertanyaan 2'],
  ],
  DEBAT: [
    ['mosi-1', 'Mosi 1'], ['mosi-2', 'Mosi 2'], ['mosi-3', 'Mosi 3'], ['mosi-4', 'Mosi 4'], ['mosi-5', 'Mosi 5'],
    ['trap-reveal', 'Trap Reveal'],
  ],
  BEDAH_FILM: [
    ['film-title', 'Judul film'], ['film-alt', 'Kandidat lain + alasan'], ['film-scenes', 'Adegan paralel'], ['pleno-prompt', 'Pancingan pleno'],
    ['film-q1', 'Pertanyaan 1'], ['film-q2', 'Pertanyaan 2'], ['film-q3', 'Pertanyaan 3'],
  ],
  THREE_SEQUENCES: [
    ['yel', 'Yel-yel'], ['cipher', 'Sandi'], ['case-1-title', 'Amplop 1'], ['case-1-body', 'Isi amplop 1'],
    ['case-2-title', 'Amplop 2'], ['case-2-body', 'Isi amplop 2'],
  ],
  POST_TO_POST: [],
};

const FF_MARKERS = ['15:3-4', '15 : 3', '15:3', 'telah mati karena dosa', 'dibangkitkan', 'pada hari yang ketiga'];
const KF_MARKERS = ['1 Korintus 15', 'Korintus 15', 'pasal 15'];

function hitFF(text) {
  const t = String(text || '');
  return FF_MARKERS.some((m) => t.includes(m));
}
function hitKF(text) {
  const t = String(text || '');
  return KF_MARKERS.some((m) => t.includes(m)) && !FF_MARKERS.some((m) => t.includes(m));
}

/** Kumpulkan semua string bernada solusi + bacaan dari draft untuk analisis cakupan. */
function collectSlots(code, draft) {
  const slots = [];
  if (draft.kind === 'POST_TO_POST') {
    for (const it of draft.items || []) {
      slots.push({ slot: `Likert ${it.topicCode}`, solusi: it.gospelNote || '', bacaan: '' });
    }
    for (const [k, v] of Object.entries(draft.affirmations || {})) {
      for (const a of v || []) slots.push({ slot: `Afirmasi ${k}`, solusi: a, bacaan: '' });
    }
  } else {
    for (const v of draft.values || []) {
      const k = String(v.key || '');
      const isSolusi = /affirm|komitmen|reveal|trap|kesimpulan|pancingan|yel/i.test(k) || /commit|conclus/i.test(k);
      slots.push({ slot: k, solusi: isSolusi ? v.value : '', bacaan: isSolusi ? '' : v.value });
    }
  }
  return slots;
}

function coverageTable(code, draft) {
  const slots = collectSlots(code, draft);
  const sol = slots.filter((s) => s.solusi);
  const solFF = sol.filter((s) => hitFF(s.solusi));
  const lines = [];
  lines.push(`| Slot | Merujuk Fundamental (1Kor 15:3-4) | Merujuk Kitab Fokus (1Kor 15) |`);
  lines.push(`|---|---|---|`);
  for (const s of slots) {
    const text = `${s.solusi} ${s.bacaan}`;
    lines.push(`| ${s.slot} | ${hitFF(text) ? '✅' : (s.solusi ? '⚠️' : '—')} | ${hitKF(text) ? '✅' : (s.bacaan ? '⚠️' : '—')} |`);
  }
  lines.push('');
  lines.push(`**Ringkasan ${code}:** ${solFF.length}/${sol.length} slot solusi merujuk eksplisit ke Fundamental Firman.`);
  return lines.join('\n');
}

const OLD_SAMPLES = ['gavin stone', 'anak bungsu', 'anak sulung'];

/** Deteksi contoh lama playbook + sisa placeholder {{...}} di output AI. */
function detectLegacy(draft) {
  const texts = [];
  if (draft.kind === 'POST_TO_POST') {
    for (const it of draft.items || []) texts.push(it.text, it.gospelNote);
    for (const v of Object.values(draft.affirmations || {})) texts.push(...(v || []));
    for (const t of draft.topics || []) texts.push(t.label, t.pic);
    for (const c of draft.chips || []) texts.push(c.label);
  } else {
    for (const v of draft.values || []) texts.push(v.value);
  }
  const joined = texts.join('\n').toLowerCase();
  const found = OLD_SAMPLES.filter((s) => joined.includes(s));
  const placeholders = joined.match(/\{\{[^}]+\}\}/g) || [];
  return { found, placeholders: [...new Set(placeholders)] };
}

function renderExegesis(draft) {
  const ex = draft.exegesis || { points: [], implications: [] };
  const lines = ['### Eksegesis (dari teks, langkah 1)'];
  if ((ex.points || []).length) {
    lines.push('Poin inti perikop:');
    for (const p of ex.points) lines.push(`- ${p}`);
  } else {
    lines.push('(AI tidak mengembalikan poin inti)');
  }
  if ((ex.implications || []).length) {
    lines.push('Implikasi bagi Beyonders:');
    for (const p of ex.implications) lines.push(`- ${p}`);
  }
  return lines.join('\n');
}

function renderDraft(code, pattern, draft) {
  const lines = [];
  lines.push(`## ${code} — ${pattern?.name || code}`);
  lines.push('');
  if (pattern?.summary) lines.push(`> ${pattern.summary}`, '');
  lines.push(renderExegesis(draft), '');
  const legacy = detectLegacy(draft);
  if (legacy.found.length || legacy.placeholders.length) {
    lines.push(
      `> ⚠️ Contoh lama terdeteksi: ${[...legacy.found.map((s) => `"${s}"`), ...legacy.placeholders].join(', ')} — perlu justifikasi atau diganti.`,
      '',
    );
  }
  if (draft.kind === 'POST_TO_POST') {
    lines.push(`### Topik (${(draft.topics || []).length})`);
    for (const t of draft.topics || []) lines.push(`- **${t.code}** — ${t.label} (PIC: ${t.pic || '-'})`);
    lines.push('', `### Likert (${(draft.items || []).length} soal)`);
    for (const it of draft.items || []) {
      lines.push(`- [${it.topicCode}] ${it.text}`);
      lines.push(`  - *Gospel note:* ${it.gospelNote || '(kosong)'}`);
    }
    lines.push('', `### Chip (${(draft.chips || []).length})`);
    lines.push((draft.chips || []).map((c) => c.label).join('  ·  ') || '(kosong)');
    lines.push('', `### Afirmasi`);
    for (const [k, v] of Object.entries(draft.affirmations || [])) {
      lines.push(`- **${k}**:`);
      for (const a of v || []) lines.push(`  - ${a}`);
    }
    lines.push('', `Timer: ${draft.timerSeconds}s`);
  } else {
    lines.push(`### Nilai template (${(draft.values || []).length})`);
    for (const v of draft.values || []) {
      lines.push(`- **${v.key}**: ${String(v.value || '').slice(0, 400)}`);
    }
    if (!(draft.values || []).length) lines.push('(AI tidak mengembalikan nilai)');
  }
  lines.push('', `### Cakupan dua perikop`, '', coverageTable(code, draft), '');
  return { md: lines.join('\n'), json: draft };
}

const FILENAME = 'simulasi-more-than-good-news.md';

/** Unggah laporan ke folder Drive event (idempoten: file lama senama dihapus dulu). */
async function uploadReport(prisma, reportPath) {
  if (getDriveMode() !== 'service-account') {
    throw new Error('Upload butuh service account (GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).');
  }
  const dateStr = String(flag('event-date', CONTEXT.date) || CONTEXT.date).slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const cands = await prisma.eventProgram.findMany({
    where: { eventDate: { gte: dayStart, lt: dayEnd } },
    select: { id: true, name: true, slug: true, serviceType: true, driveFolderId: true },
  });
  const event = cands.find((e) => String(e.serviceType || '').toUpperCase().includes('MENTORING')) || cands[0];
  if (!event) {
    throw new Error(
      `Tidak ada event pada ${dateStr} di DB ini. ` +
      `Cek flag --event-date=YYYY-MM-DD (format: tanggal ibadah).`,
    );
  }
  console.log(`Event: "${event.name}" [${event.serviceType || '-'}]`);
  // Folder Didaskalia event (find-or-create idempoten, preseden didaskalia-rhb;
  // createEventFolder mengembalikan id string).
  const didasId = await createEventFolder(
    { name: event.name, slug: event.slug || event.id },
    'DIDASKALIA',
  );
  const folderId = didasId || event.driveFolderId;
  if (!folderId) throw new Error(`Folder Drive event "${event.name}" tidak dapat dipastikan.`);
  console.log(`Folder Didaskalia event: ${folderId}`);
  const existing = await listFiles({ folderId, query: FILENAME, pageSize: 10, fresh: true }).catch(() => []);
  for (const f of existing || []) {
    if (f?.name === FILENAME && f?.id) await deleteFile(f.id).catch(() => {});
  }
  const buf = fs.readFileSync(reportPath);
  const up = await uploadFile(folderId, { filename: FILENAME, mimetype: 'text/markdown', buffer: buf });
  console.log(`✓ Terunggah ke folder Didaskalia event "${event.name}": ${up?.webViewLink || up?.id}`);
  return up;
}

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const reportPath = path.join(OUT_DIR, 'simulasi-more-than-good-news.md');
  if (flag('upload-only', false)) {
    if (!fs.existsSync(reportPath)) throw new Error('Laporan belum ada — jalankan simulasi dulu.');
    await uploadReport(prisma, reportPath);
    await prisma.$disconnect().catch(() => {});
    return;
  }
  const rows = await prisma.worshipPattern.findMany({ orderBy: [{ sortOrder: 'asc' }] });
  const codes = Object.keys(FIELD_KEYS).filter((c) => !ONLY || c === ONLY);
  if (ONLY && !codes.length) throw new Error(`Pola ${ONLY} tidak dikenal.`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = [];
  report.push(`# Simulasi Draft Sesi — More Than Good News (6 pola)`);
  report.push('');
  report.push(`> Konteks fix: tema **${CONTEXT.theme}** · Fundamental Firman **${CONTEXT.fundamentalFirman.ref}** (jangkar) · Kitab Fokus **${CONTEXT.kitabFokus}** (bacaan).`);
  report.push(`> Dibuat: ${new Date().toLocaleString('id-ID')} · AI live (OpenAI primary, Groq fallback).`);
  report.push(`> Status: **DRAFT SIMULASI** — belum masuk DB sesi, belum dikirim ke mana pun.`);
  report.push('');

  for (const code of codes) {
    const pattern = rows.find((r) => String(r.code).toUpperCase() === code);
    console.log(`\n== ${code} ==`);
    const fieldKeys = (FIELD_KEYS[code] || []).map(([key, label]) => ({ key, label }));
    try {
      const draft = await generateSessionDraft({
        ...CONTEXT,
        pattern: pattern
          ? { code: pattern.code, name: pattern.name, summary: pattern.summary || '', phases: [], playbook: String(pattern.playbook || '').slice(0, 4000) }
          : { code, name: code, phases: [], playbook: '' },
        fieldKeys,
      });
      const { md, json } = renderDraft(code, pattern, draft);
      report.push(md);
      fs.writeFileSync(path.join(OUT_DIR, `simulasi-${code.toLowerCase().replace(/_/g, '-')}.json`), JSON.stringify({ context: CONTEXT, draft: json }, null, 2));
      console.log(`✓ ${code}: ${draft.kind}`);
    } catch (e) {
      report.push(`## ${code}\n\n❌ Gagal: ${e?.message || e}\n`);
      console.error(`✗ ${code}: ${e?.message || e}`);
    }
  }

  const out = reportPath;
  if (fs.existsSync(out)) {
    const v1 = path.join(OUT_DIR, 'simulasi-more-than-good-news-v1.md');
    if (!fs.existsSync(v1)) {
      fs.copyFileSync(out, v1);
      console.log('Arsip v1 disimpan (pembanding).');
    }
  }
  fs.writeFileSync(out, report.join('\n'));
  console.log(`\n✓ Laporan: ${out}`);
  if (flag('upload', false)) await uploadReport(prisma, out);
  await prisma.$disconnect().catch(() => {});
}

main().catch((e) => {
  console.error('Simulasi gagal:', e?.message || e);
  process.exit(1);
});
