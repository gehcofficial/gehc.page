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

export function renderSelectedSections(chordPro, selected) {
  if (!Array.isArray(selected) || !selected.length) return String(chordPro || '');
  const want = new Set(selected.map((s) => String(s).toLowerCase()));
  const out = [];
  for (const s of parseSections(chordPro)) {
    if (want.has(s.name.toLowerCase())) out.push(`[${s.name}]`, ...s.lines);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripChords(text) {
  return String(text || '')
    .split('\n')
    .map((line) => {
      if (SECTION_LINE_RE.test(line)) return line;
      return line.replace(/\[([^\]\n]+)\]/g, (full, token) => (isChordToken(token) ? '' : full));
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
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
  if (b.tenantScope !== undefined) data.tenantScope = str(b.tenantScope, 64) || 'GLOBAL';
  else if (!existing) data.tenantScope = 'GLOBAL';
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
    if (!Array.isArray(b.sections)) throw Object.assign(new Error('sections harus array nama bagian.'), { status: 400 });
    sections = [...new Set(b.sections.map((s) => String(s).trim()).filter(Boolean))].slice(0, 30);
    if (!sections.length) sections = null;
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
    if (Array.isArray(arr) && arr.length) sections = arr.map((s) => String(s));
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

/** Payload siap dorong ke FreeShow lokal (POST http://localhost:5506). */
export function buildFreeShowPayload(song, usage) {
  const u = usage || {};
  const body = renderSelectedSections(String(song.lyricsChordPro || ''), u.sections);
  const transposed = transposeChordPro(body, u.transpose || 0);
  const sections = parseSections(transposed);
  const slides = {};
  const layoutSlides = [];
  sections.forEach((s, i) => {
    const id = `slide-${i + 1}`;
    const lyricLines = s.lines.map((l) => stripChords(l).trim());
    const kept = lyricLines.filter((l, idx, arr) => l.length > 0 || (arr[idx - 1] !== '' && idx < arr.length - 1));
    slides[id] = {
      group: s.name,
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
  const body = renderSelectedSections(String(song.lyricsChordPro || ''), u.sections);
  lines.push(stripChords(transposeChordPro(body, u.transpose || 0)).trim() || '(belum ada lirik — isi ChordPro dulu)');
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
  const body = renderSelectedSections(String(song.lyricsChordPro || ''), u.sections);
  return [...head, '', transposeChordPro(body, u.transpose || 0).trim()].join('\n');
}
