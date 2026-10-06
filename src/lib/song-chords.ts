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
};

export type ServiceSongLite = {
  id?: string;
  songId?: string;
  sortOrder?: number | null;
  sections?: string[] | null;
  baseKey?: string | null;
  transpose?: number | null;
  capo?: number | null;
  moment?: string | null;
  note?: string | null;
  song?: SongLite | null;
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

/** Daftar nama bagian untuk checkbox "pakai bagian ini saja". */
export function sectionNames(chordPro?: string | null): string[] {
  return parseSections(chordPro).map((s) => s.name);
}

/** Render ChordPro hanya untuk bagian terpilih (null/kosong = semua). */
export function renderSelectedSections(chordPro: string, selected?: string[] | null): string {
  if (!selected || !selected.length) return chordPro;
  const want = new Set(selected.map((s) => s.toLowerCase()));
  const out: string[] = [];
  for (const s of parseSections(chordPro)) {
    if (want.has(s.name.toLowerCase())) {
      out.push(`[${s.name}]`, ...s.lines);
    }
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
      if (SECTION_LINE_RE.test(line)) return line;
      return line.replace(/\[([^\]\n]+)\]/g, (full, token: string) => (isChordToken(token) ? '' : full));
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
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
    usage?.sections ?? null,
  );
  const transposed = transposeChordPro(body, usage?.transpose || 0);
  lines.push(stripChords(transposed).trim() || '(belum ada lirik — isi ChordPro dulu)');
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
  const body = renderSelectedSections(String(song.lyricsChordPro || ''), usage?.sections ?? null);
  const transposed = transposeChordPro(body, usage?.transpose || 0);
  const sections = parseSections(transposed);
  const slides: Record<string, ShowSlide> = {};
  const layoutSlides: Array<{ id: string }> = [];
  sections.forEach((s, i) => {
    const id = `slide-${i + 1}`;
    const lyricLines = s.lines
      .map((l) => stripChords(l).trim())
      .filter((l, idx, arr) => l.length > 0 || (arr[idx - 1] !== '' && idx < arr.length - 1));
    slides[id] = {
      group: s.name,
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
  const key = usage?.baseKey || song.defaultKey || '';
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
