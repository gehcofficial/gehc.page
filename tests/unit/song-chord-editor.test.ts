import { describe, expect, it } from 'vitest';
import {
  SECTION_TEMPLATES,
  compileChordOverLyrics,
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
