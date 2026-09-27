import { describe, it, expect } from 'vitest';
import { isoWeekRange, monthPeriod, parsePeriod } from '../../server/lib/report-period.mjs';

describe('report-period', () => {
  it('bulan → label & rentang', () => {
    const p = monthPeriod('2026-09');
    expect(p.type).toBe('month');
    expect(p.key).toBe('2026-09');
    expect(p.label).toBe('September 2026');
    expect(p.from.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(p.to.toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('minggu ISO 2026-W01 mulai Senin 29 Des 2025', () => {
    const w = isoWeekRange('2026-W01');
    expect(w.type).toBe('week');
    expect(w.from.toISOString().slice(0, 10)).toBe('2025-12-29');
    expect(w.to.toISOString().slice(0, 10)).toBe('2026-01-05');
    expect(w.label).toContain('Minggu 1');
  });

  it('minggu: from = Senin, durasi 7 hari', () => {
    const w = isoWeekRange('2026-W38');
    expect(w.from.getUTCDay()).toBe(1);
    expect(Math.round((w.to.getTime() - w.from.getTime()) / 86400000)).toBe(7);
    expect(w.key).toBe('2026-W38');
  });

  it('minggu tak valid → null', () => {
    expect(isoWeekRange('2026-W99')).toBeNull();
    expect(isoWeekRange('bogus')).toBeNull();
  });

  it('parsePeriod: minggu/bulan/fallback', () => {
    expect(parsePeriod('2026-W38').type).toBe('week');
    expect(parsePeriod('2026-09').type).toBe('month');
    expect(parsePeriod('').type).toBe('month');
    expect(parsePeriod('ngawur').type).toBe('month');
  });
});
