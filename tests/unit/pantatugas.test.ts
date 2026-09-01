import { describe, expect, it } from 'vitest';
import {
  PANTA_DIVISIONS,
  SUB_DIVISIONS,
  SUBDIVISION_MIGRATION,
  subDivisions,
} from '../../src/lib/pantatugas';

describe('pantatugas v2 subdivisions', () => {
  it('has 20 sub-divisi total', () => {
    const total = Object.values(SUB_DIVISIONS).reduce((n, arr) => n + arr.length, 0);
    expect(total).toBe(20);
  });

  it('each panta pillar has HoD-eligible subs', () => {
    for (const div of PANTA_DIVISIONS) {
      expect(subDivisions(div).length).toBeGreaterThan(0);
    }
  });

  it('BZP has 3 subs without HoD slot in code', () => {
    expect(subDivisions('BENZARPR')).toHaveLength(3);
    expect(PANTA_DIVISIONS).not.toContain('BENZARPR');
  });

  it('migration map covers legacy BENZARPR names', () => {
    expect(SUBDIVISION_MIGRATION.BENZARPR.Fundraising).toBe('Penggalangan Dana');
  });
});
