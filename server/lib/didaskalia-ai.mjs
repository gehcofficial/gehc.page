/**
 * Didaskalia Studio — lapisan AI untuk menyusun 7 Path, Ringkasan Khotbah,
 * dan pembekalan mentor/co-mentor. Memakai provider yang sama dengan Jethro
 * (server/ai-provider.mjs: OpenAI primary, Groq fallback).
 *
 * Prinsip: keluaran AI adalah USULAN. Manusia tetap menyunting & menyetujui.
 */
import { z } from 'zod';
import { jethroGenerateText, jethroGenerateObject } from '../ai-provider.mjs';

export const HOMILETIC_METHODS = [
  'Teologi Sistematika',
  'Teologi Biblika',
  'Pengajaran Tematika',
  'Pengajaran Ekspositori',
  'Apologetika',
  'Teologi Praktika / Pastoral',
  'Teologi Historis',
];

export const RITUAL_TYPES = ['INTERNAL_SYNC', 'SERVING_BRIEFING', 'READER_COACHING', 'GENERAL_EQUIPPING'];

export const RITUAL_LABELS = {
  INTERNAL_SYNC: 'Internal Sync',
  SERVING_BRIEFING: 'Serving Group Briefing',
  READER_COACHING: 'Pembinaan Pembaca Firman',
  GENERAL_EQUIPPING: 'General Equipping',
};

/** Minggu gerejawi: Path 1 = Minggu (hari khotbah) → Path 7 = Sabtu. */
export const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Lima section baku RHB harian (urutan tetap). */
export const RHB_SECTIONS = [
  { key: 'PENGANTAR', title: 'Pengantar' },
  { key: 'PEMBAHASAN_TEMATIS', title: 'Pembahasan Tematis' },
  { key: 'MAKNA_IMPLIKASI', title: 'Makna & Implikasi bagi Beyonders' },
  { key: 'REFLEKSI_PRIBADI', title: 'Pertanyaan untuk Refleksi Pribadi' },
  { key: 'DISKUSI_KELOMPOK', title: 'Pertanyaan untuk Diskusi Kelompok' },
];

const SYSTEM =
  'Kamu adalah asisten kurikulum pemuridan "Didaskalia" untuk Komisi Pemuda GMIM Eben Haezer Cikarang (GEHC Youth "Beyonders"). ' +
  'Audiens: pemuda dan anak rantau di Cikarang — MAYORITAS mahasiswa dan pekerja (pabrik/kantor). ' +
  'Karena itu, ilustrasi dan penerapan HARUS menyentuh dunia mereka: kuliah (KRS, tugas, ujian, skripsi, magang), kerja (shift, lembur, target, atasan/rekan kerja, gaji pertama), kos/kontrakan, keuangan awal, relasi & keluarga jauh. ' +
  'Gaya: hangat, jelas, Alkitabiah, kontekstual, tidak menggurui, tidak religius-kaku. ' +
  'Selalu menulis dalam Bahasa Indonesia. Jangan mengarang fakta di luar data yang diberikan. ' +
  'Kerangka teologis (WAJIB): GMIM adalah gereja Protestan Kalvinis (Reformed); seluruh isi harus berakar pada tradisi Reformed dan konsisten dengannya. ' +
  'Ciri yang harus tampak: Sola Scriptura (Alkitab sebagai otoritas tertinggi), Sola Gratia (keselamatan murni anugerah, bukan usaha manusia), Sola Fide (dibenarkan oleh iman), Solus Christus (hanya Kristus perantara), Soli Deo Gloria (segala sesuatu untuk kemuliaan Allah). ' +
  'Pegang kedaulatan Allah atas segala sesuatu, keberdosaan total manusia, pemilihan & panggilan oleh anugerah, penebusan Kristus, anugerah yang memampukan, dan ketekunan orang percaya; serta pola teologi perjanjian. ' +
  'Sajikan sebagai keyakinan yang menghidupkan dan membangun — hangat, bukan polemik atau menyerang aliran/gereja lain. ' +
  'Jangan menyiratkan keselamatan karena perbuatan baik atau "Allah + usaha manusia" sejajar; pemuridan adalah respons syukur dan pengudusan, bukan sarana memperoleh keselamatan.';

/** Cari akhir objek JSON (brace seimbang) mulai dari `start`; -1 bila belum tertutup. */
function findJsonEnd(s, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Perbaiki JSON yang terpotong: buang sisa elemen tak lengkap di ujung dan
 * tutup string/bracket/brace yang menggantung. Best-effort.
 */
export function repairJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let body = s.slice(start).trim();

  // Buang pagar markdown / teks penutup.
  body = body.replace(/```[a-zA-Z]*\s*$/,'').replace(/```\s*$/,'').trim();

  // Coba perbaikan bertingkat: potong pada koma/penutup terakhir yang aman.
  for (let attempt = 0; attempt < 40 && body.length > 2; attempt++) {
    const candidate = closeOpen(body);
    try {
      return JSON.parse(sanitizeJsonText(candidate));
    } catch {
      // Potong ke pemisah elemen terakhir sebelumnya.
      const cut = Math.max(body.lastIndexOf('},'), body.lastIndexOf('],'), body.lastIndexOf(','), body.lastIndexOf('}'));
      if (cut < 0) break;
      body = body.slice(0, cut + 1);
    }
  }
  // Terakhir: coba apa adanya dengan penutup.
  try { return JSON.parse(sanitizeJsonText(closeOpen(body))); } catch { return null; }
}

/** Tutup string & bracket/brace yang masih terbuka (urutan stack benar). */
function closeOpen(str) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = str;
  if (inStr) out += '"';
  out = out.replace(/[,\s]+$/, '');
  while (stack.length) out += stack.pop() === '{' ? '}' : ']';
  return out;
}

/**
 * Normalisasi JSON keluaran LLM:
 * - escape newline/tab literal di dalam string,
 * - sisipkan koma yang hilang antar nilai (luar string),
 * - buang koma menggantung sebelum } / ].
 */
export function sanitizeJsonText(str) {
  const isTokenChar = (c) => /[0-9A-Za-z._+\-]/.test(c);
  const needsComma = (last) => last === '}' || last === ']' || last === '"' || isTokenChar(last);
  let out = '';
  let inStr = false;
  let esc = false;
  let inToken = false;
  let lastSig = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; lastSig = '"'; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (inToken) {
      if (isTokenChar(ch)) { out += ch; continue; }
      inToken = false;
    }
    if (ch === '"') { if (needsComma(lastSig)) out += ','; inStr = true; out += ch; lastSig = '"'; continue; }
    if (ch === '{' || ch === '[') { if (needsComma(lastSig)) out += ','; out += ch; lastSig = ch; continue; }
    if (ch === '}' || ch === ']') { out += ch; lastSig = ch; continue; }
    if (ch === ':') { out += ch; lastSig = ':'; continue; }
    if (ch === ',') { out += ch; lastSig = ','; continue; }
    if (/\s/.test(ch)) { out += ch; continue; }
    if (needsComma(lastSig)) out += ',';
    out += ch; lastSig = ch; inToken = true;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

/** Ambil objek JSON pertama dari keluaran model yang mungkin berbalut teks. */
export function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) throw new Error('Keluaran AI tidak memuat JSON.');
  const end = findJsonEnd(s, start);
  if (end >= 0) {
    const raw = s.slice(start, end + 1);
    try {
      return JSON.parse(raw);
    } catch {
      try {
        return JSON.parse(sanitizeJsonText(raw));
      } catch (e2) {
        const m = /position (\d+)/.exec(String(e2.message));
        const repaired = repairJson(raw);
        if (repaired) return repaired;
        const pos = m ? Number(m[1]) : -1;
        const snippet = pos >= 0 ? raw.slice(Math.max(0, pos - 100), pos + 100) : '';
        throw new Error(`JSON tidak valid: ${e2.message}${snippet ? ` | ...${snippet}...` : ''}`);
      }
    }
  }
  // Terpotong → coba perbaiki.
  const repaired = repairJson(s.slice(start));
  if (repaired) return repaired;
  throw new Error('JSON terpotong.');
}

function asStr(v, fallback = '') {
  return typeof v === 'string' ? v.trim() : fallback;
}

function asStrArray(v, max = 12) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asStr(x)).filter(Boolean).slice(0, max);
}

function clampRhbSections(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return RHB_SECTIONS.map((def) => {
    const found = list.find((x) => x && typeof x === 'object' && String(x.key || '').toUpperCase() === def.key) || {};
    return {
      key: def.key,
      title: def.title,
      body: asStr(found.body),
      imageFileId: '',
    };
  });
}

function clampPaths(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < 7; i++) {
    const p = list[i] || {};
    out.push({
      // Hari kalender baku: Path 1 = Minggu — jangan percaya keluaran model.
      dayLabel: DAY_LABELS[i],
      pathIndex: i + 1,
      dayLabel: asStr(p.dayLabel, DAY_LABELS[i] || `Hari ${i + 1}`),
      title: asStr(p.title, `Path ${i + 1}`),
      scriptureRef: asStr(p.scriptureRef),
      scriptureText: asStr(p.scriptureText),
      bacaanRef: asStr(p.bacaanRef),
      summary: asStr(p.summary),
      homileticLens: asStrArray(p.homileticLens, 4),
      hookQuestion: asStr(p.hookQuestion),
      illustration: asStr(p.illustration),
      reflection: asStr(p.reflection),
      observeQ: asStr(p.observeQ),
      interpretQ: asStr(p.interpretQ),
      applyQ: asStr(p.applyQ),
      fgdQuestions: asStrArray(p.fgdQuestions, 6),
      bridge: asStr(p.bridge),
      imageStem: asStr(p.imageStem),
      coverImageFileId: '',
      rhbSections: clampRhbSections(p.rhbSections),
    });
  }
  return out;
}

function clampSlides(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((s) => ({
    title: asStr(s?.title, 'Slide'),
    bullets: asStrArray(s?.bullets, 8),
    visualNote: asStr(s?.visualNote),
  }));
}

export function clampSermon(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const plan = Array.isArray(s.deliveryPlan) ? s.deliveryPlan : [];
  const tu = s.teksUtama && typeof s.teksUtama === 'object' ? s.teksUtama : {};
  const ol = s.outline && typeof s.outline === 'object' ? s.outline : {};
  const cut = (v, n) => asStr(v).slice(0, n);
  return {
    bigIdea: cut(s.bigIdea, 500),
    teksUtama: { ref: cut(tu.ref, 160), text: cut(tu.text, 600) },
    outline: {
      pengantar: cut(ol.pengantar, 6000),
      bedahTeologis: cut(ol.bedahTeologis, 8000),
      jembatan: cut(ol.jembatan, 6000),
      kesimpulan: cut(ol.kesimpulan, 4000),
    },
    methods: asStrArray(s.methods, 4),
    rationale: asStr(s.rationale),
    summary: asStr(s.summary),
    slideOutline: clampSlides(s.slideOutline),
    deliveryPlan: plan
      .slice(0, 7)
      .map((d) => ({ method: asStr(d?.method), how: asStr(d?.how) }))
      .filter((d) => d.method || d.how),
    prepChecklist: asStrArray(s.prepChecklist, 10),
    discussionFlow: asStrArray(s.discussionFlow, 8),
  };
}

function clampMethodMix(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 7)
    .map((m) => ({
      method: asStr(m?.method),
      percent: Math.max(0, Math.min(100, Math.round(Number(m?.percent) || 0))),
      note: asStr(m?.note),
    }))
    .filter((m) => m.method);
}

export function clampDraft(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const ff = d.fundamentalFirman && typeof d.fundamentalFirman === 'object' ? d.fundamentalFirman : {};
  return {
    chapterNo: asStr(d.chapterNo),
    fundamentalFirman: { ref: asStr(ff.ref), text: asStr(ff.text) },
    kitabFokus: asStr(d.kitabFokus),
    homileticMethods: asStrArray(d.homileticMethods, 4),
    methodMix: clampMethodMix(d.methodMix),
    paths: clampPaths(d.paths),
    sermon: clampSermon(d.sermon),
  };
}

/** Ringkas satu minggu (studio) untuk konteks kesinambungan. */
export function summarizeWeek(week, studio) {
  if (!week || !studio || typeof studio !== 'object') return null;
  const paths = Array.isArray(studio.paths) ? studio.paths.slice(0, 7) : [];
  const theme = week.mentoringTheme || week.servingTheme || week.theme || '';
  const hasContent = theme || studio.fundamentalFirman?.ref || studio.kitabFokus || paths.some((p) => p.title);
  if (!hasContent) return null;
  return {
    theme,
    fundamentalFirman: asStr(studio.fundamentalFirman?.ref),
    kitabFokus: asStr(studio.kitabFokus),
    paths: paths.map((p) => `${asStr(p.dayLabel)}: ${asStr(p.title)}${p.summary ? ` — ${asStr(p.summary)}` : ''}`),
    ringkasanKhotbah: asStr(studio.sermon?.summary).slice(0, 500),
  };
}

function buildContext(input) {
  const lines = [
    `Bulan (YYYY-MM): ${asStr(input.yearMonth)}`,
    `Minggu ke-: ${input.weekIndex}`,
    `Tanggal Minggu: ${asStr(input.date)}`,
    `Chapter: ${asStr(input.chapterNo)}`,
    `Tema minggu: ${asStr(input.theme)}`,
    `Tema bulan: ${asStr(input.monthTheme)}`,
    `Fundamental Firman (ayat): ${asStr(input.fundamentalFirman?.ref)} ${asStr(input.fundamentalFirman?.text)}`.trim(),
    `Kitab/bagian fokus: ${asStr(input.kitabFokus)}`,
    `Metode berkhotbah yang diminta: ${(input.methods && input.methods.length ? input.methods : ['otomatis pilih 2-3 yang paling cocok']).join(', ')}`,
    input.prevWeek
      ? `MINGGU LALU (untuk kesinambungan): ${JSON.stringify(input.prevWeek)}`
      : `Tema minggu sebelum (jembatan masuk): ${asStr(input.prevTheme) || '(tidak ada)'}`,
    input.nextWeek
      ? `MINGGU DEPAN (jembatan keluar): ${JSON.stringify(input.nextWeek)}`
      : `Tema minggu berikutnya (jembatan keluar): ${asStr(input.nextTheme) || '(tidak ada)'}`,
    input.notes ? `Catatan tim/diskusi: ${asStr(input.notes)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Blok konteks tim: instruksi khusus + knowledge base (Gems-like).
 * Dipakai semua generator agar output selaras pemikiran tim Didaskalia.
 */
function teamContextBlock(input) {
  const lines = [];
  const instr = asStr(input?.instruction);
  if (instr) {
    lines.push('INSTRUKSI KHUSUS TIM (WAJIB DIPATUHI, di atas gaya bawaan):');
    lines.push(instr);
    lines.push('');
  }
  const docs = Array.isArray(input?.knowledge) ? input.knowledge : [];
  if (docs.length) {
    const max = Math.min(60000, Math.max(1000, Number(input?.maxKnowledgeChars) || 12000));
    let used = 0;
    const parts = [];
    for (const d of docs) {
      const head = `--- ${asStr(d?.title) || 'Dokumen'}${d?.category ? ` [${d.category}]` : ''} ---`;
      const body = asStr(d?.content);
      const room = max - used - head.length - 2;
      if (room <= 200) break;
      const slice = body.slice(0, room);
      parts.push(`${head}\n${slice}`);
      used += head.length + slice.length + 2;
    }
    if (parts.length) {
      lines.push('PENGETAHUAN TIM (referensi internal — jadikan panduan pola/gaya, jangan salin mentah):');
      lines.push(parts.join('\n\n'));
      lines.push('');
    }
  }
  return lines;
}

/**
 * Blok pola ibadah minggu ini: AI menyesuaikan BENTUK penyampaian
 * (pembekalan, ringkasan, alur diskusi) dengan pola — bukan default
 * monolog & FGD terus. Standar isi RHB tetap berlaku di semua pola.
 */
export function patternBlock(pattern) {
  const p = pattern && typeof pattern === 'object' ? pattern : null;
  const code = String(p?.code || 'MONOLOG').toUpperCase() || 'MONOLOG';
  const lines = ['POLA IBADAH MINGGU INI (WAJIB DIIKUTI BENTUK DAN TEKNISNYA):'];
  lines.push(`- Pola: ${p?.name || code}${code === 'MONOLOG' ? ' (default)' : ''}`);
  if (p?.summary) lines.push(`- Gambaran: ${p.summary}`);
  if (Array.isArray(p?.phases) && p.phases.length) {
    lines.push('- Fase baku pola (durasi & penanggung jawab — JANGAN diubah totalnya, sesuaikan isi dengan tema):');
    for (const f of p.phases.slice(0, 8)) {
      const note = f.notes ? ` — ${f.notes}` : '';
      lines.push(`  ${f.no || ''}. ${f.title || ''}${f.minutes ? ` (${f.minutes}')` : ''}${f.owner ? ` — ${f.owner}` : ''}${note}`);
    }
  }
  if (p?.playbook) lines.push(`- Skenario pola (jadikan kerangka alur hari Minggu):\n${String(p.playbook).slice(0, 4000)}`);
  if (code === 'MONOLOG') {
    lines.push('- Bentuk: monolog (+bedah lagu per bait, opsional dua suara) + pertanyaan dipicu mentor satu per satu + FGD 3 (observasi → interpretasi → aplikasi) + deep sharing 2 + Satu Kata + komitmen; discussionFlow = urutan 5 pertanyaan + Satu Kata; deliveryPlan tekankan bedah lagu dan fasilitasi pemicu.');
  } else if (code === 'POST_TO_POST') {
    lines.push('- Bentuk: monolog SINGKAT + briefing pos; discussionFlow = RUTE KUNJUNGAN berurutan rank 1→3 (BUKAN FGD duduk); deliveryPlan tekankan briefing aturan main & manajemen 3 pos.');
  } else if (code === 'DUAL_MONOLOG') {
    lines.push('- Bentuk: drama 2 speaker (Outer Exile + Inner Exile) + pembacaan berbalasan + bedah lagu; discussionFlow = panduan deep sharing (mentor buka dulu, Satu Kata, 2 pertanyaan wajib); deliveryPlan tekankan blocking, cue musik/lampu, dan transisi ke konvergensi firman.');
  } else if (code === 'DEBAT') {
    lines.push('- Bentuk: ronde debat + konklusi teologis; discussionFlow = alur ronde, peran, penjurian; deliveryPlan tekankan moderasi netral & timer mutlak.');
  } else if (code === 'BEDAH_FILM') {
    lines.push('- Bentuk: screening + pleno analisa; discussionFlow = panduan pleno + deep sharing identitas; deliveryPlan tekankan setup pemutaran & fasilitasi pleno.');
  } else if (code === 'THREE_SEQUENCES') {
    lines.push('- Bentuk: gamifikasi 3 sequence tanpa jeda (Melayani → Bersekutu → Bersaksi) + commissioning; discussionFlow = brief tiap sequence + aturan presentasi 4 menit; deliveryPlan tekankan komando countdown, pembagian 5 tim Mission Room, dan deklarasi Coram Deo.');
  } else {
    lines.push('- Bentuk: ikuti skenario pola di atas; discussionFlow = alur partisipatif sesuai pola (bukan FGD generik).');
  }
  lines.push('');
  return lines;
}

/** Panggil AI & parse JSON dengan penjagaan: cap token, retry bila terpotong, repair. */
async function generateJson({ prompt, maxOutputTokens = 6000, timeoutMs = 45000 }) {
  let res = await jethroGenerateText({ system: SYSTEM, prompt, maxOutputTokens, timeoutMs, json: true });
  let meta = { modelId: res.modelId, finishReason: res.finishReason };
  if (res.finishReason === "length") {
    const bigger = Math.min(16000, Math.round(maxOutputTokens * 1.5));
    try {
      const r2 = await jethroGenerateText({ system: SYSTEM, prompt, maxOutputTokens: bigger, timeoutMs, json: true });
      res = r2;
      meta = { modelId: r2.modelId, finishReason: r2.finishReason, retried: true };
    } catch { /* pakai hasil pertama (diperbaiki) */ }
  }
  let data;
  try {
    data = extractJson(res.text);
  } catch (e) {
    e.rawTail = String(res.text || '').slice(-400);
    e.rawLen = String(res.text || '').length;
    throw e;
  }
  return { data, meta, raw: res.text };
}

/** Perintah jangkar skema JSON untuk draf mingguan (dipakai validasi prompt). */
const DRAFT_PATHS_SCHEMA = '{"chapterNo":"...","fundamentalFirman":{"ref":"...","text":"..."},"kitabFokus":"...","homileticMethods":["..."],"methodMix":[{"method":"...","percent":50,"note":"..."}],"paths":[{"pathIndex":1,"dayLabel":"Minggu","title":"English Catchy Title","bacaanRef":"...","summary":"...","scriptureRef":"...","scriptureText":"...","homileticLens":["..."],"hookQuestion":"...","illustration":"...","reflection":"...","observeQ":"...","interpretQ":"...","applyQ":"...","fgdQuestions":["..."],"bridge":"...","imageStem":"","rhbSections":[{"key":"PENGANTAR","title":"Pengantar","body":"..."},{"key":"PEMBAHASAN_TEMATIS","title":"Pembahasan Tematis","body":"..."},{"key":"MAKNA_IMPLIKASI","title":"Makna & Implikasi bagi Beyonders","body":"..."},{"key":"REFLEKSI_PRIBADI","title":"Pertanyaan untuk Refleksi Pribadi","body":"..."},{"key":"DISKUSI_KELOMPOK","title":"Pertanyaan untuk Diskusi Kelompok","body":"..."}]}]}';
const DRAFT_SERMON_SCHEMA = '{"sermon":{"bigIdea":"...","teksUtama":{"ref":"...","text":"..."},"outline":{"pengantar":"...","bedahTeologis":"...","jembatan":"...","kesimpulan":"..."},"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}],"deliveryPlan":[{"method":"...","how":"..."}],"prepChecklist":["..."],"discussionFlow":["..."]}}';
const DRAFT_FULL_SCHEMA = DRAFT_PATHS_SCHEMA.slice(0, -1) + ',"sermon":' + DRAFT_SERMON_SCHEMA.slice('{"sermon":'.length);

/** Skema terstruktur (dipaksa provider) untuk 1 Path. */
const RhbSectionSchema = z.object({
  key: z.enum(['PENGANTAR', 'PEMBAHASAN_TEMATIS', 'MAKNA_IMPLIKASI', 'REFLEKSI_PRIBADI', 'DISKUSI_KELOMPOK']),
  title: z.string(),
  body: z.string(),
});
const PathObjectSchema = z.object({
  pathIndex: z.number(),
  dayLabel: z.string(),
  title: z.string(),
  summary: z.string(),
  bacaanRef: z.string(),
  scriptureRef: z.string(),
  scriptureText: z.string(),
  homileticLens: z.array(z.string()),
  hookQuestion: z.string(),
  illustration: z.string(),
  reflection: z.string(),
  observeQ: z.string(),
  interpretQ: z.string(),
  applyQ: z.string(),
  fgdQuestions: z.array(z.string()),
  bridge: z.string(),
  imageStem: z.string(),
  rhbSections: z.array(RhbSectionSchema),
});
const SermonObjectSchema = z.object({
  bigIdea: z.string(),
  teksUtama: z.object({ ref: z.string(), text: z.string() }),
  outline: z.object({
    pengantar: z.string(),
    bedahTeologis: z.string(),
    jembatan: z.string(),
    kesimpulan: z.string(),
  }),
  methods: z.array(z.string()),
  rationale: z.string(),
  summary: z.string(),
  slideOutline: z.array(z.object({ title: z.string(), bullets: z.array(z.string()), visualNote: z.string() })),
  deliveryPlan: z.array(z.object({ method: z.string(), how: z.string() })),
  prepChecklist: z.array(z.string()),
  discussionFlow: z.array(z.string()),
});
export async function generateWeekDraft(input) {
  const sm = input?.serviceMd && typeof input.serviceMd === 'object' ? input.serviceMd : null;
  const mdBlock = sm && (sm?.outline || sm?.info)
    ? [
      'MATERI ACUAN TIM (MD Service — ringkasan khotbah WAJIB setia padanya):',
      sm?.info?.tema ? `Tema: ${asStr(sm.info.tema, 200)}` : '',
      sm?.info?.teksUtama ? `Teks Utama: ${asStr(sm.info.teksUtama, 200)}` : '',
      sm?.outline?.pengantar ? `Pengantar acuan: ${asStr(sm.outline.pengantar, 1500)}` : '',
      sm?.outline?.bedahTeologis ? `Bedah acuan: ${asStr(sm.outline.bedahTeologis, 2000)}` : '',
      sm?.outline?.jembatan ? `Jembatan acuan: ${asStr(sm.outline.jembatan, 1500)}` : '',
      sm?.outline?.kesimpulan ? `Kesimpulan acuan: ${asStr(sm.outline.kesimpulan, 1000)}` : '',
      '',
    ].filter((l) => l !== '') : [];
  const HEAD = [
    'Susun draf pembelajaran satu minggu untuk komunitas pemuda (Beyonders).',
    '',
    'KONTEKS:',
    buildContext(input),
    ...teamContextBlock(input),
    ...patternBlock(input.pattern),
    ...mdBlock,
    '',
  ];
  const PATH_RULES = [
    'ATURAN (WAJIB):',
    '- Fundamental Firman adalah JANGKAR TEMA; bagian hari ini diambil progresif dari Kitab/Bagian Fokus.',
    '- Judul Path WAJIB Bahasa Inggris menarik (2-5 kata). Isi lain Bahasa Indonesia.',
    '- Field: pathIndex, dayLabel, title, summary (maks 100 karakter), bacaanRef, scriptureRef (Nats Pembimbing), scriptureText (maks 180 karakter), homileticLens (2-3), hookQuestion, illustration (1-2 ilustrasi kontekstual dunia anak muda — kuliah/kerja/kos/relasi — maks 280 karakter), reflection (maks 3 kalimat), observeQ, interpretQ, applyQ, fgdQuestions (2-3), bridge (1 kalimat), imageStem "".',
    '- dayLabel Path ke-N WAJIB hari kalender ke-N: Path 1 = Minggu, 2 = Senin, 3 = Selasa, 4 = Rabu, 5 = Kamis, 6 = Jumat, 7 = Sabtu. Jangan menerjemahkan ke bahasa lain.',
    '- rhbSections: TEPAT 5 dengan key PENGANTAR, PEMBAHASAN_TEMATIS, MAKNA_IMPLIKASI, REFLEKSI_PRIBADI, DISKUSI_KELOMPOK.',
    '- PENGANTAR: konteks "renungan tentang apa" (boleh panjang) + 1-2 ilustrasi konkret yang memperjelas inti.',
    '- REFLEKSI_PRIBADI: TEPAT 3 pertanyaan, masing-masing 1 kalimat dan berlabel konteks — "🎒 Pelajar — …?", "🎓 Mahasiswa — …?", "💼 Pekerja — …?". Menohok, tidak menghakimi.',
    '- DISKUSI_KELOMPOK: 2-3 pertanyaan beralur observasi → interpretasi → aplikasi.',
    '- PEMBAHASAN_TEMATIS & MAKNA_IMPLIKASI: body 1 paragraf kaya, WAJIB 300–600 karakter (bukan renungan kilat).',
    '- MAKNA_IMPLIKASI wajib berupa NASKAH SIAP-BACA: narasi utuh di bawah alur kaya, ditutup 2-3 kalimat yang tinggal diucapkan mentor apa adanya (direct speech, hangat).',
    '- Nada: hangat, bahasa anak muda, hormat — tidak baku-kaku, tidak kasual-berlebihan.',
    '- JAGA SANGAT RINGKAS. Jangan menambah field lain di luar skema.',
    '',
    'Balas HANYA JSON valid (padat, tanpa markdown):',
    DRAFT_PATHS_SCHEMA,
  ];
  const SERMON_RULES = [
    'ATURAN RINGKASAN KHOTBAH (WAJIB):',
    '- Turunkan dari Fundamental Firman, diarahkan ke Kitab/Bagian Fokus.',
    '- bigIdea: Inti Pesan 1 kalimat yang memaku seluruh khotbah.',
    '- teksUtama: Teks Utama sermon (Serving Day) — ref + kutipan singkat; bedakan dari Fundamental Firman (jangkar mingguan).',
    '- outline 4 bagian (pola For Service): pengantar (reframing masalah nyata vs solusi sementara), bedahTeologis (bedah ayat per frasa, doktrin eksplisit), jembatan (kaitkan Teks Utama ke tema mingguan/Jangkar, 2-3 poin), kesimpulan (NASKAH SIAP-BACA direct speech, hangat, 1 paragraf).',
    '- methods: PILIH SENDIRI 2-3 metode paling cocok dari: ' + HOMILETIC_METHODS.join('; ') + '. rationale: kenapa tiap metode dipilih, merujuk bagian outline yang ditajamkannya.',
    '- summary: RINGKASAN PANJANG mengikuti pola For Service (±600–900 kata): (1) Pengantar — realita + asumsi yang dibongkar; (2) Bedah Teologis — 2-4 poin, tiap poin: kutip ayat + makna + luruskan salah paham + 1 kalimat key-takeaway untuk anak muda; (3) Jembatan — kaitkan Teks Utama ke Fundamental Firman/tema mingguan (2-3 poin); (4) Kesimpulan panggung — NASKAH SIAP-BACA direct speech yang hangat. Naratif, kontekstual untuk pemuda/anak rantau, enak dibaca keras.',
    '- slideOutline: 6-8 slide (title, bullets 2-4). JANGAN sertakan visualNote/arahan visual (diisi terpisah).',
    '- deliveryPlan: satu baris per metode.',
    '- prepChecklist (4-6 item) dan discussionFlow (4-6 langkah).',
    '',
    'Balas HANYA JSON valid (padat, tanpa markdown):',
    DRAFT_SERMON_SCHEMA,
  ];

  const focus = asStr(input.kitabFokus);
  const onePathPrompt = (i, extra) => [
    ...HEAD,
    `TUGAS: buat Path ke-${i} dari 7 (hari ${DAY_LABELS[i - 1]}).`,
    focus ? `Kitab/bagian fokus: ${focus} — tentukan porsi hari ke-${i} secara progresif.` : '',
    extra || '',
    ...PATH_RULES.slice(0, -2),
  ].filter(Boolean).join('\n');

  const results = new Array(7).fill(null);
  const pathMetas = [];
  const genOne = async (i, used) => {
    try {
      const dup = used.length ? `Judul yang SUDAH DIPAKAI (jangan diulang): ${used.join(' | ')}.` : '';
      const { object, modelId, finishReason } = await jethroGenerateObject({ system: SYSTEM, prompt: onePathPrompt(i, dup), schema: PathObjectSchema, maxOutputTokens: 4500, timeoutMs: 30000 });
      pathMetas.push({ pathIndex: i, modelId: modelId || null, finishReason: finishReason || null });
      if (object && Array.isArray(object.rhbSections) && object.rhbSections.length >= 3) {
        // dayLabel SELALU dari kalender (Path 1 = Minggu) — jangan percaya model.
        results[i - 1] = { ...object, pathIndex: i, dayLabel: DAY_LABELS[i - 1] };
      }
    } catch (err) {
      console.error('[didaskalia-ai] path', i, 'gagal:', err?.message || err);
      pathMetas.push({ pathIndex: i, modelId: null, finishReason: 'error', error: String(err?.message || err).slice(0, 200) });
    }
  };

  // Gelombang 1: Path 1-4 paralel; Gelombang 2: Path 5-7 (judul menghindari yang sudah dipakai).
  const usedTitles = [];
  await Promise.all([1, 2, 3, 4].map((i) => genOne(i, [])));
  results.forEach((p) => { if (p?.title) usedTitles.push(String(p.title)); });
  await Promise.all([5, 6, 7].map((i) => genOne(i, usedTitles)));

  const retry = results.map((p, i) => (p ? null : i + 1)).filter(Boolean);
  for (const idx of retry) {
    await genOne(idx, usedTitles);
  }

  const paths = results.map((p, i) => p || { pathIndex: i + 1, dayLabel: DAY_LABELS[i] });
  const outline = paths.map((p, i) => `Path ${i + 1}: ${asStr(p.title)}`).join('\n');
  let sermon = {};
  let sermonMeta = { modelId: null, finishReason: null };
  try {
    const { object, modelId, finishReason } = await jethroGenerateObject({
      system: SYSTEM,
      prompt: [...HEAD, `KERANGKA 7 PATH:\n${outline}`, ...SERMON_RULES.slice(0, -2)].join('\n'),
      schema: SermonObjectSchema,
      maxOutputTokens: 9000,
      timeoutMs: 60000,
    });
    sermon = object || {};
    sermonMeta = { modelId: modelId || null, finishReason: finishReason || null };
  } catch (e) {
    console.error('[didaskalia-ai] ringkasan khotbah gagal:', e?.message || e);
    sermonMeta = { modelId: null, finishReason: 'error', error: String(e?.message || e).slice(0, 200) };
  }

  const DEFAULT_METHODS = ['Teologi Praktika / Pastoral', 'Pengajaran Tematika', 'Teologi Biblika'];
  const picked = Array.isArray(input.methods) ? input.methods.filter(Boolean).slice(0, 3) : [];
  // Bila tim tidak mengunci metode, pakai pilihan AI dari ringkasan (bebas pilih);
  // bila AI pun kosong, baru fallback default.
  const aiPicked = Array.isArray(sermon.methods)
    ? sermon.methods.map((m) => asStr(m)).filter((m) => HOMILETIC_METHODS.includes(m)).slice(0, 3)
    : [];
  const methods = picked.length ? picked : (aiPicked.length ? aiPicked : DEFAULT_METHODS);
  const methodMix = methods.map((m) => ({ method: m, percent: Math.round(100 / methods.length), note: '' }));

  const out = clampDraft({
    chapterNo: input.chapterNo || "",
    fundamentalFirman: input.fundamentalFirman || { ref: "", text: "" },
    kitabFokus: input.kitabFokus || "",
    homileticMethods: methods,
    methodMix,
    paths,
    sermon,
  });
  // Meta diagnosis (non-enumerable: tidak ikut tersimpan ke DB).
  const failedPaths = pathMetas.filter((m) => m.finishReason === 'error').map((m) => m.pathIndex);
  Object.defineProperty(out, '_meta', {
    value: {
      kind: 'draft',
      models: [...new Set([...pathMetas.map((m) => m.modelId), sermonMeta.modelId].filter(Boolean))],
      truncated: [...pathMetas.map((m) => m.finishReason), sermonMeta.finishReason].includes('length'),
      failedPaths,
      sermon: sermonMeta,
      promptChars: HEAD.join('\n').length,
    },
    enumerable: false,
  });
  return out;
}
/**
 * Tahap 2 — perkaya draf yang sudah ada dengan diskusi internal tim.
 * Tidak membuang struktur; hanya menajamkan/ memperdalam isi.
 */
/** Batas catatan diskusi per panggilan enrich (agar muat limit model kecil). */
export const ENRICH_NOTES_CAP = 8000;

const ENRICH_PATH_RULES = [
  'ATURAN (WAJIB):',
  '- JANGAN mengubah struktur: tetap 5 rhbSections dengan key yang sama.',
  '- dayLabel WAJIB hari kalender path ini (Path 1 = Minggu … Path 7 = Sabtu). Jangan menerjemahkan ke bahasa lain.',
  '- DILARANG mengosongkan field yang sudah terisi: setiap body RHB dan field Path WAJIB terisi penuh; bila ragu, tulis ulang sama kaya atau lebih kaya — JANGAN string kosong.',
  '- Pertajam: judul Path (tetap Bahasa Inggris, kece), bacaanRef (progresif dari Kitab Fokus), scriptureRef (Nats Pembimbing), dan SEMUA body rhbSections (masing-masing 300–600 karakter; MAKNA_IMPLIKASI = naskah siap-baca direct speech).',
  '- Pastikan tiap metode benar-benar menajamkan Fundamental Firman.',
  '- Integrasikan masukan dari "Catatan tim/diskusi" (jangan diabaikan).',
  '- Bahasa Indonesia hangat & kontekstual; hanya judul Path dalam Bahasa Inggris.',
];

const ENRICH_SERMON_RULES = [
  'ATURAN RINGKASAN KHOTBAH (WAJIB):',
  '- Perdalam summary mengikuti pola For Service (±600–900 kata): pengantar (realita + asumsi dibongkar), bedah teologis 2-4 poin (kutip + makna + luruskan salah paham + key-takeaway), jembatan ke Fundamental Firman/tema, kesimpulan panggung direct-speech. Perdalam pula outline 4 bagian, rationale, dan slideOutline (6-8 slide) dari versi saat ini.',
  '- methods: 2-3 metode; deliveryPlan satu baris per metode selaras POLA IBADAH; prepChecklist 4-6; discussionFlow 4-6 mengikuti POLA.',
  '- DILARANG mengosongkan field yang sudah terisi.',
];

export async function generateEnrichedDraft(input) {
  const current = input.current && typeof input.current === 'object' ? input.current : {};
  // Cap catatan (transparan via meta) agar tiap panggilan muat limit model kecil.
  const fullNotes = asStr(input.notes);
  const notesDropped = Math.max(0, fullNotes.length - ENRICH_NOTES_CAP);
  const cappedNotes = notesDropped > 0 ? fullNotes.slice(0, ENRICH_NOTES_CAP) : fullNotes;
  const ctxInput = { ...input, notes: cappedNotes };

  const HEAD = [
    'PERKAYA (revisi kedua) SATU HARI pembelajaran untuk komunitas pemuda (Beyonders).',
    '',
    'KONTEKS PEKAN:',
    buildContext(ctxInput),
    ...teamContextBlock(ctxInput),
    ...patternBlock(ctxInput.pattern),
    '',
    'ALUR PEMIKIRAN (WAJIB):',
    '- Fundamental Firman = jangkar tema; Kitab/Bagian Fokus dibagi 7 hari sebagai Bacaan Alkitab; tiap hari punya Nats Pembimbing.',
    '- Setiap metode (sesuai persentase) harus menajamkan & memperdalam Fundamental Firman.',
    '- Jaga KESINAMBUNGAN: Path 1 menyambung dari MINGGU LALU, Path 7 menjembatani MINGGU DEPAN (lihat konteks).',
    '',
  ];

  const curPaths = Array.isArray(current.paths) ? current.paths : [];
  const results = new Array(7).fill(null);
  const pathMetas = [];
  let promptChars = 0;
  const genOne = async (i) => {
    const cur = curPaths[i - 1] && typeof curPaths[i - 1] === 'object' ? curPaths[i - 1] : {};
    const prompt = [...HEAD,
      `TUGAS: perkaya Path ke-${i} dari 7 (hari ${DAY_LABELS[i - 1]} — dayLabel WAJIB tepat itu, jangan terjemahkan).`,
      `DRAF PATH SAAT INI (JSON lengkap — pertahankan semua field, perdalam isinya):\n${JSON.stringify(cur)}`,
      ...ENRICH_PATH_RULES,
    ].filter(Boolean).join('\n');
    promptChars += prompt.length;
    try {
      const { object, modelId, finishReason } = await jethroGenerateObject({ system: SYSTEM, prompt, schema: PathObjectSchema, maxOutputTokens: 3000, timeoutMs: 30000 });
      pathMetas.push({ pathIndex: i, modelId: modelId || null, finishReason: finishReason || null });
      if (object && Array.isArray(object.rhbSections) && object.rhbSections.length >= 3) {
        // dayLabel SELALU dari kalender (Path 1 = Minggu) — jangan percaya model.
        results[i - 1] = { ...object, pathIndex: i, dayLabel: DAY_LABELS[i - 1] };
      } else {
        pathMetas.push({ pathIndex: i, modelId: modelId || null, finishReason: 'empty', error: 'Keluaran path kosong/tak lengkap — dipakai draf lama.' });
        results[i - 1] = cur;
      }
    } catch (err) {
      console.error('[didaskalia-ai] enrich path', i, 'gagal:', err?.message || err);
      pathMetas.push({ pathIndex: i, modelId: null, finishReason: 'error', error: String(err?.message || err).slice(0, 200) });
      results[i - 1] = cur;
    }
  };

  // Gelombang 1: Path 1-4 paralel; Gelombang 2: Path 5-7.
  await Promise.all([1, 2, 3, 4].map((i) => genOne(i)));
  await Promise.all([5, 6, 7].map((i) => genOne(i)));

  // Ringkasan khotbah: satu panggilan terpisah (jauh lebih kecil dari sebelumnya).
  let sermon = (current.sermon && typeof current.sermon === 'object') ? current.sermon : {};
  let sermonMeta = { modelId: null, finishReason: null };
  try {
    const enrichedTitles = results.map((p, i) => `Path ${i + 1}: ${asStr(p?.title)}`).join('\n');
    const sermonPrompt = [...HEAD,
      `RINGKASAN KHOTBAH SAAT INI (JSON — perdalam, jangan kosongkan):\n${JSON.stringify(sermon)}`,
      `KERANGKA 7 PATH (hasil perkaya):\n${enrichedTitles}`,
      ...ENRICH_SERMON_RULES,
    ].filter(Boolean).join('\n');
    promptChars += sermonPrompt.length;
    const { object, modelId, finishReason } = await jethroGenerateObject({
      system: SYSTEM, prompt: sermonPrompt, schema: SermonObjectSchema, maxOutputTokens: 8000, timeoutMs: 60000,
    });
    sermonMeta = { modelId: modelId || null, finishReason: finishReason || null };
    if (object && (asStr(object.summary) || (Array.isArray(object.slideOutline) && object.slideOutline.length))) {
      sermon = object;
    } else {
      sermonMeta = { ...sermonMeta, finishReason: 'empty', error: 'Keluaran khotbah kosong — dipakai draf lama.' };
    }
  } catch (e) {
    console.error('[didaskalia-ai] enrich khotbah gagal:', e?.message || e);
    sermonMeta = { modelId: null, finishReason: 'error', error: String(e?.message || e).slice(0, 200) };
  }

  const failedPaths = pathMetas.filter((m) => m.finishReason === 'error').map((m) => m.pathIndex);
  const truncatedPaths = pathMetas.filter((m) => m.finishReason === 'length').map((m) => m.pathIndex);
  if (failedPaths.length >= 7 && sermonMeta.finishReason === 'error') {
    throw new Error(`AI gagal memperkaya draf: semua 7 Path + khotbah gagal (${pathMetas[0]?.error || sermonMeta.error || 'unknown'}). Coba lagi atau kecilkan catatan.`);
  }
  const out = clampDraft({
    chapterNo: input.chapterNo ?? current.chapterNo ?? '',
    fundamentalFirman: input.fundamentalFirman ?? current.fundamentalFirman ?? { ref: '', text: '' },
    kitabFokus: input.kitabFokus ?? current.kitabFokus ?? '',
    homileticMethods: current.homileticMethods || [],
    methodMix: current.methodMix || [],
    paths: results,
    sermon,
  });
  // Meta diagnosis (non-enumerable: tidak ikut tersimpan ke DB).
  Object.defineProperty(out, '_meta', {
    value: {
      kind: 'enrich',
      models: [...new Set([...pathMetas.map((m) => m.modelId), sermonMeta.modelId].filter(Boolean))],
      truncated: truncatedPaths.length > 0,
      truncatedPaths,
      failedPaths,
      sermon: sermonMeta,
      notesDropped,
      promptChars,
    },
    enumerable: false,
  });
  return out;
}

/**
 * Jaring pengaman: lengkapi Bagian A/B (deliveryPlan, prepChecklist, discussionFlow)
 * bila draf utama tidak mengisinya.
 */
export async function generateWeekExtras(input) {
  const prompt = [
    'Lengkapi BAGIAN A & B untuk modul pembekalan minggu ini (Bahasa Indonesia).',
    '',
    'KONTEKS:',
    buildContext(input),
    ...teamContextBlock(input),
    ...patternBlock(input.pattern),
    input.pathsOutline ? `Kerangka 7 Path:\n${asStr(input.pathsOutline)}` : '',
    '',
    'ATURAN:',
    '- deliveryPlan: 2-4 baris, tiap metode yang dipakai (lihat methodMix) dengan cara praktis menyampaikannya — selaraskan dengan POLA IBADAH minggu ini.',
    '- prepChecklist: 4-6 langkah konkret persiapan khotbah.',
    '- discussionFlow: 4-6 langkah alur diskusi hari Minggu MENGIKUTI POLA IBADAH (FGD hanya untuk MONOLOG; Post-to-Post = rute kunjungan; pola lain = alurnya masing-masing), spesifik tema ini (bukan generik).',
    '- Kontekstual untuk mahasiswa & pekerja muda.',
    '',
    'Balas HANYA JSON valid: {"deliveryPlan":[{"method":"...","how":"..."}],"prepChecklist":["..."],"discussionFlow":["..."]}',
  ].filter(Boolean).join('\n');
  const { data: d } = await generateJson({ prompt, maxOutputTokens: 3000, timeoutMs: 30000 });
  const plan = Array.isArray(d.deliveryPlan) ? d.deliveryPlan : [];
  return {
    deliveryPlan: plan
      .slice(0, 7)
      .map((x) => ({ method: asStr(x?.method), how: asStr(x?.how) }))
      .filter((x) => x.method || x.how),
    prepChecklist: asStrArray(d.prepChecklist, 10),
    discussionFlow: asStrArray(d.discussionFlow, 8),
  };
}

/**
 * Susun/segarkan Ringkasan Khotbah saja (untuk mode serving group).
 * Bila `input.serviceMd` (hasil parseServiceMd) tersedia, MD menjadi acuan
 * utama 4 outline; bila tidak, AI menyusun dari konteks + pola lama.
 * Bila `input.methods` kosong, AI memilih sendiri 2-3 metode.
 */
export async function generateSermon(input) {
  const sm = input?.serviceMd && typeof input.serviceMd === 'object' ? input.serviceMd : null;
  const mdBlock = sm && (sm?.outline || sm?.info)
    ? [
      'MATERI ACUAN TIM (MD Service — ikuti setia, jangan karang ulang faktanya):',
      sm?.info?.tema ? `Tema: ${asStr(sm.info.tema, 200)}` : '',
      sm?.info?.teksUtama ? `Teks Utama: ${asStr(sm.info.teksUtama, 200)}` : '',
      sm?.info?.teksJangkar ? `Teks Jangkar: ${asStr(sm.info.teksJangkar, 200)}` : '',
      sm?.outline?.pengantar ? `Pengantar acuan:\n${asStr(sm.outline.pengantar, 3000)}` : '',
      sm?.outline?.bedahTeologis ? `Bedah teologis acuan:\n${asStr(sm.outline.bedahTeologis, 4000)}` : '',
      sm?.outline?.jembatan ? `Jembatan acuan:\n${asStr(sm.outline.jembatan, 3000)}` : '',
      sm?.outline?.kesimpulan ? `Kesimpulan acuan:\n${asStr(sm.outline.kesimpulan, 2000)}` : '',
      '',
    ].filter((l) => l !== '') : [];
  const locked = Array.isArray(input.methods) ? input.methods.filter(Boolean).slice(0, 3) : [];
  const prompt = [
    'Susun RINGKASAN KHOTBAH dan kerangka presentasi (slide) untuk satu minggu pemuda.',
    '',
    'KONTEKS:',
    buildContext(input),
    ...teamContextBlock(input),
    ...patternBlock(input.pattern),
    ...mdBlock,
    input.pathsOutline ? `Kerangka 7 Path yang sudah ada:\n${asStr(input.pathsOutline)}` : '',
    '',
    'ATURAN:',
    '- bigIdea: Inti Pesan 1 kalimat.',
    '- teksUtama: Teks Utama sermon (ref + kutipan singkat); bedakan dari Fundamental Firman.',
    '- outline 4 bagian (pengantar, bedahTeologis, jembatan, kesimpulan direct speech). Bila MD acuan ada, setia padanya; bila tidak, susun dari konteks + pola lama dalam koridor Reformed kontekstual persona.',
    '- Bedah Teologis: 2-4 poin, tiap poin kutip frasa + makna + luruskan satu salah paham + 1 kalimat key-takeaway untuk anak muda.',
    '- Kesimpulan panggung: NASKAH SIAP-BACA direct speech yang hangat, siap diucapkan apa adanya.',
    locked.length
      ? `- Gunakan metode yang dikunci tim: ${locked.join(', ')}.`
      : `- PILIH SENDIRI 2-3 metode paling cocok dari: ${HOMILETIC_METHODS.join('; ')}.`,
    '- rationale: kenapa tiap metode dipilih + bagian outline mana yang ditajamkannya.',
    '- summary: RINGKASAN PANJANG mengikuti pola For Service (±600–900 kata): pengantar, bedah teologis 2-4 poin + key-takeaway, jembatan ke Fundamental Firman/tema, kesimpulan panggung direct-speech. Kontekstual untuk pemuda/anak rantau.',
    '- slideOutline: 6-10 slide (title, bullets 2-5, visualNote untuk arahan gambar).',
    '- deliveryPlan satu baris per metode; prepChecklist 4-6; discussionFlow 4-6 mengikuti POLA.',
    '- Bahasa Indonesia yang hangat dan jelas.',
    '',
    'Balas HANYA JSON valid: {"bigIdea":"...","teksUtama":{"ref":"...","text":"..."},"outline":{"pengantar":"...","bedahTeologis":"...","jembatan":"...","kesimpulan":"..."},"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}]}',
  ].filter(Boolean).join('\n');

  const { data } = await generateJson({ prompt, maxOutputTokens: 9000, timeoutMs: 60000 });
  const out = clampSermon(data);
  if (!locked.length && out.methods.length) {
    // AI memilih sendiri — pakai pilihannya.
  } else if (locked.length) {
    out.methods = locked;
  }
  return out;
}

/**
 * Isi draft sesi hari-H dari konteks pekan (tema + firman + RHB + khotbah).
 * POST_TO_POST → terstruktur penuh (topik, 9 Likert, 12 chip, afirmasi).
 * Pola lain → nilai per kunci template kosongan (generic, tetap direview per baris).
 * Keluaran = USULAN; penerapan ke sesi dijaga guard status di route.
 */
const SessionExegesisSchema = z.object({
  points: z.array(z.string()).max(5),
  implications: z.array(z.string()).max(4),
});
const SessionPostToPostSchema = z.object({
  exegesis: SessionExegesisSchema,
  topics: z.array(z.object({ code: z.string(), label: z.string(), pic: z.string() })).max(3),
  items: z.array(z.object({ topicCode: z.string(), text: z.string(), gospelNote: z.string() })).max(12),
  chips: z.array(z.object({ code: z.string(), label: z.string(), topicCode: z.string().nullable() })).max(16),
  affirmations: z.array(z.object({ topicCode: z.string(), lines: z.array(z.string()).max(4) })).max(6),
  timerSeconds: z.number(),
});
const SessionValuesSchema = z.object({
  exegesis: SessionExegesisSchema,
  values: z.array(z.object({ key: z.string(), value: z.string() })).max(40),
});

/** Clamp eksegesis (poin inti + implikasi) agar selalu berbentuk aman. */
function clampExegesis(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const lines = (v, n) => (Array.isArray(v) ? v : []).map((x) => asStr(x)).filter(Boolean).slice(0, n);
  return { points: lines(o.points, 5), implications: lines(o.implications, 4) };
}

/**
 * Peran dua perikop studio: Fundamental Firman = jangkar tema (semua slot
 * solusi wajib merujuk eksplisit); Kitab Fokus = bahan bacaan & pendalaman.
 */
function pericopeBlock(input) {
  const ref = asStr(input?.fundamentalFirman?.ref);
  const focus = asStr(input?.kitabFokus);
  if (!ref && !focus) return [];
  return [
    'PERAN DUA PERIKOP (WAJIB DIBEDAKAN, JANGAN TERTUKAR):',
    ref ? `- Fundamental Firman ${ref} = JANGKAR TEMA: setiap slot bernada solusi (gospelNote, afirmasi, Trap Reveal, komitmen, pancingan pleno) WAJIB merujuk eksplisit ke ayat ini (sebutkan ref-nya).` : '',
    focus ? `- Kitab/bagian fokus ${focus} = BAHAN BACAAN & PENDALAMAN: dipakai untuk bacaan, pertanyaan observasi, sandi Kode Alkitab, studi kasus, dan adegan paralel film.` : '',
  ].filter(Boolean);
}

export async function generateSessionDraft(input) {
  const code = String(input?.pattern?.code || input?.patternCode || 'MONOLOG').toUpperCase() || 'MONOLOG';
  const head = [
    'Susun ISI SESI HARI-H untuk pola ibadah berikut (Bahasa Indonesia).',
    '',
    'KONTEKS PEKAN (pembekalan + RHB + khotbah sudah disusun dari bahan ini):',
    buildContext(input),
    ...pericopeBlock(input),
    ...teamContextBlock(input),
    ...patternBlock(input.pattern),
    input.pathsOutline ? `Kerangka 7 Path:\n${asStr(input.pathsOutline)}` : '',
    input.sermonSummary ? `Ringkasan khotbah:\n${asStr(input.sermonSummary).slice(0, 1500)}` : '',
    '',
  ].filter(Boolean);

  const EXEGESIS_RULES = [
    'LANGKAH 1 — EKSEGESIS (wajib dulu): dari teks Fundamental Firman + Kitab Fokus, rumuskan 3-5 poin inti perikop + 2-3 implikasi konkret bagi Beyonders (mahasiswa/pekerja muda Cikarang).',
    'LANGKAH 2 — SLOT POLA: kembangkan HANYA dari poin eksegesis langkah 1 (tiap slot lahir dari poin nomor berapa).',
    'ANTI-CONTOH: contoh di skenario pola (film/judul default, tokoh bungsu-sulung, mosi/amplop bawaan) adalah ILUSTRASI — DILARANG memakai ulang kecuali justifikasi kecocokannya dengan perikop ditulis eksplisit.',
    'KONTEKSTUAL: Likert/FGD/mosi/kasus WAJIB menyebut situasi konkret Beyonders (KRS, skripsi, magang, shift, lembur, target, kos, keuangan awal, relasi Cikarang) — tolak yang generik.',
    'KHUSUS FILM: kunci film-alt WAJIB berisi 2 kandidat lain + alasan kecocokan tiap film dengan perikop; film-title = pilihan utama yang paling cocok.',
  ];

  if (code === 'POST_TO_POST') {
    const prompt = [...head,
      'ATURAN (WAJIB):',
      ...EXEGESIS_RULES,
      '- topics: TEPAT 3 dengan code WAJIB HUBUNGAN, PEKERJAAN, KELUARGA (urutan itu, jangan diubah/diganti); label boleh disesuaikan tema; pic = NAMA orang PIC pos (bukan nama file).',
      '- items: TEPAT 9 (3 per topik, urut per topik); text = pernyataan Likert skala 1-5 dari pergumulan nyata mahasiswa/pekerja seputar tema (pola "Saya merasa/cenderung/sulit ..."); gospelNote = solusi 1 kalimat yang merujuk EKSPLISIT ke Fundamental Firman (sebutkan ref-nya).',
      '- chips: 10-12 chip kata pelajaran format #Kata (maks 3 dipilih per peserta), sebar ke 3 topik + 1 umum.',
      '- affirmations: TEPAT 3 kalimat peneguh per code topik, berakar pada Fundamental Firman (sebutkan ref-nya).',
      '- timerSeconds: 1200 bila tidak ada alasan mengubah.',
      '- Jangan pernah mengeluarkan teks {{...}} apa pun; selalu tulis ref, tema, dan kitab yang sebenarnya.',
      '',
      'Balas HANYA JSON valid sesuai skema.',
    ].join('\n');
    const { object } = await jethroGenerateObject({ system: SYSTEM, prompt, schema: SessionPostToPostSchema, maxOutputTokens: 5000, timeoutMs: 40000 });
    const o = object || {};
    const topics = (Array.isArray(o.topics) ? o.topics : []).slice(0, 3).map((x) => ({
      code: asStr(x?.code).toUpperCase().slice(0, 40),
      label: asStr(x?.label).slice(0, 120),
      pic: asStr(x?.pic).slice(0, 120),
    })).filter((x) => x.code && x.label);
    const items = (Array.isArray(o.items) ? o.items : []).slice(0, 9).map((x) => ({
      topicCode: asStr(x?.topicCode).toUpperCase().slice(0, 40),
      text: asStr(x?.text),
      gospelNote: asStr(x?.gospelNote),
    })).filter((x) => x.topicCode && x.text);
    const chips = (Array.isArray(o.chips) ? o.chips : []).slice(0, 12).map((x) => ({
      code: asStr(x?.code).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 40),
      label: asStr(x?.label).slice(0, 80),
      topicCode: asStr(x?.topicCode).toUpperCase().slice(0, 40) || null,
    })).filter((x) => x.code && x.label);
    const affirmations = {};
    for (const a of (Array.isArray(o.affirmations) ? o.affirmations : [])) {
      const k = asStr(a?.topicCode).toUpperCase().slice(0, 40);
      if (k) affirmations[k] = asStrArray(a?.lines, 3);
    }
    return { kind: 'POST_TO_POST', exegesis: clampExegesis(o.exegesis), topics, items, chips, affirmations, timerSeconds: Number(o.timerSeconds) > 0 ? Math.round(Number(o.timerSeconds)) : 1200 };
  }

  const fieldKeys = Array.isArray(input.fieldKeys) ? input.fieldKeys : [];
  const hasFgd = fieldKeys.some((f) => String(f.key || '').toLowerCase().startsWith('fgd-'));
  const FGD_RULES = hasFgd ? [
    'ATURAN FGD (TEPAT 3 PERTANYAAN, WAJIB):',
    '- fgd-observe (Q1): observasi dari Teks Utama + 1 analogi/ilustrasi konkret dunia Beyonders (KRS, skripsi, shift, lembur, kos, keuangan awal).',
    '- fgd-interpret (Q2): interpretasi yang mengaitkan Bedah Teologis pekan ini.',
    '- fgd-apply (Q3): SATU langkah nyata, konkret dan terukur minggu ini.',
    '- Tiap Q 1-2 kalimat. Yang menjawab lisan cukup 1-2 perwakilan bergiliran per Q; semua mentee WAJIB menulis catatannya sendiri.',
  ] : [];
  const hasSong = fieldKeys.some((f) => String(f.key || '').toLowerCase().startsWith('song-'));
  const SONG_RULES = hasSong ? [
    'ATURAN BEDAH LAGU (ANTI-NGARANG, WAJIB):',
    '- Pilih TEPAT 1 lagu dari buku himne KJ, NKB, atau NNBT saja. Tulis song-book-ref dengan format "KJ 10" / "NKB 5" / "NNBT 17" (nama buku + nomor).',
    '- DILARANG mengarang judul, nomor, atau pencipta. song-writer = nama pencipta bila yakin, else KOSONGKAN (jangan isi nama penyanyi/musik).',
    '- Contoh jebakan: "Mengikut Yesus Keputusanku" BUKAN KJ/NKB (ia KK 399 / KPPK 214) — jangan pernah diklaim sebagai KJ/NKB/NNBT.',
    '- song-story: 2-4 kalimat kisah/sejarah di balik lagu + 1-2 kalimat kaitan eksplisit ke Fundamental Firman pekan (sebutkan ref-nya); akhiri dengan "(perlu verifikasi tim)".',
    '- song-about: makna tiap bait, 1 kalimat per bait.',
    '- Bila tak yakin ada lagu yang cocok: KOSONGKAN semua kunci song-* (jangan diada-ada).',
  ] : [];
  const prompt = [...head,
    'ATURAN (WAJIB):',
    ...EXEGESIS_RULES,
    ...FGD_RULES,
    ...SONG_RULES,
    '- Isi SEMUA kunci template berikut (kecuali yang benar-benar tak relevan) dengan 1-3 kalimat spesifik tema & firman pekan (bukan generik).',
    '- Slot bernada solusi (komitmen, reveal, pancingan, afirmasi) WAJIB merujuk eksplisit ke Fundamental Firman; slot bacaan/observasi memakai Kitab Fokus.',
    '- Jangan pernah mengeluarkan teks {{...}} apa pun (mis. {{firman_ref}}); selalu tulis ref, tema, dan kitab yang sebenarnya.',
    '- Kunci yang tidak relevan boleh dilewatkan (jangan diada-ada).',
    'KUNCI TEMPLATE:',
    ...fieldKeys.slice(0, 40).map((f) => `- ${f.key}: ${f.label || ''}`),
    '',
    'Balas HANYA JSON valid: {"values":[{"key":"...","value":"..."}]}',
  ].join('\n');
  const { object } = await jethroGenerateObject({ system: SYSTEM, prompt, schema: SessionValuesSchema, maxOutputTokens: 4000, timeoutMs: 35000 });
  const known = new Set(fieldKeys.map((f) => f.key));
  const values = (Array.isArray(object?.values) ? object.values : [])
    .filter((v) => known.has(asStr(v?.key)) && asStr(v?.value))
    .slice(0, 40)
    .map((v) => ({ key: asStr(v.key), value: asStr(v.value).slice(0, 2000) }));
  return { kind: 'GENERIC', exegesis: clampExegesis(object?.exegesis), values };
}

/**
 * Perbaiki satu bagian tertentu (mis. satu Path atau ringkasan).
 */
export async function refineField({ fieldLabel = '', current = '', instruction = '', context = '', teamInstruction = '' } = {}) {
  const prompt = [
    `Perbaiki bagian "${asStr(fieldLabel)}" berikut.`,
    teamInstruction ? `Instruksi khusus tim: ${asStr(teamInstruction)}` : '',
    context ? `Konteks:\n${asStr(context)}` : '',
    `Teks saat ini:\n${asStr(current)}`,
    `Instruksi: ${asStr(instruction) || 'Buat lebih jelas, hangat, dan mudah dipahami pemuda.'}`,
    '',
    'Balas HANYA dengan teks hasil perbaikan (tanpa tanda kutip pembuka/penutup, tanpa penjelasan).',
  ].filter(Boolean).join('\n');

  const { text } = await jethroGenerateText({ system: SYSTEM, prompt, maxOutputTokens: 2000, timeoutMs: 30000 });
  return String(text || '').trim();
}
