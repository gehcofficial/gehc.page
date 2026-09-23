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

export const RITUAL_TYPES = ['INTERNAL_SYNC', 'SERVING_BRIEFING', 'GENERAL_EQUIPPING'];

export const RITUAL_LABELS = {
  INTERNAL_SYNC: 'Internal Sync',
  SERVING_BRIEFING: 'Serving Group Briefing',
  GENERAL_EQUIPPING: 'General Equipping',
};

export const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

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
  'Audiens: pemuda dan anak rantau di Cikarang. Gaya: hangat, jelas, Alkitabiah, kontekstual, tidak menggurui. ' +
  'Selalu menulis dalam Bahasa Indonesia. Jangan mengarang fakta di luar data yang diberikan.';

/** Ambil objek JSON pertama dari keluaran model yang mungkin berbalut teks. */
export function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) throw new Error('Keluaran AI tidak memuat JSON.');
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
      if (depth === 0) {
        const raw = s.slice(start, i + 1);
        try {
          return JSON.parse(raw);
        } catch (e) {
          throw new Error(`JSON tidak valid: ${e.message}`);
        }
      }
    }
  }
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
  return {
    methods: asStrArray(s.methods, 4),
    rationale: asStr(s.rationale),
    summary: asStr(s.summary),
    slideOutline: clampSlides(s.slideOutline),
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

function buildContext(input) {
  const lines = [
    `Bulan (YYYY-MM): ${asStr(input.yearMonth)}`,
    `Minggu ke-: ${input.weekIndex}`,
    `Tanggal Minggu: ${asStr(input.date)}`,
    `Chapter: ${asStr(input.chapterNo)}`,
    `Tema minggu: ${asStr(input.theme)}`,
    `Tema bulan: ${asStr(input.monthTheme)}`,
    `Fundamental Firman (ayat dasar): ${asStr(input.fundamentalFirman?.ref)} ${asStr(input.fundamentalFirman?.text)}`.trim(),
    `Kitab/bagian fokus: ${asStr(input.kitabFokus)}`,
    `Tema minggu sebelum (jembatan masuk): ${asStr(input.prevTheme) || '(tidak ada)'}`,
    `Tema minggu berikutnya (jembatan keluar): ${asStr(input.nextTheme) || '(tidak ada)'}`,
    `Metode berkhotbah yang diminta: ${(input.methods && input.methods.length ? input.methods : ['otomatis pilih 2-3 yang paling cocok']).join(', ')}`,
    input.notes ? `Catatan tim/diskusi: ${asStr(input.notes)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Susun draf satu minggu: 7 Path berurutan + kerangka Ringkasan Khotbah.
 */
export async function generateWeekDraft(input) {
  const prompt = [
    'Susun draf pembelajaran satu minggu untuk komunitas pemuda (Beyonders).',
    '',
    'KONTEKS:',
    buildContext(input),
    '',
    'ALUR PEMIKIRAN (WAJIB DIPATUHI):',
    '- Fundamental Firman (ayat) adalah JANGKAR TEMA minggu ini. Seluruh isi harus bertumpu pada ayat dasar ini.',
    '- Ringkasan Khotbah DITURUNKAN dari Fundamental Firman, lalu DIARAHKAN ke Kitab/Bagian Fokus minggu ini.',
    '- Setiap metode berkhotbah yang dipakai (lihat persentasenya) harus terasa MENAJAMKAN & MEMPERDALAM Fundamental Firman — bukan tempelan.',
    '- Kitab/Bagian Fokus adalah TUJUAN HARIAN: bagi rentangnya menjadi 7 bagian berurutan (Path 1 → Path 7).',
    '',
    'ATURAN:',
    '- Hasilkan TEPAT 7 Path yang saling terhubung dan berurutan (Path 1 sampai 7).',
    '- Judul tiap Path WAJIB Bahasa Inggris yang menarik/kece untuk anak muda (2-5 kata, mis. "Redefining Greatness", "Ambassadors of Grace"). Isi lain tetap Bahasa Indonesia.',
    '- Path 7 adalah KESIMPULAN minggu ini sekaligus JEMBATAN ke tema minggu berikutnya.',
    '- Tiap Path wajib punya: title (Inggris), bacaanRef (Bacaan Alkitab harian dari rentang Kitab Fokus), scriptureRef (Nats Pembimbing — satu ayat kunci), scriptureText (teks Nats Pembimbing, ringkas), homileticLens (2-3 metode), hookQuestion (pertanyaan pembuka mudah), illustration (ilustrasi singkat relevan), reflection (2-4 paragraf pendek), observeQ/interpretQ/applyQ (pertanyaan diskusi bertingkat), fgdQuestions (2-4 pertanyaan), bridge (kalimat jembatan ke Path berikutnya).',
    '- Bacaan Alkitab: bagi rentang Kitab/Bagian Fokus secara merata untuk 7 hari (progresif). Contoh: bila Kitab Fokus = 1 Timotius 3:1-13, hari 1 ≈ 1 Timotius 3:1-2, hari 2 ≈ 3:3-4, dst.',
    '- Nats Pembimbing: ayat kunci tiap hari yang diulas dan berasosiasi dengan Fundamental Firman/tema minggu.',
    '- Tiap Path juga wajib punya "rhbSections": TEPAT 5 section RHB harian berurutan dengan key: PENGANTAR, PEMBAHASAN_TEMATIS, MAKNA_IMPLIKASI, REFLEKSI_PRIBADI, DISKUSI_KELOMPOK. Masing-masing {key, title, body} dengan body 1-3 paragraf pendek (boleh dipisah baris kosong). "Makna & Implikasi bagi Beyonders" harus konkret untuk pemuda/anak rantau; "Diskusi Kelompok" 3-5 pertanyaan; "Refleksi Pribadi" 1-3 pertanyaan.',
    '- Kombinasikan metode berkhotbah dari 7 pendekatan (Teologi Sistematika, Teologi Biblika, Pengajaran Tematika, Pengajaran Ekspositori, Apologetika, Teologi Praktika/Pastoral, Teologi Historis) sesuai kebutuhan; jelaskan pada sermon.rationale BAGAIMANA pilihan itu menajamkan Fundamental Firman.',
    '- Sertakan "methodMix": 2-3 metode dari daftar 7 dengan persentase (total ~100) dan catatan singkat alasan porsinya.',
    '- Manfaatkan "Catatan tim/diskusi" bila ada sebagai masukan nyata dari tim Didaskalia.',
    '- Ringkasan khotbah: methods, rationale, summary (3-5 paragraf), slideOutline (6-10 slide, tiap slide: title, bullets 2-5, visualNote).',
    '- Kesinambungan: hubungkan dengan tema minggu sebelumnya dan berikutnya (lihat konteks).',
    '- Kontekstual untuk anak muda & anak rantau di Cikarang (kerja, kos, komunitas).',
    '- Bahasa Indonesia yang hangat dan jelas (kecuali judul Path).',
    '',
    'Balas HANYA dengan JSON valid (tanpa markdown) dengan bentuk:',
    '{"chapterNo":"...","fundamentalFirman":{"ref":"...","text":"..."},"kitabFokus":"...","homileticMethods":["..."],"methodMix":[{"method":"...","percent":50,"note":"..."}],"paths":[{"pathIndex":1,"dayLabel":"Senin","title":"English Catchy Title","bacaanRef":"...","scriptureRef":"...","scriptureText":"...","homileticLens":["..."],"hookQuestion":"...","illustration":"...","reflection":"...","observeQ":"...","interpretQ":"...","applyQ":"...","fgdQuestions":["..."],"bridge":"...","imageStem":"","rhbSections":[{"key":"PENGANTAR","title":"Pengantar","body":"..."},{"key":"PEMBAHASAN_TEMATIS","title":"Pembahasan Tematis","body":"..."},{"key":"MAKNA_IMPLIKASI","title":"Makna & Implikasi bagi Beyonders","body":"..."},{"key":"REFLEKSI_PRIBADI","title":"Pertanyaan untuk Refleksi Pribadi","body":"..."},{"key":"DISKUSI_KELOMPOK","title":"Pertanyaan untuk Diskusi Kelompok","body":"..."}]}],"sermon":{"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}]}}',
  ].join('\n');

  const text = await jethroGenerateText({ system: SYSTEM, prompt, maxTokens: 4096 });
  return clampDraft(extractJson(text));
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
    '- Integrasikan masukan dari "Catatan tim/diskusi" (jangan diabaikan).',
    '- Bahasa Indonesia hangat & kontekstual; hanya judul Path dalam Bahasa Inggris.',
    '',
    'Balas HANYA JSON valid (bentuk sama seperti draf di atas, lengkap):',
    '{"chapterNo":"...","fundamentalFirman":{"ref":"...","text":"..."},"kitabFokus":"...","homileticMethods":["..."],"methodMix":[{"method":"...","percent":50,"note":"..."}],"paths":[{"pathIndex":1,"dayLabel":"Senin","title":"English Catchy Title","bacaanRef":"...","scriptureRef":"...","scriptureText":"...","homileticLens":["..."],"hookQuestion":"...","illustration":"...","reflection":"...","observeQ":"...","interpretQ":"...","applyQ":"...","fgdQuestions":["..."],"bridge":"...","imageStem":"","rhbSections":[{"key":"PENGANTAR","title":"Pengantar","body":"..."},{"key":"PEMBAHASAN_TEMATIS","title":"Pembahasan Tematis","body":"..."},{"key":"MAKNA_IMPLIKASI","title":"Makna & Implikasi bagi Beyonders","body":"..."},{"key":"REFLEKSI_PRIBADI","title":"Pertanyaan untuk Refleksi Pribadi","body":"..."},{"key":"DISKUSI_KELOMPOK","title":"Pertanyaan untuk Diskusi Kelompok","body":"..."}]}],"sermon":{"methods":["..."],"rationale":"...","summary":"...","slideOutline":[{"title":"...","bullets":["..."],"visualNote":"..."}]}}',
  ].filter(Boolean).join('\n');

  const text = await jethroGenerateText({ system: SYSTEM, prompt, maxTokens: 4096 });
  return clampDraft(extractJson(text));
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

  const text = await jethroGenerateText({ system: SYSTEM, prompt, maxTokens: 2048 });
  return clampSermon(extractJson(text));
}

/**
 * Perbaiki satu bagian tertentu (mis. satu Path atau ringkasan).
 */
export async function refineField({ fieldLabel, current, instruction, context }) {
  const prompt = [
    `Perbaiki bagian "${asStr(fieldLabel)}" berikut.`,
    context ? `Konteks:\n${asStr(context)}` : '',
    `Teks saat ini:\n${asStr(current)}`,
    `Instruksi: ${asStr(instruction) || 'Buat lebih jelas, hangat, dan mudah dipahami pemuda.'}`,
    '',
    'Balas HANYA dengan teks hasil perbaikan (tanpa tanda kutip pembuka/penutup, tanpa penjelasan).',
  ].filter(Boolean).join('\n');

  const text = await jethroGenerateText({ system: SYSTEM, prompt, maxTokens: 1200 });
  return String(text || '').trim();
}
