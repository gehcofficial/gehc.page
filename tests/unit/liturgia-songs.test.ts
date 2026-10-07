import { describe, expect, it } from 'vitest';
import {
  buildFreeShow,
  buildQuickLyrics,
  isChordToken,
  normalizeArrangement,
  parseSections,
  renderChordOverLyrics,
  renderSelectedSections,
  resolveArrangement,
  stripChords,
  transposeChord,
  transposeChordPro,
} from '../../src/lib/song-chords';
import {
  SECULAR_ALLOWED_MOMENTS,
  SONG_SOURCES,
  assertSecularMoment,
  buildChordProExport,
  buildFreeShowPayload,
  buildQuickLyrics as serverQuickLyrics,
  normalizeArrangement as serverNormalizeArrangement,
  normalizeServiceSongInput,
  normalizeSongInput,
  parseSections as serverParse,
  renderChordOverLyrics as serverRenderChordOver,
  renderSelectedSections as serverRender,
  resolveArrangement as serverResolve,
  serializeSong,
  transposeChord as serverTranspose,
  transposeChordPro as serverTransposePro,
  validateArrangementSections,
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

  it('transpose dijepit ±11, sections jadi susunan berurutan', () => {
    const n = normalizeServiceSongInput({ transpose: 99, sections: [' Chorus ', '', 'Chorus'], moment: 'pembuka' });
    expect(n.transpose).toBe(11);
    expect(n.sections).toEqual([
      { section: 'Chorus', key: null, transpose: null },
      { section: 'Chorus', key: null, transpose: null },
    ]);
    expect(n.moment).toBe('pembuka');
    expect(() => normalizeServiceSongInput({ moment: 'solo' })).toThrow();
  });

  it('sections menerima entri objek + kunci dimodulasi', () => {
    const n = normalizeServiceSongInput({
      sections: [{ section: 'Verse 1' }, { section: 'Chorus', key: 'D' }, { section: 'Chorus', key: 'H' }],
    });
    expect(n.sections).toEqual([
      { section: 'Verse 1', key: null, transpose: null },
      { section: 'Chorus', key: 'D', transpose: null },
      { section: 'Chorus', key: null, transpose: null },
    ]);
  });

  it('sumber himne GMIM + sekuler terdaftar', () => {
    for (const s of ['HIMNE_KJ', 'HIMNE_NKB', 'HIMNE_NNBT', 'HIMNE_PKJ', 'KLIK', 'KONTEMPORER', 'LOKAL', 'SEKULER']) {
      expect(SONG_SOURCES).toContain(s);
    }
    expect(SECULAR_ALLOWED_MOMENTS).toEqual(['bedah-lagu', 'bebas']);
  });

  it('sekuler: hanya momen bebas/bedah-lagu', () => {
    expect(() => assertSecularMoment('SEKULER', 'bebas')).not.toThrow();
    expect(() => assertSecularMoment('SEKULER', 'bedah-lagu')).not.toThrow();
    expect(() => assertSecularMoment('SEKULER', null)).not.toThrow();
    expect(() => assertSecularMoment('HIMNE_KJ', 'firman')).not.toThrow();
    expect(() => assertSecularMoment('SEKULER', 'firman')).toThrow('momen bebas');
    expect(() => assertSecularMoment('SEKULER', 'pembuka')).toThrow();
  });

  it('sekuler: wajib pencipta + tautan, tanpa lirik', () => {
    expect(() => normalizeSongInput({ title: 'X', source: 'SEKULER' })).toThrow('pencipta');
    expect(() => normalizeSongInput({ title: 'X', source: 'SEKULER', authors: 'A' })).toThrow('tautan');
    expect(() =>
      normalizeSongInput({ title: 'X', source: 'SEKULER', authors: 'A', sourceUrl: 'https://x', lyricsChordPro: '[C]la' }),
    ).toThrow('tidak disimpan');
    const ok = normalizeSongInput({ title: 'X', source: 'SEKULER', authors: 'A', sourceUrl: 'https://x' });
    expect(ok.source).toBe('SEKULER');
  });

  it('kisah + makna: dinormalisasi & diserialisasi (kurasi bedah lagu)', () => {
    const n = normalizeSongInput({ title: 'KJ 10', story: '  Kisah Nokseng.  ', meaning: '' });
    expect(n.story).toBe('Kisah Nokseng.');
    expect(n.meaning).toBeNull();
    const cleared = normalizeSongInput({ title: 'KJ 10', story: null }, { story: 'lama' });
    expect(cleared.story).toBeNull();
    expect('story' in normalizeSongInput({ title: 'KJ 10' })).toBe(false);
    const s = serializeSong({ id: 'x', title: 'T', source: 'HIMNE_KJ', story: 'Kisah.', meaning: null, lyricsChordPro: null });
    expect(s.story).toBe('Kisah.');
    expect(s.meaning).toBeNull();
    expect(serializeSong({ id: 'y', title: 'T2', source: 'HIMNE_NKB' }).story).toBeNull();
  });
});

describe('liturgia-songs: susunan ala ProPresenter', () => {
  const arrOf = (r) => r.map((e) => e.label);

  it('urutan + pengulangan sesuai arrangement (label Chorus 2)', () => {
    const r = resolveArrangement(SAMPLE, ['Chorus', 'Verse 1', 'Chorus']);
    expect(arrOf(r)).toEqual(['Chorus', 'Verse 1', 'Chorus 2']);
    expect(r[0].lines.join('\n')).toContain('Besar setia-Mu');
    expect(serverResolve(SAMPLE, ['Chorus', 'Verse 1', 'Chorus']).map((e) => e.label)).toEqual(arrOf(r));
  });

  it('kosong = full master sesuai urutan lagu', () => {
    expect(arrOf(resolveArrangement(SAMPLE, null))).toEqual(['Verse 1', 'Chorus']);
    expect(arrOf(resolveArrangement(SAMPLE, []))).toEqual(['Verse 1', 'Chorus']);
  });

  it('nama tak dikenal dilewati; validasi server menolaknya', () => {
    expect(arrOf(resolveArrangement(SAMPLE, ['Verse 1', 'BridgeX']))).toEqual(['Verse 1']);
    expect(() => validateArrangementSections([{ section: 'BridgeX' }], ['Verse 1', 'Chorus'])).toThrow('BridgeX');
    expect(() => validateArrangementSections([{ section: 'Chorus' }], ['Verse 1', 'Chorus'])).not.toThrow();
    expect(() => validateArrangementSections(null, ['Verse 1'])).not.toThrow();
  });

  it('modulasi per entri berlaku ke bawah (G→D = +7 dari Chorus)', () => {
    const r = resolveArrangement(SAMPLE, ['Verse 1', { section: 'Chorus', key: 'D' }], 0, 'G');
    expect(r[0].transpose).toBe(0);
    expect(r[1].transpose).toBe(7);
    expect(r[1].key).toBe('D');
    expect(r[1].lines.join('\n')).toContain('[D]');
    const back = resolveArrangement(
      SAMPLE,
      [{ section: 'Verse 1', key: 'D' }, { section: 'Chorus' }],
      0,
      'G',
    );
    expect(back.map((e) => e.transpose)).toEqual([7, 7]);
    expect(serverResolve(SAMPLE, ['Verse 1', { section: 'Chorus', key: 'D' }], 0, 'G').map((e) => e.transpose)).toEqual([0, 7]);
  });

  it('kunci tak valid diabaikan; transpose mentah dijepit', () => {
    expect(normalizeArrangement([{ section: 'Chorus', key: 'H' }])).toEqual([{ section: 'Chorus', key: null, transpose: null }]);
    expect(normalizeArrangement([{ section: 'Chorus', transpose: 99 }])).toEqual([{ section: 'Chorus', key: null, transpose: 11 }]);
    expect(normalizeArrangement(['', '  '])).toBeNull();
    expect(serverNormalizeArrangement(['Chorus', { section: 'Verse 1', key: 'D' }])).toEqual([
      { section: 'Chorus', key: null, transpose: null },
      { section: 'Verse 1', key: 'D', transpose: null },
    ]);
  });

  it('renderSelectedSections ikut urutan susunan + penanda modulasi', () => {
    const out = renderSelectedSections(SAMPLE, ['Chorus', 'Verse 1'], 0, 'G', true);
    expect(out.indexOf('[Chorus]')).toBeLessThan(out.indexOf('[Verse 1]'));
    const mod = renderSelectedSections(SAMPLE, [{ section: 'Chorus', key: 'D' }], 0, 'G', true);
    expect(mod).toContain('[Chorus · D]');
    expect(mod).toContain('{comment: Modulasi ke D}');
    expect(mod).toContain('[D]Besar setia-Mu, [G]besar setia-Mu.');
    expect(serverRender(SAMPLE, [{ section: 'Chorus', key: 'D' }], 0, 'G', true)).toBe(mod);
  });

  it('Quick Lyrics + .show mengikuti susunan & modulasi', () => {
    const song = { title: 'T', defaultKey: 'G', lyricsChordPro: SAMPLE };
    const usage = { sections: ['Chorus', 'Verse 1', 'Chorus'], transpose: 0, baseKey: 'G' };
    const q = buildQuickLyrics(song, usage);
    const iC = q.indexOf('[Chorus]');
    expect(iC).toBeGreaterThan(-1);
    expect(q.indexOf('Besar setia-Mu')).toBeGreaterThan(iC);
    expect(q.indexOf('Kasih setia-Mu')).toBeGreaterThan(q.indexOf('[Verse 1]'));
    const built = buildFreeShow(song, { ...usage, sections: [{ section: 'Chorus', key: 'D' }] });
    const groups = Object.values(built.show.slides).map((s) => (s as { group: string }).group);
    expect(groups).toEqual(['Chorus · D']);
  });
});

describe('liturgia-songs: tab chord (chord di atas lirik)', () => {
  it('chord sejajar di atas kata yang tepat', () => {
    const out = renderChordOverLyrics('[G]Kasih [C]setia');
    expect(out).toBe('G     C\nKasih setia');
    expect(serverRenderChordOver(out)).toBe(out);
  });

  it('header, direktif, dan baris polos diteruskan', () => {
    const out = renderChordOverLyrics('[Verse 1]\n{comment: Modulasi ke D}\n\nHalo');
    expect(out).toBe('[Verse 1]\n{comment: Modulasi ke D}\n\nHalo');
  });

  it('stripChords membuang baris direktif', () => {
    expect(stripChords('[Chorus]\n{comment: Modulasi ke D}\n[G]Amin')).toBe('[Chorus]\n\nAmin');
  });
});
