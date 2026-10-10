import { describe, expect, it } from 'vitest';
import {
  BOLLS_DISABLED,
  bookIdFor,
  bookNameFor,
  getBollsRange,
  isAblatedText,
  normVerseText,
  parseBollsRef,
  stripBollsHtml,
  verifyVerse,
  verseMatches,
} from '../../server/lib/bolls.mjs';

// Teks kanonis TB (diverifikasi live via bolls.life get-verse/get-text, Okt 2026).
const KORINTUS_TB = 'Dia yang tidak mengenal dosa telah dibuat-Nya menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.';
const KOLOSE_TB = 'Ia telah melepaskan kita dari kuasa kegelapan dan memindahkan kita ke dalam Kerajaan Anak-Nya yang kekasih; di dalam Dia kita memiliki penebusan kita, yaitu pengampunan dosa.';

describe('bookIdFor / bookNameFor (sinkron get-books/TB/)', () => {
  it('2 Korintus = 47, Kolose = 51', () => {
    expect(bookIdFor('2 Korintus')).toBe(47);
    expect(bookIdFor('2Kor')).toBe(47);
    expect(bookIdFor('Kolose')).toBe(51);
    expect(bookIdFor('Kol')).toBe(51);
    expect(bookIdFor('Kejadian')).toBe(1);
    expect(bookIdFor('Wahyu')).toBe(66);
    expect(bookNameFor(47)).toBe('2 Korintus');
    expect(bookNameFor(51)).toBe('Kolose');
  });
  it('tak dikenal → null', () => {
    expect(bookIdFor('Korintus-an')).toBeNull();
    expect(bookIdFor('')).toBeNull();
    expect(bookNameFor(0)).toBeNull();
    expect(bookNameFor(67)).toBeNull();
  });
});

describe('parseBollsRef', () => {
  it('mengenali ref Korintus & Kolose (termasuk en-dash)', () => {
    expect(parseBollsRef('2 Korintus 5:21')).toMatchObject({ bookId: 47, chapter: 5, verseStart: 21, verseEnd: 21 });
    expect(parseBollsRef('Kolose 1:13-14')).toMatchObject({ bookId: 51, chapter: 1, verseStart: 13, verseEnd: 14 });
    expect(parseBollsRef('Kolose 1:13–14')).toMatchObject({ bookId: 51, verseStart: 13, verseEnd: 14 });
    expect(parseBollsRef('Kol 1:13-14')).toMatchObject({ bookId: 51, verseStart: 13, verseEnd: 14 });
  });
  it('menolak ref rusak (tak mengarang)', () => {
    expect(parseBollsRef('Korintus-an 5:21')).toBeNull();
    expect(parseBollsRef('2 Korintus')).toBeNull();
    expect(parseBollsRef('')).toBeNull();
  });
});

describe('stripBollsHtml', () => {
  it('mengupas nomor Strong KJV + tag + entitas', () => {
    expect(stripBollsHtml('For<S>1063</S> he hath made<S>4160</S> him')).toBe('For he hath made him');
    expect(stripBollsHtml('a<br>b')).toBe('a b');
    expect(stripBollsHtml('kasih &amp; karunia')).toBe('kasih & karunia');
  });
});

describe('verseMatches (toleran koma/spasi agar warning tak rewel)', () => {
  it('beda koma saja tetap match', () => {
    expect(verseMatches(KORINTUS_TB, 'Dia yang tidak mengenal dosa, telah dibuat-Nya menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.')).toBe(true);
  });
  it('Korintus vs Kolose = beda (regresi swap W2)', () => {
    expect(verseMatches(KORINTUS_TB, KOLOSE_TB)).toBe(false);
    expect(verseMatches(KOLOSE_TB, KORINTUS_TB)).toBe(false);
    expect(verseMatches(KORINTUS_TB, KORINTUS_TB)).toBe(true);
  });
  it('kosong → false', () => {
    expect(verseMatches('', KORINTUS_TB)).toBe(false);
    expect(verseMatches(KORINTUS_TB, '')).toBe(false);
  });
});

describe('isAblatedText', () => {
  it('mendeteksi protes Biblica NIV', () => {
    expect(isAblatedText('Biblica, Inc. has prohibited me from using the NIV translation')).toBe(true);
    expect(isAblatedText(KORINTUS_TB)).toBe(false);
  });
  it('NIV tercatat disabled', () => {
    expect(BOLLS_DISABLED.NIV).toMatch(/Biblica/i);
  });
});

function fakeFetch(rowsByUrl) {
  return async (url) => ({
    ok: true,
    json: async () => rowsByUrl[String(url)] ?? [],
  });
}

describe('getBollsRange / verifyVerse (fetch injeksi, tanpa network)', () => {
  const parsed = { bookId: 47, book: '2 Korintus', chapter: 5, verseStart: 21, verseEnd: 21 };
  const rows = [{ pk: 1, verse: 21, text: `Dia yang tidak mengenal dosa<S>264</S> telah dibuat-Nya menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.` }];
  const fetchImpl = fakeFetch({ 'https://bolls.life/get-text/TB/47/5/': rows });

  it('menggabung rentang + kupas Strong', async () => {
    const out = await getBollsRange('TB', parsed, { fetchImpl });
    expect(out.text).toBe(KORINTUS_TB);
    expect(out.ablated).toBe(false);
    expect(out.attribution).toMatch(/LAI/);
  });
  it('verifyVerse menolak NIV + versi asing', async () => {
    const r = await verifyVerse('2 Korintus 5:21', ['TB', 'NIV', 'XYZ'], { fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.results.find((x) => x.version === 'TB')?.text).toBe(KORINTUS_TB);
    expect(r.results.find((x) => x.version === 'NIV')?.disabled).toBe(true);
    expect(r.results.find((x) => x.version === 'XYZ')?.error).toMatch(/belum didukung/);
  });
  it('verifyVerse menolak ref rusak', async () => {
    const r = await verifyVerse('Korintus-an 5:21', ['TB'], { fetchImpl });
    expect(r.ok).toBe(false);
  });
});

describe('normVerseText', () => {
  it('stabil untuk perbandingan', () => {
    expect(normVerseText('  Ia telah MELEPASKAN kita; ')).toBe('ia telah melepaskan kita');
  });
});
