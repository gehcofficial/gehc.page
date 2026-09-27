import { describe, it, expect } from 'vitest';
import { lastMonths, maxOf, mergeTrend } from '../../server/lib/report-trends.mjs';

describe('report-trends', () => {
  it('lastMonths: n bulan terakhir ascending', () => {
    const ref = new Date('2026-09-15T00:00:00Z');
    expect(lastMonths(6, ref)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(lastMonths(3, new Date('2026-01-31T00:00:00Z'))).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('mergeTrend: gabung kas masuk/keluar, bzp, booking, insiden', () => {
    const months = ['2026-08', '2026-09'];
    const trend = mergeTrend(months, {
      cash: [
        { ym: '2026-08', direction: 'IN', total: 1000 },
        { ym: '2026-08', direction: 'OUT', total: 400 },
        { ym: '2026-09', direction: 'IN', total: '500' },
      ],
      bzp: [{ ym: '2026-09', total: 300 }],
      bookings: [{ ym: '2026-08', count: 2n }],
      incidents: [{ ym: '2026-09', count: 1n }],
    });
    expect(trend[0]).toEqual({ ym: '2026-08', cashIn: 1000, cashOut: 400, net: 600, bzp: 0, bookings: 2, incidents: 0 });
    expect(trend[1]).toEqual({ ym: '2026-09', cashIn: 500, cashOut: 0, net: 500, bzp: 300, bookings: 0, incidents: 1 });
  });

  it('mergeTrend: bulan tanpa data = nol', () => {
    const trend = mergeTrend(['2026-09'], {});
    expect(trend[0].cashIn).toBe(0);
    expect(trend[0].bzp).toBe(0);
  });

  it('maxOf', () => {
    const trend = mergeTrend(['2026-08', '2026-09'], { cash: [{ ym: '2026-08', direction: 'IN', total: 700 }] });
    expect(maxOf(trend, 'cashIn')).toBe(700);
    expect(maxOf(trend, 'cashOut')).toBe(0);
    expect(maxOf([], 'cashIn')).toBe(0);
  });
});
