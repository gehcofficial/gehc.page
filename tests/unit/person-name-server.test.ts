import { describe, expect, it } from 'vitest';
import {
  composeOfficialName,
  hasStructuredName,
  parseDisplayName,
  partsFromUser,
  resolveDisplayName,
} from '../../server/lib/person-name.mjs';

describe('person-name server — nama tampilan vs akun Google', () => {
  it('keeps the composed official name when structured parts exist', () => {
    const user = {
      name: 'Meyke Poluan',
      churchTitle: 'PDT',
      givenName: 'Meyke',
      middleName: '',
      familyName: 'Poluan',
      academicTitles: ['S.Th.', 'M.Pd.'],
    };
    expect(hasStructuredName(user)).toBe(true);
    expect(resolveDisplayName(user, 'meyke poluan')).toBe(
      composeOfficialName(partsFromUser(user)),
    );
    expect(resolveDisplayName(user, 'meyke poluan')).toContain('Pdt');
  });

  it('falls back to the provider name when there is no structured name', () => {
    const user = { name: 'Budi', givenName: null, familyName: null, academicTitles: null };
    expect(hasStructuredName(user)).toBe(false);
    expect(resolveDisplayName(user, 'Budi Santoso')).toBe('Budi Santoso');
    expect(resolveDisplayName(user, null)).toBe('Budi');
  });

  it('parses a plain name with gelar into structured parts', () => {
    const parsed = parseDisplayName('Pdt Meyke Poluan S.Th., M.Pd.,');
    expect(parsed.churchTitle).toBe('PDT');
    expect(parsed.givenName).toBe('Meyke');
    expect(parsed.familyName).toBe('Poluan');
    expect(parsed.academicTitles).toEqual(['S.Th.', 'M.Pd.']);
  });
});
