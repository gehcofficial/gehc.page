import { describe, it, expect } from 'vitest';
import { mapFamilyRole } from '../../server/lib/member-role-sync.mjs';

describe('mapFamilyRole', () => {
  it('memetakan role → FamilyRole', () => {
    expect(mapFamilyRole('MENTOR')).toBe('MENTOR');
    expect(mapFamilyRole('CO_MENTOR')).toBe('COMENTOR');
    expect(mapFamilyRole('COMENTOR')).toBe('COMENTOR');
    expect(mapFamilyRole('MENTEE')).toBe('MENTEE');
    expect(mapFamilyRole('')).toBe('MENTEE');
  });
});
