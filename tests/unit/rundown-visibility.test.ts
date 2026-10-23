import { describe, expect, it } from 'vitest';
import {
  canEditLiturgiaPatternVariant,
  canViewFullWorshipRundown,
  filterRundownPhases,
} from '../../src/lib/rundown-visibility';

describe('rundown-visibility', () => {
  it('full rundown on youth for BOD/Komisi/BPMJ/SUPERADMIN', () => {
    expect(
      canViewFullWorshipRundown({
        portalId: 'youth',
        isBodTimkerja: true,
      }),
    ).toBe(true);
    expect(
      canViewFullWorshipRundown({
        portalId: 'youth',
        isKomisi: true,
      }),
    ).toBe(true);
    expect(
      canViewFullWorshipRundown({
        portalId: 'youth',
        isBpmj: true,
      }),
    ).toBe(true);
    expect(
      canViewFullWorshipRundown({
        portalId: 'youth',
        isSuperAdmin: true,
      }),
    ).toBe(true);
    expect(
      canViewFullWorshipRundown({
        portalId: 'youth',
      }),
    ).toBe(false);
  });

  it('filters phases by division when not full access', () => {
    const phases = [
      { title: 'P&W', division: 'LITURGIA' },
      { title: 'Bedah Lagu', division: 'DIDASKALIA' },
      { title: 'Tanpa divisi' },
    ];
    const out = filterRundownPhases(phases, {
      canViewFull: false,
      viewerDivision: 'DIDASKALIA',
    });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Bedah Lagu');
  });

  it('Liturgia owns pattern variant edits for division members', () => {
    expect(
      canEditLiturgiaPatternVariant({
        canViewFull: false,
        viewerDivision: 'LITURGIA',
      }),
    ).toBe(true);
    expect(
      canEditLiturgiaPatternVariant({
        canViewFull: false,
        viewerDivision: 'DIDASKALIA',
      }),
    ).toBe(false);
    expect(
      canEditLiturgiaPatternVariant({
        canViewFull: true,
        viewerDivision: 'DIDASKALIA',
        isKomisi: true,
      }),
    ).toBe(true);
  });
});
