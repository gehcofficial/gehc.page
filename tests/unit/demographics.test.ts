import { describe, it, expect } from 'vitest';
import { ageFromBirthDate, suggestBipra } from '../../server/demographics.mjs';

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
});
