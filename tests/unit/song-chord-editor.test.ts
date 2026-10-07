import { describe, expect, it } from 'vitest';
import {
  SECTION_TEMPLATES,
  applyChordLine,
  chordLyricPairs,
  compileChordOverLyrics,
  effectiveArrangement,
  findSuspectChords,
  isChordLine,
  keyIndex,
  transposeKey,
  transposeSteps,
} from '../../src/lib/song-chords';

describe('editor chord: isChordLine', () => {
  it('baris multi-chord dikenali', () => {
    expect(isChordLine('C          G          Am         F')).toBe(true);
    expect(isChordLine('[Verse 1]')).toBe(false);
    expect(isChordLine('')).toBe(false);
    expect(isChordLine('Kasih setia-Mu tak pernah berakhir')).toBe(false);
  });

  it('satu token ambigu diperlakukan hati-hati', () => {
    expect(isChordLine('C')).toBe(false); // bisa kata lirik
    expect(isChordLine('  G')).toBe(true); // menjorok = chord terposisi
    expect(isChordLine('Am')).toBe(true); // berkualitas
    expect(isChordLine('F#m7')).toBe(true);
    expect(isChordLine('C/G')).toBe(true);
  });
});

describe('editor chord: compileChordOverLyrics', () => {
  it('menggabung baris chord ke lirik di bawahnya', () => {
    const src = ['[Verse 1]', 'C          G', 'Kasih setia-Mu abadi'].join('\n');
    expect(compileChordOverLyrics(src)).toBe('[Verse 1]\n[C]Kasih setia[G]-Mu abadi');
  });

  it('header, baris kosong, dan lirik biasa tak tersentuh', () => {
    const src = ['[Chorus]', '', 'Besar setia-Mu', 'G', '', '[Ending]'].join('\n');
    // 'G' sendiri di kolom 0 = lirik (aman), bukan chord
    expect(compileChordOverLyrics(src)).toBe(src);
  });

  it('chord tanpa lirik di bawahnya dibiarkan', () => {
    const src = ['C     G', ''].join('\n');
    expect(compileChordOverLyrics(src)).toBe(src);
  });

  it('dua baris chord berurutan tidak digabung', () => {
    const src = 'C   G\nAm  F\nHaleluya';
    expect(compileChordOverLyrics(src)).toBe('C   G\n[Am]Hale[F]luya');
  });

  it('chord di luar panjang lirik menempel di akhir', () => {
    expect(compileChordOverLyrics('C         G7\nAjar kami')).toBe('[C]Ajar kami[G7]');
  });

  it('kata ambigu seperti "Amin" tidak dimakan (terbaca Am)', () => {
    const src = 'C   G\nAmin';
    expect(compileChordOverLyrics(src)).toBe(src);
  });
});

describe('editor chord: nada dasar & key picker', () => {
  it('transposeSteps 0-11 ke atas', () => {
    expect(transposeSteps('G', 'D')).toBe(7);
    expect(transposeSteps('C', 'C')).toBe(0);
    expect(transposeSteps('Bb', 'C')).toBe(2);
    expect(transposeSteps('F#', 'G')).toBe(1);
    expect(transposeSteps('H', 'C')).toBe(0);
    expect(transposeSteps('', 'C')).toBe(0);
  });

  it('keyIndex kenal flat', () => {
    expect(keyIndex('Bb')).toBe(10);
    expect(keyIndex('Db')).toBe(1);
    expect(keyIndex('H')).toBe(-1);
  });

  it('transposeKey menampilkan kunci hasil', () => {
    expect(transposeKey('G', 7)).toBe('D');
    expect(transposeKey('C', 0)).toBe('C');
    expect(transposeKey('Bb', 2)).toBe('C');
  });

  it('kosakata bagian baku tersedia', () => {
    for (const s of ['Verse 1', 'Pre-Chorus', 'Chorus', 'Bridge', 'Ending']) {
      expect(SECTION_TEMPLATES).toContain(s);
    }
  });
});

describe('editor chord: tab chord per baris', () => {
  const TEXT = ['[Verse 1]', '[G]Kasih [C]setia-Mu', '', 'Tak berubah'].join('\n');

  it('chordLyricPairs memisahkan header, pasangan, dan kosong', () => {
    const rows = chordLyricPairs(TEXT);
    expect(rows.map((r) => r.kind)).toEqual(['header', 'pair', 'blank', 'pair']);
    expect(rows[1]).toMatchObject({ chord: 'G     C', lyric: 'Kasih setia-Mu' });
    expect(rows[3]).toMatchObject({ chord: '', lyric: 'Tak berubah' });
  });

  it('applyChordLine menimpa chord lama secara posisional', () => {
    expect(applyChordLine('[G]Kasih [C]setia-Mu', 'D     A')).toBe('[D]Kasih [A]setia-Mu');
    expect(applyChordLine('[G]Kasih setia-Mu', '')).toBe('Kasih setia-Mu');
    expect(applyChordLine('Amin', 'G')).toBe('[G]Amin');
  });

  it('round-trip: pairs → apply → teks setara', () => {
    const rows = chordLyricPairs(TEXT).filter((r) => r.kind === 'pair');
    const rebuilt = rows.map((r) => applyChordLine(r.lyric, r.chord)).join('\n');
    expect(rebuilt).toBe('[G]Kasih [C]setia-Mu\nTak berubah');
  });

  it('findSuspectChords hanya peringatan', () => {
    expect(findSuspectChords('[G]Kasih [C]setia')).toEqual([]);
    expect(findSuspectChords('Ulangi [x2] chorus')).toEqual(['x2']);
  });
});

describe('editor chord: susunan efektif master', () => {
  const SONG = {
    title: 'X',
    lyricsChordPro: '[Verse 1]\na\n\n[Chorus]\nb',
    arrangement: [{ section: 'Chorus' }, { section: 'Verse 1' }],
  };

  it('pemakaian menang, lalu master, lalu null', () => {
    expect(effectiveArrangement(SONG, [{ section: 'Verse 1' }])?.map((e) => e.section)).toEqual(['Verse 1']);
    expect(effectiveArrangement(SONG, null)?.map((e) => e.section)).toEqual(['Chorus', 'Verse 1']);
    expect(effectiveArrangement({ title: 'Y', lyricsChordPro: '[Verse 1]\na' }, null)).toBeNull();
    expect(effectiveArrangement(null, null)).toBeNull();
  });

  it('arrangement string JSON ikut terbaca', () => {
    expect(
      effectiveArrangement({ title: 'Z', arrangement: '[{"section":"Chorus"}]' }, null)?.map((e) => e.section),
    ).toEqual(['Chorus']);
  });
});
