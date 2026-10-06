import { describe, expect, it } from 'vitest';
import {
  defaultStudio,
  ensurePaths,
  hashContent,
  needsRepublish,
  statusLabel,
} from '../../src/lib/didaskalia';

describe('didaskalia helpers', () => {
  it('ensurePaths selalu menghasilkan 7 path lengkap', () => {
    const paths = ensurePaths(defaultStudio());
    expect(paths).toHaveLength(7);
    expect(paths[0].pathIndex).toBe(1);
    expect(paths[6].pathIndex).toBe(7);
    expect(paths[0].title).toBe('Path 1');
    expect(Array.isArray(paths[0].fgdQuestions)).toBe(true);
  });

  it('ensurePaths mempertahankan field yang sudah ada', () => {
    const studio = { ...defaultStudio(), paths: [{ ...defaultStudio().paths[0], title: 'Gereja Mula-mula' }] };
    const paths = ensurePaths(studio);
    expect(paths[0].title).toBe('Gereja Mula-mula');
    expect(paths[1].title).toBe('Path 2');
  });

  it('ensurePaths memaksa hari kalender (Path 1 = Minggu)', () => {
    const studio = {
      ...defaultStudio(),
      paths: Array.from({ length: 7 }, (_, i) => ({
        ...defaultStudio().paths[i],
        dayLabel: ['Senin', '2026-10-05', 'Tuesday', '', 'Kamis', 'Jumat', 'Saturday'][i],
      })),
    };
    const paths = ensurePaths(studio);
    expect(paths.map((p) => p.dayLabel)).toEqual(['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']);
    expect(paths.map((p) => p.pathIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('hashContent deterministik dan berubah bila konten berubah', () => {
    const a = { paths: [{ title: 'A' }] };
    const b = { paths: [{ title: 'B' }] };
    expect(hashContent(a)).toBe(hashContent({ paths: [{ title: 'A' }] }));
    expect(hashContent(a)).not.toBe(hashContent(b));
  });

  it('needsRepublish true sebelum rilis dan false setelah hash cocok', () => {
    const studio = defaultStudio();
    expect(needsRepublish(studio, 'pembekalan')).toBe(true);
    const payload = hashContent({
      chapterNo: studio.chapterNo,
      fundamentalFirman: studio.fundamentalFirman,
      kitabFokus: studio.kitabFokus,
      paths: studio.paths,
    });
    studio.render.pembekalan = { version: 1, renderedAt: 'now', files: [], contentHash: payload };
    expect(needsRepublish(studio, 'pembekalan')).toBe(false);
  });

  it('statusLabel menerjemahkan status', () => {
    expect(statusLabel('PUBLISHED')).toBe('Rilis');
    expect(statusLabel('DRAFT')).toBe('Draf');
  });
});
