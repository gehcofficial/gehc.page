import { describe, expect, it } from 'vitest';
import {
  buildRhbDayDeck,
  contentFromStudio,
} from '../../src/lib/didaskalia-presentation';
import { defaultStudio, ensurePaths, ensureRhbSections } from '../../src/lib/didaskalia';

function studioWithFullDay() {
  const studio = defaultStudio();
  studio.paths = ensurePaths(studio).map((p, i) => ({
    ...p,
    title: `Path ${i + 1} judul`,
    summary: `Ringkasan hari ${i + 1}`,
    scriptureRef: 'Yesaya 64:6',
    scriptureText: 'Sesungguhnya...',
    rhbSections: ensureRhbSections(p.rhbSections).map((s) => ({ ...s, body: `Isi ${s.key} hari ${i + 1}` })),
  }));
  return studio;
}

describe('buildRhbDayDeck (gambar harian ala khutbah)', () => {
  it('gambar AI harian dipakai semua slide sebagai background', () => {
    const studio = studioWithFullDay();
    const content = contentFromStudio(studio, 1, '2026-09-06', 'Tema');
    content.images = { rhbAi: { '3': 'ai-day-3' }, rhb: { '3': { cover: 'upload-cover' } } };
    const deck = buildRhbDayDeck(content, 3);
    expect(deck.length).toBeGreaterThan(3);
    for (const s of deck) {
      expect(s.imageFileId).toBe('ai-day-3');
      expect(s.background).toBe(true);
    }
  });

  it('tanpa AI: upload hero hari dipakai; tanpa harian: fallback section plain', () => {
    const studio = studioWithFullDay();
    const content = contentFromStudio(studio, 1, '', '');
    content.images = { rhb: { '3': { PENGANTAR: 'file-abc' } } };
    const deck = buildRhbDayDeck(content, 3);
    // Cover tanpa gambar (tak ada harian maupun cover pekan).
    expect(deck[0].imageFileId).toBeUndefined();
    const sec = deck.find((s) => s.id === 'sec-PENGANTAR');
    expect(sec?.imageFileId).toBe('file-abc');
    expect(sec?.background).toBe(false);
  });

  it('section panjang di-chunk bernomor ala khutbah', () => {
    const studio = studioWithFullDay();
    const long = Array.from({ length: 8 }, (_, i) => `Paragraf panjang ${i + 1} dengan uraian secukupnya agar rapi dibaca dan melampaui budget layar.`).join('\n\n');
    studio.paths[2] = {
      ...studio.paths[2],
      rhbSections: ensureRhbSections(studio.paths[2].rhbSections).map((s) => (s.key === 'PENGANTAR' ? { ...s, body: long } : { ...s, body: '' })),
    };
    const deck = buildRhbDayDeck(contentFromStudio(studio, 1, '', ''), 3);
    const peng = deck.filter((s) => s.id.startsWith('sec-PENGANTAR'));
    expect(peng.length).toBeGreaterThan(1);
    expect(peng[0].kicker).toContain('1/');
    expect(peng[0].title).toContain('(1/');
    // Semua kata sumber tetap ada (verbatim, tanpa potong kalimat).
    expect(deck.flatMap((s) => s.paragraphs || []).join('\n')).toContain('Paragraf panjang 8');
  });
});
