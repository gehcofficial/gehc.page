import { describe, expect, it } from 'vitest';
import { flowBaselineKey, isFlowStale } from '../../src/lib/flow-stale';

describe('flow-stale', () => {
  it('kunci baseline unik per pekan', () => {
    expect(flowBaselineKey('2026-10', 2)).toBe('didaskalia-flow-pattern:2026-10:2');
    expect(flowBaselineKey('2026-10', 2)).not.toBe(flowBaselineKey('2026-10', 3));
  });

  it('basi bila pola berubah setelah alur terisi', () => {
    expect(isFlowStale('DEBAT', 'MONOLOG', 4)).toBe(true);
    expect(isFlowStale('monolog', 'MONOLOG', 4)).toBe(false);
  });

  it('tidak basi bila belum ada baseline atau alur kosong', () => {
    expect(isFlowStale(null, 'MONOLOG', 4)).toBe(false);
    expect(isFlowStale('DEBAT', 'MONOLOG', 0)).toBe(false);
  });
});
