import { describe, expect, it } from 'vitest';
import {
  buildFreeShow,
  buildQuickLyrics,
  isChordToken,
  parseSections,
  renderSelectedSections,
  stripChords,
  transposeChord,
  transposeChordPro,
} from '../../src/lib/song-chords';
import {
  buildChordProExport,
  buildFreeShowPayload,
  buildQuickLyrics as serverQuickLyrics,
  normalizeServiceSongInput,
  normalizeSongInput,
  parseSections as serverParse,
  renderSelectedSections as serverRender,
  transposeChord as serverTranspose,
  transposeChordPro as serverTransposePro,
} from '../../server/lib/liturgy-songs.mjs';

const SAMPLE = [
  '[Verse 1]',
  '[G]Kasih setia-Mu [C]tak pernah berakhir,',
  '[Em]setiap pagi selalu [D]baru.',
  '',
  '[Chorus]',
  '[G]Besar setia-Mu, [C]besar setia-Mu.',
].join('\n');

describe('liturgia-songs: transpose chord', () => {
  it.each([
    ['C', 2, 'D'],
    ['G', 2, 'A'],
    ['Bb', 2, 'C'],
    ['F#m7', -2, 'Em7'],
    ['C/G', 5, 'F/C'],
    ['Am', 3, 'Cm'],
  ])('%s %+i → %s', (chord, steps, expected) => {
    expect(transposeChord(chord, steps)).toBe(expected);
    expect(serverTranspose(chord, steps)).toBe(expected);
  });

  it('token bagian bukan chord', () => {
    expect(isChordToken('Chorus')).toBe(false);
    expect(isChordToken('Verse 1')).toBe(false);
    expect(isChordToken('C')).toBe(true);
    expect(isChordToken('F#m7/G#')).toBe(true);
  });

  it('header bagian tidak ikut digeser', () => {
    const out = transposeChordPro(SAMPLE, 2);
    expect(out).toContain('[Verse 1]');
    expect(out).toContain('[Chorus]');
    expect(out).toContain('[A]');
    expect(out).toContain('[D]');
    expect(serverTransposePro(SAMPLE, 2)).toBe(out);
  });
});

describe('liturgia-songs: sections', () => {
  it('parseSections memecah per header', () => {
    const names = parseSections(SAMPLE).map((s) => s.name);
    expect(names).toEqual(['Verse 1', 'Chorus']);
    expect(serverParse(SAMPLE).map((s) => s.name)).toEqual(names);
  });

  it('renderSelectedSections hanya mengambil yang dipilih', () => {
    const only = renderSelectedSections(SAMPLE, ['Chorus']);
    expect(only).toContain('[Chorus]');
    expect(only).not.toContain('[Verse 1]');
    expect(serverRender(SAMPLE, ['Chorus'])).toBe(only);
  });

  it('stripChords membersihkan chord untuk jemaat', () => {
    const clean = stripChords(SAMPLE);
    expect(clean).toContain('[Chorus]');
    expect(clean).not.toContain('[G]');
    expect(clean).toContain('Besar setia-Mu');
  });
});

describe('liturgia-songs: ekspor FreeShow', () => {
  const song = {
    title: 'Kasih Setia-Mu',
    authors: 'Tim Musik',
    copyright: '© Tim',
    ccli: '123',
    defaultKey: 'G',
    lyricsChordPro: SAMPLE,
  };
  const usage = { sections: ['Chorus'], transpose: 2, baseKey: 'G', capo: 0, note: 'penutup' };

  it('Quick Lyrics: metadata + lirik bersih bagian terpilih', () => {
    const q = buildQuickLyrics(song, usage);
    expect(q).toContain('Title=Kasih Setia-Mu');
    expect(q).toContain('CCLI=123');
    expect(q).toContain('Besar setia-Mu');
    expect(q).not.toContain('Kasih setia-Mu [');
    expect(q).not.toContain('[A]');
    expect(serverQuickLyrics(song, usage)).toBe(q);
  });

  it('.show: slide per bagian + metadata kunci/transpose', () => {
    const built = buildFreeShow(song, usage);
    expect(built.fileName).toMatch(/\.show$/);
    expect(Object.keys(built.show.slides)).toHaveLength(1);
    expect(built.show.layouts.default.slides).toHaveLength(1);
    expect(built.show.metadata.key).toBe('G');
    expect(built.show.metadata.transpose).toBe(2);
    const server = buildFreeShowPayload(song, usage);
    expect(server.fileName).toBe(built.fileName);
    expect(server.show.metadata.ccli).toBe('123');
  });

  it('ChordPro export: header + transpose diterapkan', () => {
    const c = buildChordProExport(song, usage);
    expect(c).toContain('{title: Kasih Setia-Mu}');
    expect(c).toContain('{key: G}');
    expect(c).toContain('[A]');
    expect(c).not.toContain('[Verse 1]');
  });
});

describe('liturgia-songs: validasi server', () => {
  it('judul wajib', () => {
    expect(() => normalizeSongInput({})).toThrow('Judul lagu wajib.');
  });

  it('sumber & kunci divalidasi', () => {
    expect(() => normalizeSongInput({ title: 'X', source: 'SPOTIFY' })).toThrow();
    expect(() => normalizeSongInput({ title: 'X', defaultKey: 'H' })).toThrow();
    expect(normalizeSongInput({ title: ' X ' }).title).toBe('X');
  });

  it('transpose dijepit ±11, sections dibersihkan', () => {
    const n = normalizeServiceSongInput({ transpose: 99, sections: [' Chorus ', '', 'Chorus'], moment: 'pembuka' });
    expect(n.transpose).toBe(11);
    expect(n.sections).toEqual(['Chorus']);
    expect(n.moment).toBe('pembuka');
    expect(() => normalizeServiceSongInput({ moment: 'solo' })).toThrow();
  });
});
