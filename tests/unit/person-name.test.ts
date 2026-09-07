import { describe, expect, it } from 'vitest';
import {
  composeOfficialName,
  parseDisplayName,
  searchAcademicTitles,
  titleCaseName,
  validatePersonName,
} from '../../src/lib/person-name';

describe('person name + gelar', () => {
  it('title-cases each word and keeps a trailing space', () => {
    expect(titleCaseName('meyke poluan')).toBe('Meyke Poluan');
    expect(titleCaseName('MEYKE ')).toBe('Meyke ');
  });

  it('composes Pdt + names + academic suffixes like the GMIM example', () => {
    expect(
      composeOfficialName({
        churchTitle: 'PDT',
        givenName: 'meyke',
        middleName: '',
        familyName: 'poluan',
        academicTitles: ['S.Th.', 'M.Pd.'],
      }),
    ).toBe('Pdt Meyke Poluan S.Th., M.Pd.,');
  });

  it('puts Prof./Dr. after church title and before the personal name', () => {
    expect(
      composeOfficialName({
        churchTitle: 'PDT',
        givenName: 'Meyke',
        middleName: '',
        familyName: 'Poluan',
        academicTitles: ['Dr.', 'S.Th.'],
      }),
    ).toBe('Pdt Dr. Meyke Poluan S.Th.,');
  });

  it('parses the display string back into parts', () => {
    const p = parseDisplayName('Pdt Meyke Poluan S.Th., M.Pd.,');
    expect(p.churchTitle).toBe('PDT');
    expect(p.givenName).toBe('Meyke');
    expect(p.familyName).toBe('Poluan');
    expect(p.academicTitles).toEqual(['S.Th.', 'M.Pd.']);
  });

  it('searches Indonesian and English degree labels', () => {
    expect(searchAcademicTitles('teologi').some((t) => t.abbr === 'S.Th.')).toBe(true);
    expect(searchAcademicTitles('phd').some((t) => t.abbr === 'Ph.D.')).toBe(true);
    expect(searchAcademicTitles('education').some((t) => t.abbr === 'M.Ed.')).toBe(true);
    expect(searchAcademicTitles('pendidikan teologi').some((t) => t.abbr === 'S.Pth.')).toBe(true);
  });

  it('requires given and family names', () => {
    expect(validatePersonName({
      churchTitle: '', givenName: '', middleName: '', familyName: 'Poluan', academicTitles: [],
    })).toMatch(/depan/i);
    expect(validatePersonName({
      churchTitle: 'PDT', givenName: 'Meyke', middleName: '', familyName: 'Poluan', academicTitles: [],
    })).toBeNull();
  });
});
