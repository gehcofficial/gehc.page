import { describe, it, expect } from 'vitest';
import { ageFromBirthDate, suggestBipra } from '../../server/demographics.mjs';
import { formatBirthDateInput, formatLongDateId } from '../../src/lib/demographics';

describe('demographics', () => {
  it('computes age from birthDate', () => {
    const bd = new Date();
    bd.setFullYear(bd.getFullYear() - 20);
    expect(ageFromBirthDate(bd)).toBe(20);
  });

  it('suggests PEMUDA for age 25', () => {
    const bd = new Date();
    bd.setFullYear(bd.getFullYear() - 25);
    const r = suggestBipra({ birthDate: bd, gender: 'LAKI-LAKI' });
    expect(r.suggested).toBe('PEMUDA');
  });

  it('suggests BAPAK with needsConfirm for age 40 male', () => {
    const bd = new Date();
    bd.setFullYear(bd.getFullYear() - 40);
    const r = suggestBipra({ birthDate: bd, gender: 'LAKI-LAKI' });
    expect(r.suggested).toBe('BAPAK');
    expect(r.needsConfirm).toBe(true);
  });

  it('formatLongDateId memakai long-date Indonesia', () => {
    expect(formatLongDateId('2004-03-10')).toBe('Rabu, 10 Maret 2004');
    expect(formatLongDateId('2001-01-10')).toBe('Rabu, 10 Januari 2001');
    expect(formatLongDateId('2004-02-29')).toBe('Minggu, 29 Februari 2004');
  });

  it('formatLongDateId menolak input invalid', () => {
    expect(formatLongDateId(null)).toBe('');
    expect(formatLongDateId('')).toBe('');
    expect(formatLongDateId('10-03-2004')).toBe('');
    expect(formatLongDateId('2004-02-30')).toBe('');
    expect(formatLongDateId('2004-13-01')).toBe('');
  });

  it('formatBirthDateInput roundtrip YYYY-MM-DD', () => {
    expect(formatBirthDateInput(new Date(Date.UTC(2004, 2, 10)))).toBe('2004-03-10');
    expect(formatLongDateId('2004-03-10')).toBe('Rabu, 10 Maret 2004');
  });
});
