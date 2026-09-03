import { describe, expect, it } from 'vitest';
import { parseOriginString, buildOriginString, asalFromOrigin } from '../../src/lib/origin';

describe('parseOriginString', () => {
  it('membaca Sulut yang ada di daftar', () => {
    expect(parseOriginString('Sulut · Manado')).toEqual({
      originRegion: 'SULUT',
      originSulutPlace: 'Manado',
      originSulutOther: '',
      originNonSulut: '',
    });
  });

  it('kota Sulut di luar daftar jadi Lainnya', () => {
    expect(parseOriginString('Sulut · Tondano').originSulutPlace).toBe('LAINNYA_SULUT');
    expect(parseOriginString('Sulut · Tondano').originSulutOther).toBe('Tondano');
  });

  it('membaca Luar Sulut', () => {
    expect(parseOriginString('Luar Sulut · Bekasi').originRegion).toBe('NON_SULUT');
    expect(parseOriginString('Luar Sulut · Bekasi').originNonSulut).toBe('Bekasi');
  });

  it('round-trip buildOriginString', () => {
    const parsed = parseOriginString('Sulut · Bitung');
    expect(buildOriginString(parsed)).toBe('Sulut · Bitung');
  });

  it('asalRegion untuk CSV', () => {
    expect(asalFromOrigin('Sulut · Manado')).toEqual({ asalRegion: 'SULUT', asalPlace: 'Manado' });
    expect(asalFromOrigin('Luar Sulut · Bekasi').asalRegion).toBe('NON_SULUT');
    expect(asalFromOrigin('').asalRegion).toBe('KOSONG');
  });
});
