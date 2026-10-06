import { describe, expect, it } from 'vitest';
import { computeRegenDiff, proposalFromDraft } from '../../server/lib/didaskalia-diff.mjs';
import { defaultStudio, ensurePaths, ensureRhbSections, filterCommentsByScope, scopeLabel } from '../../src/lib/didaskalia';

function studioBase() {
  const s = defaultStudio();
  s.chapterNo = '0';
  s.kitabFokus = '1 Timotius 3:1-13';
  s.paths = ensurePaths(s).map((p, i) => ({
    ...p,
    dayLabel: `Hari ${i + 1}`,
    title: `Lama ${i + 1}`,
    rhbSections: ensureRhbSections(p.rhbSections),
  }));
  s.sermon = { ...s.sermon, summary: 'Ringkasan lama' };
  return s;
}

describe('computeRegenDiff', () => {
  it('mendeteksi perubahan judul Path, ringkasan, dan sermon', () => {
    const cur = studioBase();
    const prop = {
      ...cur,
      paths: cur.paths.map((p, i) => ({ ...p, title: `Baru ${i + 1}`, rhbSections: (p.rhbSections || []).map((x, xi) => (xi === 0 ? { ...x, body: 'Isi baru' } : x)) })),
      sermon: { ...cur.sermon, summary: 'Ringkasan baru' },
    };
    const { diff, summary } = computeRegenDiff(cur, prop);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.some((d) => d.label === 'Path 1 · Judul' && d.after === 'Baru 1')).toBe(true);
    expect(diff.some((d) => d.section === 'SERMON' && d.label === 'Ringkasan Khotbah')).toBe(true);
    expect(summary).toContain('Path berubah');
    expect(summary).toContain('RHB terisi');
  });

  it('tanpa perubahan → diff kosong & ringkasan khusus', () => {
    const cur = studioBase();
    const { diff, summary } = computeRegenDiff(cur, cur);
    expect(diff).toHaveLength(0);
    expect(summary).toContain('Tidak ada perubahan');
  });
});

describe('proposalFromDraft (struktur dikunci)', () => {
  it('mempertahankan dayLabel & key section dari data saat ini', () => {
    const cur = studioBase();
    const draft = {
      chapterNo: '1',
      paths: Array.from({ length: 7 }, (_, i) => ({
        title: `AI ${i + 1}`,
        dayLabel: 'XXXX',
        rhbSections: ensureRhbSections([]).map((s, si) => ({ key: s.key, title: s.title, body: `AI body ${i}-${si}` })),
      })),
      sermon: { ...cur.sermon, summary: 'AI ringkasan' },
    };
    const prop = proposalFromDraft(draft, cur);
    expect(prop.paths).toHaveLength(7);
    expect(prop.paths[0].dayLabel).toBe('Minggu'); // kalender baku, bukan draft maupun simpanan lama
    expect(prop.paths[6].dayLabel).toBe('Sabtu');
    expect(prop.paths[0].rhbSections.map((s) => s.key)).toEqual(['PENGANTAR', 'PEMBAHASAN_TEMATIS', 'MAKNA_IMPLIKASI', 'REFLEKSI_PRIBADI', 'DISKUSI_KELOMPOK']);
    expect(prop.paths[0].rhbSections[0].body).toBe('AI body 0-0');
    expect(prop.chapterNo).toBe('1');
  });

  it('usulan kosong = pertahankan lama (anti-hilang)', () => {
    const cur = studioBase();
    cur.paths[0].title = 'Judul Lama Kaya';
    cur.paths[0].rhbSections[0].body = 'Isi lama yang kaya dan panjang.';
    const draft = {
      paths: Array.from({ length: 7 }, (_, i) => ({
        title: i === 0 ? '   ' : `AI ${i + 1}`,
        rhbSections: ensureRhbSections([]).map((s) => ({ key: s.key, title: s.title, body: i === 0 ? '' : `Baru ${i}` })),
      })),
      sermon: {},
    };
    const prop = proposalFromDraft(draft, cur);
    expect(prop.paths[0].title).toBe('Judul Lama Kaya');
    expect(prop.paths[0].rhbSections[0].body).toBe('Isi lama yang kaya dan panjang.');
    expect(prop.paths[1].rhbSections[0].body).toBe('Baru 1');
    expect(prop.sermon.summary).toBe('Ringkasan lama');
  });

  it('peringatkan bila RHB menyusut >50%', () => {
    const cur = studioBase();
    cur.paths = cur.paths.map((p) => ({ ...p, rhbSections: (p.rhbSections || []).map((s) => ({ ...s, body: 'x'.repeat(500) })) }));
    const thin = { ...cur, paths: cur.paths.map((p) => ({ ...p, rhbSections: (p.rhbSections || []).map((s) => ({ ...s, body: 'tipis' })) })) };
    const { summary } = computeRegenDiff(cur, thin);
    expect(summary).toContain('PERINGATAN');
    const same = computeRegenDiff(cur, cur);
    expect(same.summary).not.toContain('PERINGATAN');
  });

  it('setelah reset (paths kosong) RHB dari AI tetap dipakai', () => {
    const cur = { ...studioBase(), paths: [] };
    const draft = {
      chapterNo: '0',
      paths: Array.from({ length: 7 }, (_, i) => ({
        title: `AI ${i + 1}`,
        dayLabel: 'XXXX',
        rhbSections: ensureRhbSections([]).map((s, si) => ({ key: s.key, title: s.title, body: `Isi ${i}-${si}` })),
      })),
      sermon: { ...cur.sermon, summary: 'AI' },
    };
    const prop = proposalFromDraft(draft, cur);
    expect(prop.paths[0].rhbSections).toHaveLength(5);
    expect(prop.paths[0].rhbSections[0].body).toBe('Isi 0-0');
  });
});

describe('scope diskusi', () => {
  const comments = [
    { id: '1', text: 'umum', scope: 'GENERAL' },
    { id: '2', text: 'p3', scope: 'PATH:3' },
    { id: '3', text: 'sermon', scope: 'SERMON' },
    { id: '4', text: 'tanpa scope' },
  ];

  it('filterCommentsByScope menyertakan GENERAL + scope target', () => {
    const p3 = filterCommentsByScope(comments, 'PATH:3').map((c) => c.id);
    expect(p3).toContain('1');
    expect(p3).toContain('2');
    expect(p3).toContain('4');
    expect(p3).not.toContain('3');
  });

  it('GENERAL hanya catatan umum/tanpa scope', () => {
    const g = filterCommentsByScope(comments, 'GENERAL').map((c) => c.id);
    expect(g).toEqual(['1', '4']);
  });

  it('scopeLabel ramah dibaca', () => {
    expect(scopeLabel('GENERAL')).toBe('Umum');
    expect(scopeLabel('PATH:3')).toBe('Path 3');
    expect(scopeLabel('SERMON')).toBe('Ringkasan Khotbah');
    expect(scopeLabel(undefined)).toBe('Umum');
  });
});
