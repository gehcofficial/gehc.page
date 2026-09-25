import { describe, expect, it } from 'vitest';
import { extractJson, repairJson } from '../../server/lib/didaskalia-ai.mjs';

describe('penjagaan JSON keluaran AI', () => {
  it('mem-parse JSON lengkap seperti biasa', () => {
    const out = extractJson('ini teks {"a":1,"b":[2,3]} penutup');
    expect(out).toEqual({ a: 1, b: [2, 3] });
  });

  it('repairJson menutup JSON yang terpotong', () => {
    const truncated = '{"chapterNo":"0","paths":[{"pathIndex":1,"title":"A","rhbSections":[{"key":"PENGANTAR","body":"x"}';
    const repaired = repairJson(truncated);
    expect(repaired).not.toBeNull();
    expect(repaired.chapterNo).toBe('0');
    expect(Array.isArray(repaired.paths)).toBe(true);
    expect(repaired.paths[0].title).toBe('A');
    expect(repaired.paths[0].rhbSections[0].body).toBe('x');
  });

  it('extractJson tidak melempar untuk keluaran terpotong (best-effort)', () => {
    const truncated = '{"paths":[{"pathIndex":1,"title":"B","reflection":"halo';
    const out = extractJson(truncated);
    expect(out.paths[0].title).toBe('B');
  });

  it('membuang sisa elemen yang menggantung di ujung', () => {
    const truncated = '{"paths":[{"title":"A"},{"title":"B"},{"title":';
    const out = extractJson(truncated);
    expect(out.paths.length).toBeGreaterThanOrEqual(2);
    expect(out.paths[0].title).toBe('A');
  });
});
