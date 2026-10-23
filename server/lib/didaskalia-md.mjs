/**
 * Didaskalia — parser naskah mingguan (Service & RHB).
 *
 * Menerima markdown standar DAN tempelan polos dari PDF (tanpa tanda pagar):
 * "PATH 1 --- MINGGU, 25 OKTOBER", "Nas/Nats Pembimbing", "Fondasi Teologis",
 * "Kitab Fundamental", "Kitab Bagian Fokus".
 * Keluaran parsial tetap dikembalikan; `missing` hanya peringatan.
 */
import { formatKhutbahOutlineMd, joinHardWrappedLines } from '../../src/lib/didaskalia-prose.mjs';

export { formatKhutbahOutlineMd, joinHardWrappedLines } from '../../src/lib/didaskalia-prose.mjs';

function asStr(v, max = 8000) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const RHB_SECTION_TITLES = [
  { key: 'PENGANTAR', title: 'Pengantar' },
  { key: 'PEMBAHASAN_TEMATIS', title: 'Pembahasan Tematis' },
  { key: 'MAKNA_IMPLIKASI', title: 'Makna dan Implikasi bagi Beyonders' },
  { key: 'REFLEKSI_PRIBADI', title: 'Pertanyaan untuk Refleksi Pribadi' },
  { key: 'DISKUSI_KELOMPOK', title: 'Pertanyaan untuk Diskusi Kelompok' },
];

/** Kupas wrapper Python `md_content = """..."""`. */
export function unwrapPythonMd(raw) {
  const s = String(raw || '');
  const m = s.match(/"""([\s\S]*)"""/);
  if (m) return m[1].trim();
  return s.trim();
}

/** Samakan newline dan sambung ayat yang terpotong baris PDF (`2 Timotius` + `1:3--18`). */
export function prepareSourceText(raw) {
  const lines = unwrapPythonMd(raw).replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    while (i + 1 < lines.length && /[A-Za-z]\s*$/.test(line) && /^\s*\d+\s*:\s*\d+/.test(lines[i + 1])) {
      line = `${line.trim()} ${lines[i + 1].trim()}`;
      i += 1;
    }
    out.push(line);
  }
  return out.join('\n');
}

function splitSections(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      if (cur) out.push(cur);
      cur = { level: h[1].length, title: h[2].trim(), body: '' };
    } else if (cur) {
      cur.body += `${line}\n`;
    }
  }
  if (cur) out.push(cur);
  for (const s of out) s.body = s.body.trim();
  return out;
}

function cleanBody(s, max = 20000) {
  return asStr(s, max).replace(/\n{3,}/g, '\n\n');
}

function cleanOutlineBody(s, max = 20000) {
  return asStr(joinHardWrappedLines(s), max).replace(/\n{3,}/g, '\n\n');
}

function pickField(text, re) {
  const m = String(text || '').match(re);
  if (!m) return '';
  return asStr(m[1], 300).replace(/^\*+\s*|\s*\*+$/g, '').trim();
}

const TEMA_RE = /tema[^:\n]{0,40}:\s*\**\s*([^\n*]+)/i;
const TEKS_UTAMA_RE = /(?:teks\s+utama|kitab\s+fundamental)[^:\n]{0,80}:\s*\**\s*([^\n*]+)/i;
const KITAB_FOKUS_RE = /(?:teks\s+jangkar|kitab\s+bagian\s+fokus)[^:\n]{0,90}:\s*\**\s*([^\n*]+)/i;

function isServiceHeadingLine(line) {
  const s = String(line || '').trim();
  if (/^#{2,3}\s+\S/.test(s)) return true;
  if (/^[A-D]\.\s+\S/.test(s)) return true;
  if (/^\d+\.\s+(?:pengantar|fondasi teologis|bedah teologis|jembatan|kesimpulan)\b/i.test(s)) return true;
  return false;
}

function classifyService(line) {
  if (!isServiceHeadingLine(line)) return null;
  const t = String(line).trim().replace(/^#{1,3}\s+/, '').replace(/^(?:[A-D]|\d+)\.\s+/, '').trim();
  if (/^informasi sesi\b/i.test(t)) return 'INFO';
  if (/^(?:pengantar|fondasi teologis)\b/i.test(t)) return 'PENGANTAR';
  if (/^bedah teologis\b/i.test(t) || /^the great exchange\b/i.test(t) || /^pertukaran besar\b/i.test(t)) return 'BEDAH';
  if (/^jembatan\b/i.test(t)) return 'JEMBATAN';
  if (/^kesimpulan\b/i.test(t)) return 'KESIMPULAN';
  return null;
}

/**
 * Parse MD / teks Service → info sesi + 4 outline.
 * Kitab Fundamental = Teks Utama khotbah. Kitab Bagian Fokus = kitabFokus.
 * Fondasi Teologis = Pengantar.
 */
export function parseServiceMd(raw) {
  const md = prepareSourceText(raw);
  const buckets = { INFO: [], PENGANTAR: [], BEDAH: [], JEMBATAN: [], KESIMPULAN: [] };
  let cur = null;
  for (const line of md.split('\n')) {
    const key = classifyService(line);
    if (key && buckets[key]) {
      cur = key;
      continue;
    }
    if (cur) buckets[cur].push(line);
  }
  const body = (k) => (k === 'INFO' ? cleanBody(buckets[k].join('\n')) : cleanOutlineBody(buckets[k].join('\n')));
  const infoBody = body('INFO') || md.slice(0, 2500);
  const kitabFokus = pickField(infoBody, KITAB_FOKUS_RE);
  const info = {
    tema: pickField(infoBody, TEMA_RE),
    teksUtama: pickField(infoBody, TEKS_UTAMA_RE),
    teksJangkar: kitabFokus,
    kitabFokus,
  };
  const chapter = md.match(/\bchapter\s+(\d+)\b/i);
  if (chapter) info.chapterNo = `Chapter ${chapter[1]}`;

  const outline = {
    pengantar: body('PENGANTAR'),
    bedahTeologis: body('BEDAH'),
    jembatan: body('JEMBATAN'),
    kesimpulan: body('KESIMPULAN'),
  };
  const missing = [];
  if (!outline.pengantar) missing.push('Pengantar');
  if (!outline.bedahTeologis) missing.push('Bedah Teologis');
  if (!outline.jembatan) missing.push('Jembatan Menuju Tema Mingguan');
  if (!outline.kesimpulan) missing.push('Kesimpulan');
  if (!info.teksUtama) missing.push('Teks Utama (MD Mentoring Day / Sermon)');
  if (!info.kitabFokus) missing.push('Kitab Bagian Fokus');
  return { ok: missing.length === 0, missing, info, outline };
}

const NATS_LINE_RE = /^(?:\*\*|__)?\s*(?:ayat\s+renungan|nas\s+pembimbing|nats\s+pembimbing|scripture)\s*:\s*(.+?)\s*(?:\*\*|__)?\s*$/i;
const PATH_LINE_RE = /^(?:#{1,3}\s+)?path\s+(\d+)\b(.*)$/i;

function rhbSectionKey(line) {
  const t = String(line || '').trim().replace(/^#{1,3}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
  if (!t || t.length > 180) return null;
  if (/^pengantar$/i.test(t)) return 'PENGANTAR';
  if (/^pembahasan tematis$/i.test(t)) return 'PEMBAHASAN_TEMATIS';
  if (/^makna\s+(dan|&)\s+implikasi(\s+bagi\s+beyonders)?$/i.test(t)) return 'MAKNA_IMPLIKASI';
  if (/^pertanyaan untuk refleksi pribadi$/i.test(t)) return 'REFLEKSI_PRIBADI';
  if (/^pertanyaan untuk diskusi kelompok$/i.test(t)) return 'DISKUSI_KELOMPOK';
  const hashed = /^#{1,3}\s+/.test(String(line || '').trim());
  if (/^jembatan ke\b/i.test(t) || /^jembatan$/i.test(t) || (hashed && /^jembatan\b/i.test(t))) return 'BRIDGE';
  return null;
}

function titleFromPathRemainder(rest) {
  const raw = String(rest || '').trim();
  const colon = raw.match(/^:\s*(.+)$/);
  if (!colon) return '';
  const t = colon[1].replace(/\*+$/g, '').trim();
  if (!t || /^(minggu|senin|selasa|rabu|kamis|jumat|sabtu)\b/i.test(t)) return '';
  return asStr(t, 120);
}

function weekdayIn(text) {
  const m = String(text || '').match(/\b(minggu|senin|selasa|rabu|kamis|jumat|sabtu)\b/i);
  if (!m) return '';
  const map = { minggu: 'Minggu', senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu' };
  return map[m[1].toLowerCase()] || '';
}

/**
 * Parse RHB lengkap (7 hari) dari markdown standar atau teks PDF.
 * Alias ayat: Ayat Renungan, Nas Pembimbing, Nats Pembimbing, Scripture.
 */
export function parseRhbFullMd(raw) {
  const md = prepareSourceText(raw);
  const blocks = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const h1 = line.match(PATH_LINE_RE);
    if (h1) {
      if (cur) blocks.push(cur);
      cur = { pathIndex: Number(h1[1]), remainder: h1[2] || '', lines: [] };
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  if (cur) blocks.push(cur);

  const warnings = [];
  const paths = blocks.slice(0, 7).map((b, i) => {
    const pathIndex = Number.isInteger(b.pathIndex) && b.pathIndex >= 1 && b.pathIndex <= 7 ? b.pathIndex : i + 1;
    let title = titleFromPathRemainder(b.remainder);
    let scriptureRef = '';
    const sections = {};
    let bridge = '';
    let curKey = '';
    let curBridge = false;
    const buf = [];
    const orphan = [];
    const flush = () => {
      const t = cleanOutlineBody(buf.join('\n'));
      buf.length = 0;
      if (!t) {
        curKey = '';
        curBridge = false;
        return;
      }
      if (curBridge) bridge = `${bridge ? `${bridge}\n\n` : ''}${t}`.slice(0, 2000);
      else if (curKey) sections[curKey] = `${sections[curKey] ? `${sections[curKey]}\n\n` : ''}${t}`.slice(0, 20000);
      else orphan.push(t);
      curKey = '';
      curBridge = false;
    };
    for (const line of b.lines) {
      if (/^---+\s*$/.test(line.trim())) {
        flush();
        continue;
      }
      const nats = line.trim().match(NATS_LINE_RE);
      if (nats) {
        flush();
        scriptureRef = asStr(nats[1].replace(/\*+\s*$/g, ''), 160);
        continue;
      }
      const sec = rhbSectionKey(line);
      if (sec) {
        flush();
        if (sec === 'BRIDGE') curBridge = true;
        else curKey = sec;
        continue;
      }
      const h2 = line.match(/^##(?!#)\s+(.*)$/);
      if (h2 && !title) {
        flush();
        title = asStr(h2[1], 120);
        continue;
      }
      if (!title && !curKey && !curBridge) {
        const candidate = line.trim().replace(/^#{1,3}\s+/, '').trim();
        if (candidate && candidate.length <= 140 && !/^[a-d]\.\s/.test(candidate)) {
          title = asStr(candidate, 120);
          continue;
        }
      }
      const quote = line.match(/^>\s*(.+)$/);
      if (quote && /jembatan/i.test(quote[1]) && !curKey) {
        flush();
        bridge = asStr(quote[1].replace(/^\*+|\*+$/g, ''), 500);
        continue;
      }
      buf.push(line);
    }
    flush();
    if (orphan.length) {
      const extra = orphan.join('\n\n').slice(0, 20000);
      sections.PENGANTAR = sections.PENGANTAR ? `${extra}\n\n${sections.PENGANTAR}`.slice(0, 20000) : extra;
    }
    const headerDay = weekdayIn(b.remainder);
    const calendarDay = DAY_LABELS[pathIndex - 1] || '';
    if (headerDay && calendarDay && headerDay !== calendarDay) {
      warnings.push(`Path ${pathIndex}: kepala sumber menyebut ${headerDay}, kalender Path adalah ${calendarDay}.`);
    }
    return { pathIndex, dayLabel: calendarDay, title, scriptureRef, sections, bridge: bridge.trim() };
  });

  const missing = [];
  if (paths.length < 7) missing.push(`Hanya ${paths.length}/7 Path ditemukan (kepala "PATH N" / "# PATH N" tidak lengkap?)`);
  paths.forEach((p, i) => {
    const n = p.pathIndex || i + 1;
    if (!p.title) missing.push(`Path ${n}: judul kosong`);
    if (!p.scriptureRef) missing.push(`Path ${n}: Nats Pembimbing kosong`);
    for (const k of RHB_SECTION_TITLES) {
      if (!p.sections[k.key]?.trim()) missing.push(`Path ${n}: section ${k.key} kosong`);
    }
  });
  return { ok: missing.length === 0, missing, warnings, paths };
}

/**
 * Parse MD RHB ringkas (judul + nats + ringkasan + jembatan), bukan 5 section.
 */
export function parseRhbMd(raw) {
  const md = prepareSourceText(raw);
  const sections = splitSections(md).filter((s) => /^path\s+\d+/i.test(s.title));
  const natsRe = /(?:^|\n)\s*(?:\*\*|__)?\s*(?:scripture|ayat\s+renungan|nas\s+pembimbing|nats\s+pembimbing)\s*:\s*\**\s*([^\n*]+)/i;
  const paths = sections.slice(0, 7).map((s, i) => {
    const titleM = s.title.match(/^path\s+\d+\s*[:\-–—]?\s*(.*)$/i);
    const title = asStr(titleFromPathRemainder(titleM ? titleM[1] : s.title) || (titleM ? titleM[1] : s.title), 120);
    const refM = s.body.match(natsRe);
    const scriptureRef = asStr(refM ? refM[1] : '', 160);
    const bacaanM = s.body.match(/\*\*bacaan:\*\*\s*([^\n]+)/i);
    const bacaanRef = asStr(bacaanM ? bacaanM[1] : '', 160);
    const bridgeM = s.body.match(/^>\s*(.+)$/m);
    const bridge = asStr(bridgeM ? bridgeM[1].replace(/^\*+|\*+$/g, '') : '', 500);
    const summary = cleanOutlineBody(
      s.body
        .replace(natsRe, '')
        .replace(/\*\*bacaan:\*\*\s*[^\n]+\n?/i, '')
        .replace(/^>\s*.+$/m, ''),
      600,
    );
    return { pathIndex: i + 1, title, scriptureRef, bacaanRef, summary, bridge };
  });
  const missing = [];
  if (paths.length < 7) missing.push(`Hanya ${paths.length}/7 Path ditemukan`);
  paths.forEach((p, i) => {
    if (!p.scriptureRef) missing.push(`Path ${i + 1}: Nats Pembimbing kosong`);
  });
  return { ok: missing.length === 0, missing, paths };
}

/** Pilih parser RHB: lengkap bila ada section, ringkas bila hanya outline. */
export function parseImportedRhb(raw) {
  const full = parseRhbFullMd(raw);
  const sectionCount = full.paths.reduce((n, p) => n + RHB_SECTION_TITLES.filter((k) => p.sections[k.key]?.trim()).length, 0);
  if (full.paths.length && sectionCount > 0) return { mode: 'full', ...full };
  const brief = parseRhbMd(raw);
  if (brief.paths.length) return { mode: 'brief', ...brief, warnings: full.warnings || [] };
  return { mode: 'full', ...full };
}

export function toStandardRhbMd(paths) {
  const list = Array.isArray(paths) ? paths : [];
  return list.map((p) => {
    const n = p.pathIndex || 1;
    const lines = [
      `# PATH ${n} — ${p.dayLabel || DAY_LABELS[n - 1] || ''}`.trim(),
      `## ${p.title || ''}`,
      `**Nats Pembimbing: ${p.scriptureRef || ''}**`,
      '',
    ];
    for (const s of RHB_SECTION_TITLES) {
      lines.push(`### ${s.title}`, (p.sections && p.sections[s.key]) || '', '');
    }
    lines.push('### Jembatan', p.bridge || '', '');
    return lines.join('\n');
  }).join('\n');
}

const OUTLINE_KEYS = ['pengantar', 'bedahTeologis', 'jembatan', 'kesimpulan'];

/**
 * Naskah sumber yang jauh lebih panjang mengalahkan ringkasan satu-dua kalimat.
 * Suntingan yang sudah sepanjang sumber tetap dipakai.
 */
export function preferLiteralSection(edited, source) {
  const e = String(edited || '').trim();
  const s = String(source || '').trim();
  if (!s) return e;
  if (!e) return s;
  if (e.length < 400 && s.length >= e.length + 200 && s.length >= e.length * 2) return s;
  return e;
}

/** Outline yang dirender deck: salin bagian sumber bila field khotbah hanya ringkasan. */
export function sermonWithLiteralOutline(sermon, sourceMd) {
  const base = sermon && typeof sermon === 'object' ? { ...sermon } : {};
  const service = sourceMd && typeof sourceMd === 'object' ? sourceMd.service : null;
  const src = service && service.outline && typeof service.outline === 'object' ? service.outline : null;
  if (!src) return base;
  const prev = base.outline && typeof base.outline === 'object' ? base.outline : {};
  const outline = { ...prev };
  for (const key of OUTLINE_KEYS) outline[key] = joinHardWrappedLines(preferLiteralSection(prev[key], src[key]));
  const infoRef = service.info && typeof service.info.teksUtama === 'string' ? service.info.teksUtama.trim() : '';
  const tu = base.teksUtama && typeof base.teksUtama === 'object' ? base.teksUtama : {};
  return {
    ...base,
    outline,
    teksUtama: {
      ref: String(tu.ref || infoRef || ''),
      text: String(tu.text || ''),
    },
  };
}

export function toStandardServiceMd({ info = {}, outline = {} } = {}) {
  return [
    '## A. Informasi Sesi',
    `* **Tema Minggu Ini:** ${info.tema || ''}`,
    `* **Teks Utama (MD Mentoring Day / Sermon):** ${info.teksUtama || ''}`,
    `* **Kitab Bagian Fokus (Tema Mingguan / RHB 7 Path):** ${info.kitabFokus || info.teksJangkar || ''}`,
    '',
    '### 1. Pengantar',
    outline.pengantar || '',
    '',
    '### 2. Bedah Teologis',
    outline.bedahTeologis || '',
    '',
    '### 3. Jembatan Menuju Tema Mingguan',
    outline.jembatan || '',
    '',
    '### 4. Kesimpulan',
    outline.kesimpulan || '',
    '',
  ].join('\n');
}

const REF_RE = /\b(?:[1-3]\s+)?[\p{Lu}][\p{L}.']+(?:\s+[\p{Lu}][\p{L}.']+){0,3}\s+\d+\s*:\s*\d+(?:\s*[-–—]{1,2}\s*(?:\d+\s*:\s*)?\d+)?/gu;

export function canonRef(s) {
  return String(s || '').toLowerCase().replace(/[–—]/g, '-').replace(/-{2,}/g, '-').replace(/\s+/g, ' ').trim();
}

export function extractRefs(text) {
  return [...String(text || '').matchAll(REF_RE)].map((m) => m[0].replace(/\s+/g, ' ').trim());
}

function lostRefs(sourceBody, nextBody) {
  const refs = extractRefs(sourceBody);
  const hay = canonRef(nextBody);
  return refs.some((r) => !hay.includes(canonRef(r)));
}

/**
 * Setelah AI merapikan: ayat sumber yang hilang atau berubah dikembalikan.
 * Bagian yang kehilangan referensi ayat, atau yang menyusut jadi satu kalimat, kembali ke teks sumber.
 */
export function guardNormalized(kind, source, normalized) {
  const warnings = [];
  if (kind === 'service') {
    const src = parseServiceMd(source);
    const ai = parseServiceMd(normalized);
    const outline = {};
    for (const key of ['pengantar', 'bedahTeologis', 'jembatan', 'kesimpulan']) {
      const sourceBody = src.outline[key] || '';
      const aiBody = ai.outline[key] || '';
      if (!aiBody.trim()) {
        outline[key] = sourceBody;
        if (sourceBody.trim()) warnings.push({ kind: 'ayat', location: key, note: 'Bagian kosong pada hasil AI — teks sumber dipertahankan.' });
      } else if (lostRefs(sourceBody, aiBody)) {
        outline[key] = sourceBody;
        warnings.push({ kind: 'ayat', location: key, note: 'Referensi ayat hilang atau berubah — teks sumber dipertahankan.' });
      } else if (preferLiteralSection(aiBody, sourceBody) !== aiBody.trim()) {
        outline[key] = sourceBody;
        warnings.push({ kind: 'ayat', location: key, note: 'Bagian AI jauh lebih pendek dari naskah — teks sumber dipertahankan.' });
      } else outline[key] = aiBody;
    }
    const info = {
      tema: ai.info.tema || src.info.tema,
      teksUtama: src.info.teksUtama || ai.info.teksUtama,
      kitabFokus: src.info.kitabFokus || ai.info.kitabFokus,
      teksJangkar: src.info.kitabFokus || src.info.teksJangkar || ai.info.kitabFokus,
      chapterNo: src.info.chapterNo || ai.info.chapterNo || '',
    };
    const standard = toStandardServiceMd({ info, outline });
    return { normalized: standard, warnings, preview: parseServiceMd(standard) };
  }

  const src = parseRhbFullMd(source);
  if (!src.paths.length) {
    return {
      normalized,
      warnings: [{ kind: 'format', location: 'RHB', note: 'Sumber belum terpecah menjadi Path. Tinjau hasil AI sebelum parse.' }],
      preview: parseRhbFullMd(normalized),
    };
  }
  const ai = parseRhbFullMd(normalized);
  const paths = src.paths.map((sp) => {
    const ap = ai.paths.find((p) => p.pathIndex === sp.pathIndex) || { sections: {}, title: '', bridge: '' };
    const sections = {};
    for (const sec of RHB_SECTION_TITLES) {
      const sourceBody = sp.sections[sec.key] || '';
      const aiBody = ap.sections?.[sec.key] || '';
      if (!aiBody.trim()) {
        sections[sec.key] = sourceBody;
        if (sourceBody.trim()) warnings.push({ kind: 'ayat', location: `Path ${sp.pathIndex} ${sec.title}`, note: 'Bagian kosong pada hasil AI — teks sumber dipertahankan.' });
      } else if (lostRefs(sourceBody, aiBody)) {
        sections[sec.key] = sourceBody;
        warnings.push({ kind: 'ayat', location: `Path ${sp.pathIndex} ${sec.title}`, note: 'Referensi ayat hilang atau berubah — teks sumber dipertahankan.' });
      } else sections[sec.key] = aiBody;
    }
    let bridge = String(ap.bridge || '').trim() ? ap.bridge : sp.bridge;
    if (sp.bridge && lostRefs(sp.bridge, bridge)) {
      bridge = sp.bridge;
      warnings.push({ kind: 'ayat', location: `Path ${sp.pathIndex} Jembatan`, note: 'Jembatan dikembalikan karena referensi ayat berubah.' });
    }
    const scriptureRef = sp.scriptureRef || ap.scriptureRef || '';
    if (sp.scriptureRef && canonRef(ap.scriptureRef) && canonRef(ap.scriptureRef) !== canonRef(sp.scriptureRef)) {
      warnings.push({ kind: 'ayat', location: `Path ${sp.pathIndex}`, note: `Nats Pembimbing dikembalikan ke sumber (${sp.scriptureRef}).` });
    }
    return {
      pathIndex: sp.pathIndex,
      dayLabel: sp.dayLabel || DAY_LABELS[sp.pathIndex - 1] || '',
      title: String(ap.title || '').trim() || sp.title,
      scriptureRef,
      sections,
      bridge,
    };
  });
  const standard = toStandardRhbMd(paths);
  return { normalized: standard, warnings, preview: parseRhbFullMd(standard) };
}
