/**
 * Pustaka Lagu Liturgia — mesin ChordPro murni (tanpa dependensi).
 *
 * Kanonis: ChordPro inline `[C]` + header bagian per baris `[Verse 1]`.
 * Dipakai panel Liturgia (preview/transpose/pilih bagian) dan ekspor
 * FreeShow (Quick Lyrics + ChordPro + `.show` API-ready).
 */

export type SongSection = { name: string; lines: string[] };

export type SongLite = {
  id?: string;
  title: string;
  source?: string | null;
  sourceRef?: string | null;
  authors?: string | null;
  copyright?: string | null;
  ccli?: string | null;
  defaultKey?: string | null;
  lyricsChordPro?: string | null;
  /** Susunan default master; string JSON ikut diterima (baris DB mentah). */
  arrangement?: ArrangementEntryInput[] | string | null;
};

export type ServiceSongLite = {
  id?: string;
  songId?: string;
  sortOrder?: number | null;
  sections?: ArrangementEntryInput[] | null;
  baseKey?: string | null;
  transpose?: number | null;
  capo?: number | null;
  moment?: string | null;
  note?: string | null;
  song?: SongLite | null;
};

/**
 * Susunan ala ProPresenter: ordered list boleh berulang.
 * Entri string = nama bagian; objek = { section, key? } — key = kunci
 * modulasi ("main di D" mulai entri ini, berlaku ke bawah).
 */
export type ArrangementEntryInput =
  | string
  | { section?: unknown; key?: unknown; transpose?: unknown };

export type ArrangementEntry = {
  section: string;
  key: string | null;
  transpose: number | null;
};

export type ResolvedSection = {
  name: string;
  label: string;
  lines: string[];
  transpose: number;
  key: string | null;
};

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const CHORD_RE = /^([A-G])([#b]?)([^/]*?)(?:\/([A-G])([#b]?))?$/;

function transposeRoot(root: string, acc: string, semitones: number, preferFlat: boolean): string {
  const norm = ((n: number) => ((n % 12) + 12) % 12);
  const idx = SHARP.indexOf(root + acc);
  const flatIdx = idx === -1 ? FLAT.indexOf(root + acc) : idx;
  const i = idx === -1 ? flatIdx : idx;
  if (i === -1) return root + acc;
  const table = preferFlat ? FLAT : SHARP;
  return table[norm(i + semitones)];
}

/** True bila token dalam `[...]` adalah chord (bukan nama bagian). */
export function isChordToken(token: string): boolean {
  const t = token.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^(verse|chorus|bridge|intro|outro|interlude|ending|pre.?chorus|post.?chorus|tag|turn|instrumental)(\s+\d+)?$/i.test(t)) {
    return false;
  }
  return CHORD_RE.test(t);
}

/** Geser satu chord, mis. `transposeChord('F#m7/G#', 2)` → `G#m7/A#`. */
export function transposeChord(chord: string, semitones: number): string {
  const steps = Math.trunc(Number(semitones) || 0);
  if (!steps) return chord;
  const m = CHORD_RE.exec(chord.trim());
  if (!m) return chord;
  const [, root, acc, suffix, bassRoot, bassAcc] = m;
  if (/[^A-Gb#mMajdinsuogt0145679°ø+()\-.]/.test(suffix)) return chord;
  const preferFlat = (acc === 'b' || (bassAcc === 'b')) && acc !== '#';
  const next = transposeRoot(root, acc || '', steps, preferFlat);
  if (!bassRoot) return `${next}${suffix}`;
  return `${next}${suffix}/${transposeRoot(bassRoot, bassAcc || '', steps, preferFlat)}`;
}

const SECTION_LINE_RE = /^\s*\[([^\]]+)\]\s*$/;

/** Pecah ChordPro menjadi bagian-bagian `[Nama]` (fallback 1 bagian `Full`). */
export function parseSections(chordPro?: string | null): SongSection[] {
  const text = String(chordPro || '').replace(/\r\n/g, '\n');
  const sections: SongSection[] = [];
  let current: SongSection = { name: 'Full', lines: [] };
  let seenHeader = false;
  for (const rawLine of text.split('\n')) {
    const m = SECTION_LINE_RE.exec(rawLine);
    if (m && isChordToken(m[1]) === false) {
      if (seenHeader || current.lines.length) sections.push(current);
      current = { name: m[1].trim(), lines: [] };
      seenHeader = true;
    } else {
      current.lines.push(rawLine);
    }
  }
  sections.push(current);
  // Buang pembungkus kosong bila teks tanpa header.
  if (!seenHeader) return [{ name: 'Full', lines: text.split('\n') }];
  return sections.filter((s, i) => i < sections.length - 1 ? true : s.lines.join('').trim().length > 0 || sections.length === 1);
}

/** Daftar nama bagian untuk pemilih susunan. */
export function sectionNames(chordPro?: string | null): string[] {
  return parseSections(chordPro).map((s) => s.name);
}

function clampTranspose(n: unknown): number | null {
  if (n === undefined || n === null || n === '') return null;
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.max(-11, Math.min(11, v));
}

/** Normalisasi 1 entri susunan (string polos = ikut nada lagu). */
export function normalizeArrangementEntry(e: ArrangementEntryInput): ArrangementEntry | null {
  if (typeof e === 'string') {
    const section = e.trim();
    return section ? { section, key: null, transpose: null } : null;
  }
  if (e && typeof e === 'object') {
    const section = String((e as { section?: unknown }).section ?? '').trim();
    if (!section) return null;
    const keyRaw = String((e as { key?: unknown }).key ?? '').trim();
    const key = keyRaw && keyIndex(keyRaw) >= 0 ? keyRaw : null;
    return { section, key, transpose: clampTranspose((e as { transpose?: unknown }).transpose) };
  }
  return null;
}

/** Normalisasi susunan (maks 30 entri; kosong = null = full master). */
export function normalizeArrangement(input: unknown): ArrangementEntry[] | null {
  if (!Array.isArray(input)) return null;
  const out: ArrangementEntry[] = [];
  for (const e of input.slice(0, 30)) {
    const n = normalizeArrangementEntry(e as ArrangementEntryInput);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

function asArrangementArray(v: unknown): ArrangementEntryInput[] | null {
  if (Array.isArray(v)) return v as ArrangementEntryInput[];
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed: unknown = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as ArrangementEntryInput[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Susunan efektif tampil/ekspor: pemakaian per event menang,
 * lalu susunan default master, lalu full master (null).
 */
export function effectiveArrangement(
  song?: SongLite | null,
  usageSections?: ArrangementEntryInput[] | null,
): ArrangementEntry[] | null {
  const u = normalizeArrangement(usageSections ?? null);
  if (u && u.length) return u;
  const m = normalizeArrangement(asArrangementArray(song?.arrangement ?? null));
  if (m && m.length) return m;
  return null;
}

function transposeLines(lines: string[], steps: number): string[] {
  if (!steps) return lines;
  return transposeChordPro(lines.join('\n'), steps).split('\n');
}

/**
 * Uraikan susunan menjadi entri berurutan (boleh berulang; pengulangan
 * dilabeli "Chorus 2", dst; nama tak dikenal dilewati).
 * Modulasi: entri berkunci menghitung offset dari baseKey dan berlaku
 * ke bawah sampai override berikut.
 */
export function resolveArrangement(
  chordPro?: string | null,
  arrangement?: ArrangementEntryInput[] | null,
  songTranspose: number = 0,
  baseKey: string = 'C',
): ResolvedSection[] {
  const all = parseSections(chordPro || '');
  const byName = new Map(all.map((s) => [s.name.toLowerCase(), s]));
  const base = String(baseKey || 'C');
  const norm = normalizeArrangement(arrangement);
  const list: ArrangementEntry[] = norm && norm.length
    ? norm
    : all.map((s) => ({ section: s.name, key: null, transpose: null }));
  const counts: Record<string, number> = {};
  let cur = Math.trunc(Number(songTranspose) || 0);
  const out: ResolvedSection[] = [];
  for (const e of list) {
    const s = byName.get(e.section.toLowerCase());
    if (!s) continue;
    let t = cur;
    let key: string | null = null;
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
 * Render susunan: urutan + pengulangan sesuai arrangement, transpose
 * per entri sudah diterapkan. `markers=true` menyisipkan
 * `{comment: Modulasi ke X}` (untuk ChordPro/tab chord).
 */
export function renderSelectedSections(
  chordPro: string,
  selected?: ArrangementEntryInput[] | null,
  songTranspose: number = 0,
  baseKey: string = 'C',
  markers: boolean = false,
): string {
  const entries = resolveArrangement(chordPro, selected, songTranspose, baseKey);
  const out: string[] = [];
  for (const e of entries) {
    out.push(`[${e.label}${e.key ? ' · ' + e.key : ''}]`);
    if (markers && e.key) out.push(`{comment: Modulasi ke ${e.key}}`);
    out.push(...e.lines);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Geser seluruh chord inline `[C]` dalam ChordPro (header bagian tidak disentuh). */
export function transposeChordPro(chordPro: string, semitones: number): string {
  const steps = Math.trunc(Number(semitones) || 0);
  if (!steps) return chordPro;
  return String(chordPro || '')
    .split('\n')
    .map((line) => {
      if (SECTION_LINE_RE.test(line)) return line;
      return line.replace(/\[([^\]\n]+)\]/g, (full, token: string) =>
        isChordToken(token) ? `[${transposeChord(token, steps)}]` : full,
      );
    })
    .join('\n');
}

/** Lirik bersih tanpa chord inline (untuk Quick Lyrics / tampilan jemaat). */
export function stripChords(text: string): string {
  return String(text || '')
    .split('\n')
    .map((line) => {
      if (/^\s*\{[^}\n]*\}\s*$/.test(line)) return '';
      if (SECTION_LINE_RE.test(line)) return line;
      return line.replace(/\[([^\]\n]+)\]/g, (full, token: string) => (isChordToken(token) ? '' : full));
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

const DIRECTIVE_LINE_RE = /^\s*\{[^}\n]*\}\s*$/;

/**
 * Tab chord: lirik reference dirender ulang dengan baris chord sejajar
 * di atas tiap baris lirik (font monospace). Turunan murni — edit tetap
 * di ChordPro master. Header bagian & direktif diteruskan apa adanya.
 */
export function renderChordOverLyrics(text: string): string {
  const out: string[] = [];
  for (const rawLine of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    if (!rawLine.trim() || SECTION_LINE_RE.test(rawLine) || DIRECTIVE_LINE_RE.test(rawLine)) {
      out.push(rawLine);
      continue;
    }
    const lyricChars: string[] = [];
    const marks: Array<{ pos: number; token: string }> = [];
    const re = /\[([^\]\n]+)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
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
    const chordChars: string[] = [];
    for (const { pos, token } of marks) {
      while (chordChars.length < pos) chordChars.push(' ');
      for (const ch of token) chordChars.push(ch);
    }
    out.push(chordChars.join('').trimEnd(), lyricChars.join(''));
  }
  return out.join('\n');
}

/** Teks Quick Lyrics FreeShow: metadata + lirik bersih per bagian terpilih. */
export function buildQuickLyrics(song: SongLite, usage?: ServiceSongLite | null): string {
  const lines: string[] = [];
  lines.push(`Title=${song.title}`);
  if (song.ccli) lines.push(`CCLI=${song.ccli}`);
  if (song.copyright) lines.push(`Copyright=${song.copyright}`);
  if (song.authors) lines.push(`Author=${song.authors}`);
  const key = usage?.baseKey || song.defaultKey;
  if (key) lines.push(`Key=${key}`);
  lines.push('');
  const body = renderSelectedSections(
    String(song.lyricsChordPro || ''),
    effectiveArrangement(song, usage?.sections ?? null),
    usage?.transpose || 0,
    key || 'C',
  );
  lines.push(stripChords(body).trim() || '(belum ada lirik — isi ChordPro dulu)');
  return lines.join('\n');
}

function slugFile(name: string): string {
  return (
    String(name || 'lagu')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'lagu'
  );
}

type ShowSlide = {
  group: string | null;
  items: Array<{ type: string; lines: Array<{ align: string; text: Array<{ value: string }> }> }>;
};

/**
 * Bangun 1 objek `.show` FreeShow per lagu (format JSON ringkas API-ready:
 * `slides` per bagian + `layouts.Default` sesuai `sections` terpilih).
 */
export function buildFreeShow(song: SongLite, usage?: ServiceSongLite | null) {
  const key = usage?.baseKey || song.defaultKey || '';
  const entries = resolveArrangement(
    String(song.lyricsChordPro || ''),
    effectiveArrangement(song, usage?.sections ?? null),
    usage?.transpose || 0,
    key || 'C',
  );
  const slides: Record<string, ShowSlide> = {};
  const layoutSlides: Array<{ id: string }> = [];
  entries.forEach((s, i) => {
    const id = `slide-${i + 1}`;
    const group = s.key ? `${s.label} · ${s.key}` : s.label;
    const lyricLines = s.lines
      .map((l) => stripChords(l).trim())
      .filter((l, idx, arr) => l.length > 0 || (arr[idx - 1] !== '' && idx < arr.length - 1));
    slides[id] = {
      group,
      items: [
        {
          type: 'text',
          lines: (lyricLines.length ? lyricLines : ['(instrumental)']).map((value) => ({
            align: 'text-align:center;',
            text: [{ value }],
          })),
        },
      ],
    };
    layoutSlides.push({ id });
  });
  const now = Date.now();
  return {
    fileName: `${slugFile(song.title)}.show`,
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
        key,
        transpose: usage?.transpose || 0,
        capo: usage?.capo ?? null,
        sourceRef: song.sourceRef || '',
      },
      slides,
      layouts: { default: { name: 'Default', notes: usage?.note || '', slides: layoutSlides } },
      media: {},
    },
  };
}

/** Prompt yang bisa ditempel ke FreeShow via `CTRL+ALT+I` tidak tersedia di API. */
export function freeshowPushHint(): string {
  return 'Impor file: FreeShow → File → Import → ChordPro / Quick Lyrics (CTRL+ALT+I). API lokal http://localhost:5506 siap menerima payload buildFreeShow().';
}

export type ChordLyricRow = {
  key: string;
  kind: 'header' | 'pair' | 'blank';
  /** Indeks baris sumber dalam teks (untuk tulis-balik edit chord). */
  li: number;
  section: string | null;
  chord: string;
  lyric: string;
};

/**
 * Uraikan ChordPro menjadi baris edit tab Chord: tiap baris lirik
 * dipasangkan dengan baris chord sejajar (siap ketik; kosong bila belum ada).
 */
export function chordLyricPairs(text: string): ChordLyricRow[] {
  const rows: ChordLyricRow[] = [];
  let section: string | null = null;
  let n = 0;
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  for (let li = 0; li < lines.length; li += 1) {
    const rawLine = lines[li];
    const m = SECTION_LINE_RE.exec(rawLine);
    if (m && !isChordToken(m[1])) {
      section = m[1].trim();
      rows.push({ key: `h-${n++}`, kind: 'header', li, section, chord: '', lyric: '' });
      continue;
    }
    if (!rawLine.trim()) {
      rows.push({ key: `b-${n++}`, kind: 'blank', li, section, chord: '', lyric: '' });
      continue;
    }
    const cleanChars: string[] = [];
    const marks: Array<{ pos: number; token: string }> = [];
    const re = /\[([^\]\n]+)\]/g;
    let last = 0;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(rawLine)) !== null) {
      for (const ch of rawLine.slice(last, mm.index)) cleanChars.push(ch);
      if (isChordToken(mm[1])) {
        marks.push({ pos: cleanChars.length, token: mm[1] });
      } else {
        for (const ch of mm[0]) cleanChars.push(ch);
      }
      last = mm.index + mm[0].length;
    }
    for (const ch of rawLine.slice(last)) cleanChars.push(ch);
    const chordChars: string[] = [];
    for (const { pos, token } of marks) {
      while (chordChars.length < pos) chordChars.push(' ');
      for (const ch of token) chordChars.push(ch);
    }
    rows.push({ key: `l-${n++}`, kind: 'pair', li, section, chord: chordChars.join('').trimEnd(), lyric: cleanChars.join('') });
  }
  return rows;
}

/**
 * Terapkan baris chord ketikan ke satu baris lirik inline:
 * chord lama dibuang, chord baru disisipkan posisional. Token bukan
 * chord diabaikan (dibusukkan diam-diam — validasi terpisah).
 */
export function applyChordLine(lyricInline: string, chordText: string): string {
  const clean = String(lyricInline || '').replace(
    /\[([^\]\n]+)\]/g,
    (full, token: string) => (isChordToken(String(token)) ? '' : full),
  );
  const toks = chordTokensWithIndex(chordText).filter((t) => isChordToken(t.token));
  if (!toks.length) return clean;
  const sorted = [...toks].sort((a, b) => b.index - a.index);
  let out = clean;
  for (const { token, index } of sorted) {
    const at = Math.max(0, Math.min(index, out.length));
    out = `${out.slice(0, at)}[${token}]${out.slice(at)}`;
  }
  return out;
}

/** Token chord tak dikenal dalam teks (untuk validasi editor, bukan blokir). */
export function findSuspectChords(text: string): string[] {
  const bad = new Set<string>();
  for (const rawLine of String(text || '').split('\n')) {
    if (SECTION_LINE_RE.test(rawLine)) continue;
    const re = /\[([^\]\n]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawLine)) !== null) {
      if (!isChordToken(m[1])) bad.add(m[1]);
    }
  }
  return [...bad].slice(0, 10);
}

// ---------------- Editor ChordPro v2: template bagian + nada dasar ----------------

/** Kosakata bagian baku (saran editor; parser tetap generik). */
export const SECTION_TEMPLATES = [
  'Intro',
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Verse 4',
  'Pre-Chorus',
  'Chorus',
  'Bridge',
  'Interlude',
  'Ending',
  'Tag',
  'Coda',
];

const KEY_LIST = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_ALIAS: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

/** 12 kunci kromatis untuk picker nada dasar / kunci tampil. */
export const PICKER_KEYS = [...KEY_LIST];

/** Indeks kromatis 0–11, -1 bila tidak dikenal. */
export function keyIndex(key?: string | null): number {
  const k = String(key || '').trim();
  if (!k) return -1;
  return KEY_LIST.indexOf(FLAT_ALIAS[k] || k);
}

/** Geser kunci tampil: transposeChord(key, steps). */
export function transposeKey(baseKey: string, semitones: number): string {
  const i = keyIndex(baseKey);
  if (i < 0) return baseKey;
  return KEY_LIST[(((i + Math.trunc(Number(semitones) || 0)) % 12) + 12) % 12];
}

/**
 * Langkah transpose (0–11 ke atas) dari nada dasar ke kunci tampil.
 * Mod 12 identik untuk nama chord (mis. G→D = +7).
 */
export function transposeSteps(fromKey?: string | null, toKey?: string | null): number {
  const a = keyIndex(fromKey);
  const b = keyIndex(toKey);
  if (a < 0 || b < 0) return 0;
  return (((b - a) % 12) + 12) % 12;
}

/** Baris yang hanya berisi chord (candidates untuk digabung ke lirik di bawahnya). */
export function isChordLine(line: string): boolean {
  const exp = String(line || '').replace(/\t/g, '    ');
  if (!exp.trim()) return false;
  if (SECTION_LINE_RE.test(line)) return false;
  const toks = exp.trim().split(/\s+/);
  if (!toks.length || toks.some((t) => !isChordToken(t))) return false;
  if (toks.length > 1) return true;
  // 1 token: chord bila "kuat" (berkualitas/alterasi/bass) atau ditulis menjorok.
  const t = toks[0];
  const strong = /[#b/]/.test(t) || /[mM0-9susdimag+°ø().-]/.test(t.slice(1));
  return strong || /^\s/.test(exp);
}

function chordTokensWithIndex(line: string): Array<{ token: string; index: number }> {
  const exp = String(line || '').replace(/\t/g, '    ');
  const out: Array<{ token: string; index: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(exp)) !== null) out.push({ token: m[0], index: m.index });
  return out;
}

/**
 * Kompilasi gaya "chord di atas lirik" (2 baris) menjadi ChordPro inline.
 * Baris chord + baris lirik berikutnya → `[C]` disisipkan pada posisi kata.
 * Header `[Bagian]`, baris kosong, dan baris lirik biasa tidak disentuh.
 */
export function compileChordOverLyrics(text: string): string {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : null;
    if (
      isChordLine(line) && next !== null && next.trim() &&
      !SECTION_LINE_RE.test(next) && !isChordLine(next)
    ) {
      const toks = chordTokensWithIndex(line).sort((a, b) => b.index - a.index);
      let lyric = next;
      for (const { token, index } of toks) {
        const at = Math.max(0, Math.min(index, lyric.length));
        lyric = `${lyric.slice(0, at)}[${token}]${lyric.slice(at)}`;
      }
      out.push(lyric);
      i += 1;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
