import { describe, expect, it } from 'vitest';
import { mergeStudioSection, sanitizeSourceSnapshot } from '../../server/lib/didaskalia-section.mjs';
import { fieldOrigin, sourceChecklist, defaultStudio } from '../../src/lib/didaskalia';

describe('mergeStudioSection', () => {
  const base = () => ({
    kitabFokus: 'lama',
    discussion: [{ id: 'c1', text: 'tetap' }],
    paths: [
      { pathIndex: 1, title: 'A', scriptureRef: 'Yoh 1:1' },
      { pathIndex: 2, title: 'B', scriptureRef: 'Yoh 1:2' },
    ],
    sermon: { bigIdea: 'inti', outline: { pengantar: 'p', bedahTeologis: 'b', jembatan: '', kesimpulan: '' }, teksUtama: { ref: 'Kis 1:8', text: '' } },
    presentation: { cover: 'file-1' },
  });

  it('mengganti satu path tanpa menghapus path lain atau diskusi', () => {
    const next = mergeStudioSection(base(), { target: 'path', pathIndex: 2, path: { title: 'Baru', scriptureRef: 'Roma 12:11' } });
    expect(next.paths[0].title).toBe('A');
    expect(next.paths[1].title).toBe('Baru');
    expect(next.paths[1].scriptureRef).toBe('Roma 12:11');
    expect(next.discussion).toEqual([{ id: 'c1', text: 'tetap' }]);
    expect(next.paths).toHaveLength(7);
  });

  it('menyimpan metode dan chapter bersama khotbah tanpa mengosongkan outline', () => {
    const next = mergeStudioSection(base(), {
      target: 'sermon',
      homileticMethods: ['Narasi'],
      chapterNo: '12',
      fundamentalFirman: { text: 'kerangka' },
    });
    expect(next.homileticMethods).toEqual(['Narasi']);
    expect(next.chapterNo).toBe('12');
    expect(next.fundamentalFirman.text).toBe('kerangka');
    expect(next.sermon.outline.pengantar).toBe('p');
  });

  it('menggabungkan outline khotbah tanpa mengosongkan bagian lain', () => {
    const next = mergeStudioSection(base(), { target: 'sermon', sermon: { outline: { kesimpulan: 'akhir' }, bigIdea: 'baru' } });
    expect(next.sermon.bigIdea).toBe('baru');
    expect(next.sermon.outline.pengantar).toBe('p');
    expect(next.sermon.outline.kesimpulan).toBe('akhir');
    expect(next.sermon.teksUtama.ref).toBe('Kis 1:8');
  });

  it('sumber menulis kitab dan path tanpa menyentuh diskusi', () => {
    const next = mergeStudioSection(base(), {
      target: 'sumber',
      sumber: { kitabFokus: '2 Timotius 1:3-18', teksUtama: { ref: '1 Korintus 1:13' } },
    });
    expect(next.kitabFokus).toBe('2 Timotius 1:3-18');
    expect(next.sermon.teksUtama.ref).toBe('1 Korintus 1:13');
    expect(next.sermon.bigIdea).toBe('inti');
    expect(next.discussion[0].text).toBe('tetap');
    expect(next.presentation.cover).toBe('file-1');
  });

  it('target tidak dikenal tidak mengubah studio', () => {
    const src = base();
    const next = mergeStudioSection(src, { target: 'lain' });
    expect(next.kitabFokus).toBe('lama');
    expect(next).not.toBe(src);
  });
});

describe('sanitizeSourceSnapshot', () => {
  it('membuang snapshot kosong dan memotong judul', () => {
    expect(sanitizeSourceSnapshot(null)).toBeNull();
    const out = sanitizeSourceSnapshot({ kitabFundamental: 'x'.repeat(300), paths: [{ title: 'Judul', sections: { PENGANTAR: 'isi' } }] });
    expect(out.kitabFundamental).toHaveLength(160);
    expect(out.paths[0].sections.PENGANTAR).toBe('isi');
    expect(out.paths[0].pathIndex).toBe(1);
  });
});

describe('asal bagian dan checklist sumber', () => {
  it('dari MD bila sama, diubah bila beda, kosong bila tidak ada snapshot', () => {
    expect(fieldOrigin('sama', 'sama')).toBe('md');
    expect(fieldOrigin('beda', 'sama')).toBe('edited');
    expect(fieldOrigin('apa saja', '')).toBeNull();
    expect(fieldOrigin('apa saja', undefined)).toBeNull();
  });

  it('checklist menandai bagian kosong', () => {
    const studio = defaultStudio();
    studio.sermon.teksUtama.ref = '1 Korintus 1:13';
    studio.paths[0].title = 'Kasih';
    studio.paths[0].scriptureRef = 'Yohanes 4:13';
    const items = sourceChecklist(studio);
    expect(items.find((x) => x.id === 'fund')?.ok).toBe(true);
    expect(items.find((x) => x.id === 'fokus')?.ok).toBe(false);
    expect(items.find((x) => x.id === 't1')?.ok).toBe(true);
    expect(items.find((x) => x.id === 'n2')?.ok).toBe(false);
    expect(items.find((x) => x.id === 'pengantar')?.ok).toBe(false);
  });
});
