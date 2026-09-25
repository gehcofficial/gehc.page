/**
 * Didaskalia Studio — lapisan AI untuk menyusun 7 Path, Ringkasan Khotbah,
 * dan pembekalan mentor/co-mentor. Memakai provider yang sama dengan Jethro
 * (server/ai-provider.mjs: OpenAI primary, Groq fallback).
 *
 * Prinsip: keluaran AI adalah USULAN. Manusia tetap menyunting & menyetujui.
 */
import { jethroGenerateText } from '../ai-provider.mjs';

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
      return JSON.parse(candidate);
    } catch {
      // Potong ke pemisah elemen terakhir sebelumnya.
      const cut = Math.max(body.lastIndexOf('},'), body.lastIndexOf('],'), body.lastIndexOf(','), body.lastIndexOf('}'));
      if (cut < 0) break;
      body = body.slice(0, cut + 1);
    }
  }
  // Terakhir: coba apa adanya dengan penutup.
  try { return JSON.parse(closeOpen(body)); } catch { return null; }
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
    } catch (e) {
      const repaired = repairJson(raw);
      if (repaired) return repaired;
      throw new Error(`JSON tidak valid: ${e.message}`);
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
  return {
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

/** Panggil AI & parse JSON dengan penjagaan: cap token, retry bila terpotong, repair. */
async function generateJson({ prompt, maxOutputTokens = 6000, timeoutMs = 45000 }) {
  let res = await jethroGenerateText({ system: SYSTEM, prompt, maxOutputTokens, timeoutMs });
  let meta = { modelId: res.modelId, finishReason: res.finishReason };
  if (res.finishReason === "length") {
    const bigger = Math.min(16000, Math.round(maxOutputTokens * 1.5));
    try {
      const r2 = await jethroGenerateText({ system: SYSTEM, prompt, maxOutputTokens: bigger, timeoutMs });
      res = r2;
      meta = { modelId: r2.modelId, finishReason: r2.finishReason, retried: true };
    } catch { /* pakai hasil pertama (diperbaiki) */ }
  }
  return { data: extractJson(res.text), meta };
}

const DRAFT_PATHS_SCHEMA = '{"chapterNo":"...","fundamentalFirman":{"ref":"...","text":"..."},"kitabFokus":"...","homileticMethods":["..."],"methodMix":[{"method":"...","percent":50,"note":"..."}],"paths":[{"pathIndex":1,"dayLabel":"Minggu","title":"English Catchy Title","bacaanRef":"...","summary":"...","scriptureRef":"...","scriptureText":"...","homileticLens":["..."],"hookQuestion":"...","illustration":"...","reflection":"...","observeQ":"...","interpretQ":"...","applyQ":"...","fgdQuestions":["..."],"bridge":"...","imageStem":"","rhbSections":[{"key":"PENGANTAR","title":"Pengantar","body":"..."},{"key":"PEMBAHASAN_TEMATIS","title":"Pembahasan Tematis","body":"..."},{"key":"MAKNA_IMPLIKASI","title":"Makna & Implikasi bagi Beyonders","body":"..."},{"key":"REFLEKSI_PRIBADI","title":"Pertanyaan untuk Refleksi Pribadi","body":"..."},{"key":"DISKUSI_KELOMPOK","title":"Pertanyaan untuk Diskusi Kelompok","body":"..."}]}]}';
const DRAFT_SERMON_SCHEMA = '{"sermon":{"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}],"deliveryPlan":[{"method":"...","how":"..."}],"prepChecklist":["..."],"discussionFlow":["..."]}}';
const DRAFT_FULL_SCHEMA = DRAFT_PATHS_SCHEMA.slice(0, -1) + ',"sermon":' + DRAFT_SERMON_SCHEMA.slice('{"sermon":'.length);
export async function generateWeekDraft(input) {
  const HEAD = [
    'Susun draf pembelajaran satu minggu untuk komunitas pemuda (Beyonders).',
    '',
    'KONTEKS:',
    buildContext(input),
    ...teamContextBlock(input),
    '',
  ];
  const PATHS_RULES = [
    'ATURAN 7 PATH (WAJIB):',
    '- Fundamental Firman (ayat) adalah JANGKAR TEMA; Kitab/Bagian Fokus dibagi 7 hari berurutan (Path 1 - 7).',
    '- URUTAN HARI: Path 1 = MINGGU (hari khotbah) - Path 2 = Senin - ... - Path 7 = Sabtu.',
    '- Judul tiap Path WAJIB Bahasa Inggris menarik (2-5 kata). Isi lain Bahasa Indonesia.',
    '- Tiap Path: title, summary (maks 100 karakter), bacaanRef (rentang Kitab Fokus progresif), scriptureRef (Nats Pembimbing), scriptureText (maks 200 karakter), homileticLens (2-3 metode), hookQuestion, illustration (maks 150 karakter), reflection (maks 3 kalimat), observeQ/interpretQ/applyQ, fgdQuestions (2-3), bridge (1 kalimat).',
    '- TEPAT 5 "rhbSections" per Path dengan key: PENGANTAR, PEMBAHASAN_TEMATIS, MAKNA_IMPLIKASI, REFLEKSI_PRIBADI, DISKUSI_KELOMPOK. body WAJIB 1 paragraf pendek, MAKS 250 karakter (jangan lebih).',
    '- "methodMix": 2-3 metode dari 7 pendekatan dengan persentase (~100) + catatan singkat.',
    '- Path 1 menyambung eksplisit dari minggu lalu; Path 7 menjembatani minggu depan.',
    '- PENTING: JAGA RINGKAS agar JSON tidak terpotong; utamakan struktur & field wajib lengkap.',
    '',
    'Balas HANYA JSON valid (padat, tanpa markdown):',
    DRAFT_PATHS_SCHEMA,
  ];
  const SERMON_RULES = [
    'ATURAN RINGKASAN KHOTBAH (WAJIB):',
    '- Turunkan dari Fundamental Firman, diarahkan ke Kitab/Bagian Fokus.',
    '- methods: 2-3 metode; rationale: bagaimana metode menajamkan Fundamental Firman.',
    '- summary: 2-3 paragraf pendek (maks 80 kata).',
    '- slideOutline: 6-8 slide (title, bullets 2-4, visualNote maks 60 karakter).',
    '- deliveryPlan: satu baris per metode (method, how).',
    '- prepChecklist (4-6 item) dan discussionFlow (4-6 langkah FGD kontekstual tema ini).',
    '- JAGA RINGKAS agar JSON tidak terpotong.',
    '',
    'Balas HANYA JSON valid (padat, tanpa markdown):',
    DRAFT_SERMON_SCHEMA,
  ];

  const pathsPrompt = [...HEAD, ...PATHS_RULES].join('\n');
  const { data: parsedA } = await generateJson({ prompt: pathsPrompt, maxOutputTokens: 12000, timeoutMs: 48000 });
  let paths = Array.isArray(parsedA.paths) ? [...parsedA.paths] : [];

  // Penjagaan: lengkapi Path yang belum berisi RHB secara bertahap (batch maks 4).
  const hasPath = (p) => Array.isArray(p?.rhbSections) && p.rhbSections.some((s) => asStr(s?.body).trim());
  for (let round = 0; round < 2; round++) {
    const missing = [];
    for (let i = 0; i < 7; i++) if (!hasPath(paths[i])) missing.push(i + 1);
    if (!missing.length) break;
    const batch = missing.slice(0, 4);
    const batchPrompt = [
      ...HEAD,
      `LENGKAPI HANYA Path berikut: ${batch.join(', ')}. Sertakan "paths" berisi TEPAT ${batch.length} Path dengan pathIndex ${batch.join(', ')}.`,
      ...PATHS_RULES.slice(0, -2),
      'Balas HANYA JSON valid (padat, tanpa markdown):',
      DRAFT_PATHS_SCHEMA,
    ].join('\n');
    try {
      const { data: g } = await generateJson({ prompt: batchPrompt, maxOutputTokens: 6000, timeoutMs: 32000 });
      const got = Array.isArray(g.paths) ? g.paths : [];
      got.forEach((p, k) => {
        const idx = (Number(p?.pathIndex) || batch[k]) - 1;
        if (idx >= 0 && idx < 7 && hasPath(p)) paths[idx] = { ...(paths[idx] || {}), ...p, pathIndex: idx + 1 };
      });
    } catch { break; }
  }
  const a = { ...parsedA, paths };

  const outline = (Array.isArray(a.paths) ? a.paths : []).map((p, i) => `Path ${p.pathIndex || i + 1}: ${asStr(p.title)}`).join('\n');
  const sermonPrompt = [...HEAD, outline ? `KERANGKA 7 PATH:\n${outline}` : '', ...SERMON_RULES].filter(Boolean).join('\n');
  let sermon = {};
  try {
    const { data: b } = await generateJson({ prompt: sermonPrompt, maxOutputTokens: 4000, timeoutMs: 40000 });
    sermon = b.sermon || b || {};
  } catch { /* kosong → clampSermon mengisi default */ }

  if (!Array.isArray(a.paths) || a.paths.length === 0) {
    const fullPrompt = [...HEAD, ...PATHS_RULES.slice(0, -2), ...SERMON_RULES.slice(0, -2), '', 'Balas HANYA JSON valid (padat, tanpa markdown):', DRAFT_FULL_SCHEMA].join('\n');
    const { data: full } = await generateJson({ prompt: fullPrompt, maxOutputTokens: 14000, timeoutMs: 55000 });
    return clampDraft(full);
  }
  return clampDraft({ ...a, sermon });
}
/**
 * Tahap 2 — perkaya draf yang sudah ada dengan diskusi internal tim.
 * Tidak membuang struktur; hanya menajamkan/ memperdalam isi.
 */
export async function generateEnrichedDraft(input) {
  const current = input.current && typeof input.current === 'object' ? input.current : {};
  const prompt = [
    'PERKAYA (revisi kedua) draf pembelajaran satu minggu untuk komunitas pemuda (Beyonders).',
    '',
    'KONTEKS:',
    buildContext(input),
    ...teamContextBlock(input),
    '',
    'ALUR PEMIKIRAN (WAJIB):',
    '- Fundamental Firman = jangkar tema; Ringkasan Khotbah diturunkan darinya lalu diarahkan ke Kitab/Bagian Fokus.',
    '- Setiap metode (sesuai persentase) harus menajamkan & memperdalam Fundamental Firman.',
    '- Kitab/Bagian Fokus dibagi 7 hari sebagai Bacaan Alkitab; tiap hari punya Nats Pembimbing.',
    '',
    'DRAF SAAT INI (JSON):',
    JSON.stringify({
      chapterNo: current.chapterNo,
      fundamentalFirman: current.fundamentalFirman,
      kitabFokus: current.kitabFokus,
      methodMix: current.methodMix,
      paths: (current.paths || []).map((p) => ({
        pathIndex: p.pathIndex,
        dayLabel: p.dayLabel,
        title: p.title,
        bacaanRef: p.bacaanRef,
        scriptureRef: p.scriptureRef,
        rhbSections: (p.rhbSections || []).map((s) => ({ key: s.key, body: s.body })),
      })),
      sermon: current.sermon,
    }),
    '',
    'TUGAS:',
    '- JANGAN mengubah struktur: tetap 7 Path dan 5 rhbSections per Path dengan key yang sama.',
    '- Pertajam: judul Path (tetap Bahasa Inggris, kece), bacaanRef (progresif dari Kitab Fokus), scriptureRef (Nats Pembimbing), isi rhbSections, dan ringkasan khotbah.',
    '- Pastikan tiap metode benar-benar menajamkan Fundamental Firman.',
    '- Jaga KESINAMBUNGAN: Path 1 menyambung dari MINGGU LALU, Path 7 menjembatani MINGGU DEPAN (lihat konteks).',
    '- Integrasikan masukan dari "Catatan tim/diskusi" (jangan diabaikan).',
    '- Bahasa Indonesia hangat & kontekstual; hanya judul Path dalam Bahasa Inggris.',
    '',
    'Balas HANYA JSON valid (bentuk sama seperti draf di atas, lengkap):',
    '{"chapterNo":"...","fundamentalFirman":{"ref":"...","text":"..."},"kitabFokus":"...","homileticMethods":["..."],"methodMix":[{"method":"...","percent":50,"note":"..."}],"paths":[{"pathIndex":1,"dayLabel":"Senin","title":"English Catchy Title","bacaanRef":"...","summary":"...","scriptureRef":"...","scriptureText":"...","homileticLens":["..."],"hookQuestion":"...","illustration":"...","reflection":"...","observeQ":"...","interpretQ":"...","applyQ":"...","fgdQuestions":["..."],"bridge":"...","imageStem":"","rhbSections":[{"key":"PENGANTAR","title":"Pengantar","body":"..."},{"key":"PEMBAHASAN_TEMATIS","title":"Pembahasan Tematis","body":"..."},{"key":"MAKNA_IMPLIKASI","title":"Makna & Implikasi bagi Beyonders","body":"..."},{"key":"REFLEKSI_PRIBADI","title":"Pertanyaan untuk Refleksi Pribadi","body":"..."},{"key":"DISKUSI_KELOMPOK","title":"Pertanyaan untuk Diskusi Kelompok","body":"..."}]}],"sermon":{"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}],"deliveryPlan":[{"method":"...","how":"..."}],"prepChecklist":["..."],"discussionFlow":["..."]}}',
  ].filter(Boolean).join('\n');

  const { data } = await generateJson({ prompt, maxOutputTokens: 12000, timeoutMs: 50000 });
  return clampDraft(data);
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
    input.pathsOutline ? `Kerangka 7 Path:\n${asStr(input.pathsOutline)}` : '',
    '',
    'ATURAN:',
    '- deliveryPlan: 2-4 baris, tiap metode yang dipakai (lihat methodMix) dengan cara praktis menyampaikannya.',
    '- prepChecklist: 4-6 langkah konkret persiapan khotbah.',
    '- discussionFlow: 4-6 langkah alur FGD hari Minggu yang spesifik tema ini (bukan generik).',
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
 */
export async function generateSermon(input) {
  const prompt = [
    'Susun RINGKASAN KHOTBAH dan kerangka presentasi (slide) untuk satu minggu pemuda.',
    '',
    'KONTEKS:',
    buildContext(input),
    ...teamContextBlock(input),
    input.pathsOutline ? `Kerangka 7 Path yang sudah ada:\n${asStr(input.pathsOutline)}` : '',
    '',
    'ATURAN:',
    '- Gunakan kombinasi 2-3 metode berkhotbah dan jelaskan alasannya.',
    '- summary: rangkuman khotbah 3-5 paragraf, kontekstual untuk pemuda/anak rantau.',
    '- slideOutline: 6-10 slide (title, bullets 2-5, visualNote untuk arahan gambar).',
    '- Bahasa Indonesia yang hangat dan jelas.',
    '',
    'Balas HANYA JSON valid: {"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}]}',
  ].filter(Boolean).join('\n');

  const { data } = await generateJson({ prompt, maxOutputTokens: 4000, timeoutMs: 35000 });
  return clampSermon(data);
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
