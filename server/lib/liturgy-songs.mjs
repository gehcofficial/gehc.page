/**
 * Liturgia — Pustaka Lagu + Setlist (server).
 *
 * Validasi/normalisasi payload + mesin ChordPro minimal (mirror
 * src/lib/song-chords.ts agar ekspor .show konsisten tanpa dependensi).
 */

export const SONG_SOURCES = ['HIMNE_KJ', 'HIMNE_NKB', 'HIMNE_NNBT', 'HIMNE_PKJ', 'KLIK', 'KONTEMPORER', 'LOKAL', 'SEKULER'];
export const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
export const MOMENTS = ['pembuka', 'firman', 'persembahan', 'penutup', 'bedah-lagu', 'bebas'];
/** Lagu sekuler hanya boleh dipakai pada momen non-liturgis (kurasi Liturgia). */
export const SECULAR_ALLOWED_MOMENTS = ['bedah-lagu', 'bebas'];

export function assertSecularMoment(source, moment) {
  if (String(source || '').toUpperCase() !== 'SEKULER') return;
  if (moment === undefined || moment === null) return;
  if (!SECULAR_ALLOWED_MOMENTS.includes(String(moment).toLowerCase())) {
    throw Object.assign(
      new Error('Lagu sekuler hanya untuk momen bebas/bedah-lagu (kurasi Liturgia).'),
      { status: 400 },
    );
  }
}

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_RE = /^([A-G])([#b]?)([^/]*?)(?:\/([A-G])([#b]?))?$/;
const SECTION_LINE_RE = /^\s*\[([^\]]+)\]\s*$/;

const str = (v, max = 300) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const intOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export function isChordToken(token) {
  const t = String(token || '').trim();
  if (!t || /\s/.test(t)) return false;
  if (/^(verse|chorus|bridge|intro|outro|interlude|ending|pre.?chorus|post.?chorus|tag|turn|instrumental)(\s+\d+)?$/i.test(t)) return false;
  return CHORD_RE.test(t);
}

function transposeRoot(root, acc, semitones, preferFlat) {
  const idx = SHARP.indexOf(root + acc);
  const i = idx === -1 ? FLAT.indexOf(root + acc) : idx;
  if (i === -1) return root + acc;
  const table = preferFlat ? FLAT : SHARP;
  return table[(((i + semitones) % 12) + 12) % 12];
}

export function transposeChord(chord, semitones) {
  const steps = Math.trunc(Number(semitones) || 0);
  if (!steps) return chord;
  const m = CHORD_RE.exec(String(chord || '').trim());
  if (!m) return chord;
  const [, root, acc, suffix, bassRoot, bassAcc] = m;
  if (/[^A-Gb#mMajdinsuogt0145679°ø+().-]/.test(suffix)) return chord;
  const preferFlat = (acc === 'b' || bassAcc === 'b') && acc !== '#';
  const next = transposeRoot(root, acc || '', steps, preferFlat);
  if (!bassRoot) return `${next}${suffix}`;
  return `${next}${suffix}/${transposeRoot(bassRoot, bassAcc || '', steps, preferFlat)}`;
}

export function transposeChordPro(chordPro, semitones) {
  const steps = Math.trunc(Number(semitones) || 0);
  if (!steps) return String(chordPro || '');
  return String(chordPro || '')
    .split('\n')
    .map((line) => {
      if (SECTION_LINE_RE.test(line)) return line;
      return line.replace(/\[([^\]\n]+)\]/g, (full, token) =>
        isChordToken(token) ? `[${transposeChord(token, steps)}]` : full,
      );
    })
    .join('\n');
}

export function parseSections(chordPro) {
  const text = String(chordPro || '').replace(/\r\n/g, '\n');
  const sections = [];
  let current = { name: 'Full', lines: [] };
  let seenHeader = false;
  for (const rawLine of text.split('\n')) {
    const m = SECTION_LINE_RE.exec(rawLine);
    if (m && !isChordToken(m[1])) {
      if (seenHeader || current.lines.length) sections.push(current);
      current = { name: m[1].trim(), lines: [] };
      seenHeader = true;
    } else {
      current.lines.push(rawLine);
    }
  }
  sections.push(current);
  if (!seenHeader) return [{ name: 'Full', lines: text.split('\n') }];
  return sections.filter((s, i) => (i < sections.length - 1 ? true : s.lines.join('').trim().length > 0 || sections.length === 1));
}

export function renderSelectedSections(chordPro, selected, songTranspose = 0, baseKey = 'C', markers = false) {
  const entries = resolveArrangement(chordPro, selected, songTranspose, baseKey);
  const out = [];
  for (const e of entries) {
    out.push(`[${e.label}${e.key ? ' · ' + e.key : ''}]`);
    if (markers && e.key) out.push(`{comment: Modulasi ke ${e.key}}`);
    out.push(...e.lines);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripChords(text) {
  return String(text || '')
    .split('\n')
    .map((line) => {
      if (/^\s*\{[^}\n]*\}\s*$/.test(line)) return '';
      if (SECTION_LINE_RE.test(line)) return line;
      return line.replace(/\[([^\]\n]+)\]/g, (full, token) => (isChordToken(token) ? '' : full));
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

const KEY_LIST = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_ALIAS = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const DIRECTIVE_LINE_RE = /^\s*\{[^}\n]*\}\s*$/;

/**
 * Tab chord: lirik reference dirender ulang dengan baris chord sejajar
 * di atas tiap baris lirik (mirror klien; tampil-saja).
 */
export function renderChordOverLyrics(text) {
  const out = [];
  for (const rawLine of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    if (!rawLine.trim() || SECTION_LINE_RE.test(rawLine) || DIRECTIVE_LINE_RE.test(rawLine)) {
      out.push(rawLine);
      continue;
    }
    const lyricChars = [];
    const marks = [];
    const re = /\[([^\]\n]+)\]/g;
    let last = 0;
    let m;
    let hasChord = false;
    while ((m = re.exec(rawLine)) !== null) {
      const seg = rawLine.slice(last, m.index);
      for (const ch of seg) lyricChars.push(ch);
      if (isChordToken(m[1])) {
        marks.push({ pos: lyricChars.length, token: m[1] });
        hasChord = true;
      } else {
        for (const ch of m[0]) lyricChars.push(ch);
      }
      last = m.index + m[0].length;
    }
    for (const ch of rawLine.slice(last)) lyricChars.push(ch);
    if (!hasChord) {
      out.push(rawLine);
      continue;
    }
    const chordChars = [];
    for (const { pos, token } of marks) {
      while (chordChars.length < pos) chordChars.push(' ');
      for (const ch of token) chordChars.push(ch);
    }
    out.push(chordChars.join('').trimEnd(), lyricChars.join(''));
  }
  return out.join('\n');
}

/** Indeks kromatis 0–11, -1 bila tidak dikenal (mirror klien). */
export function keyIndex(key) {
  const k = String(key || '').trim();
  if (!k) return -1;
  return KEY_LIST.indexOf(FLAT_ALIAS[k] || k);
}

/** Langkah transpose (0–11 ke atas) dari nada dasar ke kunci tampil. */
export function transposeSteps(fromKey, toKey) {
  const a = keyIndex(fromKey);
  const b = keyIndex(toKey);
  if (a < 0 || b < 0) return 0;
  return (((b - a) % 12) + 12) % 12;
}

function clampArrTranspose(n) {
  if (n === undefined || n === null || n === '') return null;
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.max(-11, Math.min(11, v));
}

/** Normalisasi 1 entri susunan ala ProPresenter (string polos = ikut nada lagu). */
export function normalizeArrangementEntry(e) {
  if (typeof e === 'string') {
    const section = e.trim();
    return section ? { section, key: null, transpose: null } : null;
  }
  if (e && typeof e === 'object') {
    const section = String(e.section ?? '').trim();
    if (!section) return null;
    const keyRaw = String(e.key ?? '').trim();
    const key = keyRaw && keyIndex(keyRaw) >= 0 ? keyRaw : null;
    return { section, key, transpose: clampArrTranspose(e.transpose) };
  }
  return null;
}

/** Normalisasi susunan (maks 30 entri; kosong = null = full master). */
export function normalizeArrangement(input) {
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const e of input.slice(0, 30)) {
    const n = normalizeArrangementEntry(e);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

function transposeLines(lines, steps) {
  if (!steps) return lines;
  return transposeChordPro(lines.join('\n'), steps).split('\n');
}

/**
 * Uraikan susunan menjadi entri berurutan (boleh berulang; pengulangan
 * dilabeli "Chorus 2"; nama tak dikenal dilewati). Modulasi per entri
 * (key) dihitung dari baseKey dan berlaku ke bawah.
 */
export function resolveArrangement(chordPro, arrangement, songTranspose = 0, baseKey = 'C') {
  const all = parseSections(chordPro || '');
  const byName = new Map(all.map((s) => [s.name.toLowerCase(), s]));
  const base = String(baseKey || 'C');
  const norm = normalizeArrangement(arrangement);
  const list = norm && norm.length
    ? norm
    : all.map((s) => ({ section: s.name, key: null, transpose: null }));
  const counts = {};
  let cur = Math.trunc(Number(songTranspose) || 0);
  const out = [];
  for (const e of list) {
    const s = byName.get(e.section.toLowerCase());
    if (!s) continue;
    let t = cur;
    let key = null;
    if (e.key) {
      key = e.key;
      t = transposeSteps(base, e.key);
    } else if (e.transpose !== null) {
      t = e.transpose;
    }
    cur = t;
    counts[s.name] = (counts[s.name] || 0) + 1;
    const label = counts[s.name] > 1 ? `${s.name} ${counts[s.name]}` : s.name;
    out.push({ name: s.name, label, lines: transposeLines(s.lines, t), transpose: t, key });
  }
  return out;
}

/**
 * Validasi nama bagian susunan terhadap master lagu.
 * Melempar 400 bila ada nama tak dikenal (stale setelah lirik diubah).
 */
export function validateArrangementSections(arrangement, masterNames) {
  const norm = normalizeArrangement(arrangement);
  if (!norm) return;
  const known = new Set((masterNames || []).map((s) => String(s).toLowerCase()));
  const bad = [...new Set(norm.map((e) => e.section))].filter((s) => !known.has(s.toLowerCase()));
  if (bad.length) {
    throw Object.assign(
      new Error(`Bagian tak dikenal di lagu ini: ${bad.join(', ')}.`),
      { status: 400 },
    );
  }
}

const badArr = (msg) => Object.assign(new Error(msg), { status: 400 });

function normalizeVariantName(n) {
  const s = String(n ?? '').trim().slice(0, 40);
  return s || null;
}

/**
 * Susunan bernama: { master: string[]|null, variants: [{name, entries}] }.
 * - master = setlist master (pool resmi, subset lirik, urutan sendiri).
 * - variants = susunan main bernama (full, v1only…). Entri wajib dari pool.
 * - Legacy array tunggal → satu varian "Susunan" (pool ikut teks).
 */
export function normalizeNamedArrangements(input) {
  if (input === undefined || input === null) return null;
  if (Array.isArray(input)) {
    const entries = normalizeArrangement(input);
    return entries && entries.length ? { master: null, variants: [{ name: 'Susunan', entries }] } : null;
  }
  if (typeof input !== 'object') return null;
  let master = null;
  if (input.master !== undefined && input.master !== null) {
    if (!Array.isArray(input.master)) throw badArr('Setlist master harus array nama bagian.');
    master = [...new Set(input.master.map((s) => String(s ?? '').trim()).filter(Boolean))].slice(0, 30);
    if (!master.length) master = null;
  }
  const rawVars = Array.isArray(input.variants) ? input.variants : [];
  const variants = [];
  const seen = new Set();
  for (const item of rawVars.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const name = normalizeVariantName(item.name);
    if (!name) throw badArr('Tiap varian susunan wajib bernama.');
    if (seen.has(name.toLowerCase())) throw badArr(`Nama varian ganda: ${name}.`);
    seen.add(name.toLowerCase());
    const entries = normalizeArrangement(item.entries);
    variants.push({ name, entries: entries && entries.length ? entries : [] });
  }
  if (!master && !variants.length) return null;
  return { master, variants };
}

/** Validasi pool vs lirik + tiap varian vs pool (atau vs lirik bila pool kosong). */
export function validateNamedArrangements(named, masterNames) {
  if (!named) return;
  const known = new Set((masterNames || []).map((s) => String(s).toLowerCase()));
  if (named.master) {
    const badM = named.master.filter((s) => !known.has(String(s).toLowerCase()));
    if (badM.length) throw badArr(`Setlist master memuat bagian tak dikenal: ${badM.join(', ')}.`);
  }
  const pool = named.master && named.master.length
    ? new Set(named.master.map((s) => String(s).toLowerCase()))
    : known;
  for (const v of named.variants || []) {
    const badE = [...new Set((v.entries || []).map((e) => e.section))]
      .filter((s) => !pool.has(String(s).toLowerCase()));
    if (badE.length) throw badArr(`Varian "${v.name}" memuat bagian tak dikenal: ${badE.join(', ')}.`);
  }
}

function parseNamedRaw(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    const entries = normalizeArrangement(v);
    return entries && entries.length ? { master: null, variants: [{ name: 'Susunan', entries }] } : null;
  }
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return parseNamedRaw(p);
      if (p && typeof p === 'object') {
        const out = normalizeNamedArrangements(p);
        return out;
      }
      return null;
    } catch { return null; }
  }
  if (typeof v === 'object') {
    try {
      const out = normalizeNamedArrangements(v);
      return out;
    } catch { return null; }
  }
  return null;
}

/** Bentuk kanonis {master, variants} dari baris lagu (toleran legacy). */
export function namedArrangementsOf(song) {
  if (!song) return null;
  return parseNamedRaw(song.arrangements ?? song.arrangement ?? null);
}

/** Entri varian bernama (default = varian pertama). */
export function variantEntries(song, name = null) {
  const named = namedArrangementsOf(song);
  const vars = named?.variants || [];
  if (!vars.length) return null;
  if (name) {
    const hit = vars.find((v) => String(v.name).toLowerCase() === String(name).toLowerCase());
    if (hit && hit.entries && hit.entries.length) return hit.entries;
    return null;
  }
  const first = vars[0];
  return first.entries && first.entries.length ? first.entries : null;
}

/** Nama-nama varian untuk dropdown "pakai susunan". */
export function variantNames(song) {
  const named = namedArrangementsOf(song);
  return (named?.variants || []).map((v) => v.name);
}

/** Samakan dua susunan (abaikan urutan key objek; bandingkan isi). */
export function isSameArrangement(a, b) {
  const na = normalizeArrangement(Array.isArray(a) ? a : null);
  const nb = normalizeArrangement(Array.isArray(b) ? b : null);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return JSON.stringify(na) === JSON.stringify(nb);
}

/** Label asal susunan pemakaian: "dari: <nama>" bila cocok varian, else null (=kustom). */
export function arrangementSourceLabel(song, usageSections) {
  const named = namedArrangementsOf(song);
  const u = normalizeArrangement(Array.isArray(usageSections) ? usageSections : null);
  if (!u || !u.length) return null;
  for (const v of named?.variants || []) {
    if (isSameArrangement(v.entries, u)) return v.name;
  }
  return null;
}

const KEY_RE = /^[A-G][#b]?$/;

export function normalizeSongInput(body, existing = null) {
  const b = body || {};
  const data = {};
  if (b.title !== undefined || !existing) {
    const title = str(b.title, 200);
    if (!title) throw Object.assign(new Error('Judul lagu wajib.'), { status: 400 });
    data.title = title;
  }
  if (b.source !== undefined) {
    const s = String(b.source || '').toUpperCase();
    if (s && !SONG_SOURCES.includes(s)) throw Object.assign(new Error('Sumber tidak valid.'), { status: 400 });
    data.source = s || existing?.source || 'LOKAL';
  } else if (!existing) data.source = 'LOKAL';
  if (b.sourceRef !== undefined) data.sourceRef = str(b.sourceRef, 64);
  if (b.sourceUrl !== undefined) data.sourceUrl = str(b.sourceUrl, 500);
  if (b.authors !== undefined) data.authors = str(b.authors, 300);
  if (b.copyright !== undefined) data.copyright = str(b.copyright, 500);
  if (b.ccli !== undefined) data.ccli = str(b.ccli, 32);
  if (b.defaultKey !== undefined) {
    const k = str(b.defaultKey, 8);
    if (k && !KEY_RE.test(k)) throw Object.assign(new Error('Kunci dasar tidak valid (mis. G, Bb, F#).'), { status: 400 });
    data.defaultKey = k;
  }
  if (b.tempo !== undefined) data.tempo = intOrNull(b.tempo);
  if (b.lyricsChordPro !== undefined) {
    const v = b.lyricsChordPro === null ? null : String(b.lyricsChordPro).slice(0, 60000);
    data.lyricsChordPro = v && v.trim() ? v : null;
  }
  if (b.arrangements !== undefined || b.arrangement !== undefined) {
    let named = null;
    if (b.arrangements !== undefined && b.arrangements !== null) {
      named = normalizeNamedArrangements(b.arrangements);
    } else if (Array.isArray(b.arrangement)) {
      const entries = normalizeArrangement(b.arrangement);
      named = entries && entries.length ? { master: null, variants: [{ name: 'Susunan', entries }] } : null;
    }
    if (named) {
      const masterLyrics = data.lyricsChordPro !== undefined
        ? data.lyricsChordPro
        : existing?.lyricsChordPro ?? existing?.lyrics_chord_pro ?? null;
      validateNamedArrangements(named, parseSections(masterLyrics || '').map((s) => s.name));
    }
    data.arrangement = named;
  }
  if (b.tenantScope !== undefined) data.tenantScope = str(b.tenantScope, 64) || 'GLOBAL';
  else if (!existing) data.tenantScope = 'GLOBAL';
  if (b.story !== undefined) {
    data.story = b.story === null ? null : String(b.story).slice(0, 20000).trim() || null;
  }
  if (b.meaning !== undefined) {
    data.meaning = b.meaning === null ? null : String(b.meaning).slice(0, 4000).trim() || null;
  }
  if (b.isActive !== undefined) data.isActive = Boolean(b.isActive);
  const finalSource = data.source || existing?.source || 'LOKAL';
  if (finalSource === 'SEKULER') {
    const authors = data.authors !== undefined ? data.authors : existing?.authors || null;
    const url = data.sourceUrl !== undefined ? data.sourceUrl : existing?.sourceUrl || null;
    const copyright = data.copyright !== undefined ? data.copyright : existing?.copyright || null;
    if (!authors || !(url || copyright)) {
      throw Object.assign(
        new Error('Lagu sekuler wajib mencantumkan pencipta + tautan/catatan hak cipta (Spotify/YouTube/label).'),
        { status: 400 },
      );
    }
    if (data.lyricsChordPro) {
      throw Object.assign(
        new Error('Lirik lagu sekuler tidak disimpan (hak cipta label) — cukup metadata + tautan.'),
        { status: 400 },
      );
    }
  }
  return data;
}

export function normalizeServiceSongInput(body) {
  const b = body || {};
  const transpose = Math.max(-11, Math.min(11, intOrNull(b.transpose) || 0));
  const capo = b.capo === null || b.capo === undefined || b.capo === '' ? null : Math.max(0, Math.min(11, intOrNull(b.capo) || 0));
  let sections = null;
  if (b.sections !== undefined && b.sections !== null) {
    if (!Array.isArray(b.sections)) throw Object.assign(new Error('sections harus array susunan (nama/objek).'), { status: 400 });
    sections = normalizeArrangement(b.sections);
  }
  let moment = str(b.moment, 32)?.toLowerCase() || null;
  if (moment && !MOMENTS.includes(moment)) throw Object.assign(new Error('Momen tidak valid.'), { status: 400 });
  let baseKey = str(b.baseKey, 8);
  if (baseKey && !KEY_RE.test(baseKey)) throw Object.assign(new Error('baseKey tidak valid.'), { status: 400 });
  return {
    sections,
    baseKey,
    transpose,
    capo,
    moment,
    note: str(b.note, 500),
    sortOrder: intOrNull(b.sortOrder),
  };
}

export function serializeSong(row) {
  if (!row) return null;
  let arrangements = null;
  try {
    arrangements = parseNamedRaw(row.arrangements ?? row.arrangement ?? null);
  } catch { arrangements = null; }
  const compat = arrangements?.variants?.[0]?.entries?.length ? arrangements.variants[0].entries : null;
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    sourceRef: row.sourceRef ?? null,
    sourceUrl: row.sourceUrl ?? null,
    authors: row.authors ?? null,
    copyright: row.copyright ?? null,
    ccli: row.ccli ?? null,
    defaultKey: row.defaultKey ?? null,
    tempo: row.tempo ?? null,
    lyricsChordPro: row.lyricsChordPro ?? null,
    arrangements,
    arrangement: compat,
    story: row.story ?? null,
    meaning: row.meaning ?? null,
    sections: parseSections(row.lyricsChordPro || '').map((s) => s.name),
    tenantScope: row.tenantScope ?? 'GLOBAL',
    isActive: row.isActive !== false,
    updatedAt: row.updatedAt ?? null,
  };
}

export function serializeServiceSong(row, songRow = null) {
  const song = songRow ? serializeSong(songRow) : null;
  let sections = null;
  try {
    const raw = row.sections;
    const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) {
      sections = normalizeArrangement(arr)?.map((e) => (
        e.key || e.transpose !== null ? { section: e.section, ...(e.key ? { key: e.key } : {}), ...(e.transpose !== null ? { transpose: e.transpose } : {}) } : e.section
      )) || null;
    }
  } catch { sections = null; }
  return {
    id: row.id,
    eventId: row.eventId ?? row.event_id ?? null,
    sessionId: row.sessionId ?? row.session_id ?? null,
    songId: row.songId ?? row.song_id ?? null,
    sortOrder: row.sortOrder ?? row.sort_order ?? 0,
    sections,
    baseKey: row.baseKey ?? row.base_key ?? null,
    transpose: row.transpose ?? 0,
    capo: row.capo ?? null,
    moment: row.moment ?? null,
    note: row.note ?? null,
    song,
  };
}

/**
 * Susunan efektif tampil/ekspor: pemakaian per event menang,
 * lalu varian default master (pertama), lalu full master (null).
 */
export function effectiveArrangement(song, usageSections) {
  const u = normalizeArrangement(Array.isArray(usageSections) ? usageSections : null);
  if (u && u.length) return u;
  const first = namedArrangementsOf(song)?.variants?.[0];
  if (first && first.entries && first.entries.length) return first.entries;
  return null;
}

/** Payload siap dorong ke FreeShow lokal (POST http://localhost:5506). */
export function buildFreeShowPayload(song, usage) {
  const u = usage || {};
  const key = u.baseKey || song.defaultKey || '';
  const entries = resolveArrangement(
    String(song.lyricsChordPro || ''),
    effectiveArrangement(song, u.sections),
    u.transpose || 0,
    key || 'C',
  );
  const slides = {};
  const layoutSlides = [];
  entries.forEach((s, i) => {
    const id = `slide-${i + 1}`;
    const group = s.key ? `${s.label} · ${s.key}` : s.label;
    const lyricLines = s.lines.map((l) => stripChords(l).trim());
    const kept = lyricLines.filter((l, idx, arr) => l.length > 0 || (arr[idx - 1] !== '' && idx < arr.length - 1));
    slides[id] = {
      group,
      items: [
        {
          type: 'text',
          lines: (kept.length ? kept : ['(instrumental)']).map((value) => ({
            align: 'text-align:center;',
            text: [{ value }],
          })),
        },
      ],
    };
    layoutSlides.push({ id });
  });
  const now = Date.now();
  const slug = String(song.title || 'lagu').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'lagu';
  return {
    fileName: `${slug}.show`,
    actionHint: 'POST ke http://localhost:5506 (FreeShow → Connections → aktifkan API) atau File → Import → ChordPro.',
    show: {
      name: song.title,
      category: null,
      settings: { template: null, activeLayout: 'default' },
      timestamps: { created: now, modified: now },
      metadata: {
        title: song.title,
        author: song.authors || '',
        copyright: song.copyright || '',
        ccli: song.ccli || '',
        key: u.baseKey || song.defaultKey || '',
        transpose: u.transpose || 0,
        capo: u.capo ?? null,
        sourceRef: song.sourceRef || '',
      },
      slides,
      layouts: { default: { name: 'Default', notes: u.note || '', slides: layoutSlides } },
      media: {},
    },
  };
}

export function buildQuickLyrics(song, usage) {
  const u = usage || {};
  const lines = [`Title=${song.title}`];
  if (song.ccli) lines.push(`CCLI=${song.ccli}`);
  if (song.copyright) lines.push(`Copyright=${song.copyright}`);
  if (song.authors) lines.push(`Author=${song.authors}`);
  const key = u.baseKey || song.defaultKey;
  if (key) lines.push(`Key=${key}`);
  lines.push('');
  const body = renderSelectedSections(
    String(song.lyricsChordPro || ''),
    effectiveArrangement(song, u.sections),
    u.transpose || 0,
    key || 'C',
  );
  lines.push(stripChords(body).trim() || '(belum ada lirik — isi ChordPro dulu)');
  return lines.join('\n');
}

/** ChordPro siap unduh (bagian terpilih + transpose diterapkan). */
export function buildChordProExport(song, usage) {
  const u = usage || {};
  const head = [
    `{title: ${song.title}}`,
    song.authors ? `{artist: ${song.authors}}` : null,
    song.copyright ? `{copyright: ${song.copyright}}` : null,
    song.ccli ? `{ccli: ${song.ccli}}` : null,
    u.baseKey || song.defaultKey ? `{key: ${u.baseKey || song.defaultKey}}` : null,
    u.capo !== null && u.capo !== undefined ? `{capo: ${u.capo}}` : null,
  ].filter(Boolean);
  const body = renderSelectedSections(
    String(song.lyricsChordPro || ''),
    effectiveArrangement(song, u.sections),
    u.transpose || 0,
    u.baseKey || song.defaultKey || 'C',
    true,
  );
  return [...head, '', body.trim()].join('\n');
}
