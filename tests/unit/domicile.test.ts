import { describe, expect, it } from 'vitest';
import {
  domicileLabel,
  isValidDomicileKind,
  DOMICILE_OPTIONS,
  domicileDetailConfig,
} from '../../src/lib/domicile';
import { buildOriginString, titleCaseWords, validateOriginForm } from '../../src/lib/origin';

describe('domicile', () => {
  it('validates expanded domicile kinds', () => {
    expect(isValidDomicileKind('KOSTAN')).toBe(true);
    expect(isValidDomicileKind('MONROE')).toBe(true);
    expect(isValidDomicileKind('KGR')).toBe(true);
    expect(isValidDomicileKind('INVALID')).toBe(false);
  });

  it('formats label with detail', () => {
    expect(domicileLabel('ELVIS', 'Tower A')).toContain('Elvis Tower');
    expect(domicileLabel('ELVIS', 'Tower A')).toContain('Tower A');
  });

  it('has seven preset options', () => {
    expect(DOMICILE_OPTIONS).toHaveLength(7);
  });

  it('requires detail for kostan', () => {
    const cfg = domicileDetailConfig('KOSTAN');
    expect(cfg?.required).toBe(true);
  });

  it('optional block for sbh', () => {
    const cfg = domicileDetailConfig('SBH');
    expect(cfg?.required).toBe(false);
    expect(cfg?.show).toBe(true);
  });
});

describe('origin', () => {
  it('builds sulut origin string', () => {
    expect(
      buildOriginString({
        originRegion: 'SULUT',
        originSulutPlace: 'Manado',
        originSulutOther: '',
        originNonSulut: '',
      }),
    ).toBe('Sulut · Manado');
  });

  it('builds non-sulut origin with title case', () => {
    expect(
      buildOriginString({
        originRegion: 'NON_SULUT',
        originSulutPlace: '',
        originSulutOther: '',
        originNonSulut: 'jakarta selatan',
      }),
    ).toBe('Luar Sulut · Jakarta Selatan');
  });

  it('validates missing region', () => {
    expect(
      validateOriginForm({
        originRegion: '',
        originSulutPlace: '',
        originSulutOther: '',
        originNonSulut: '',
      }),
    ).toBeTruthy();
  });

  it('title-cases words', () => {
    expect(titleCaseWords('blok b lantai 3')).toBe('Blok B Lantai 3');
  });
});
