import { describe, it, expect } from 'vitest';
import {
  BIPRA_TENANT,
  JEMAAT_ROLES,
  UNIT_LEAD_ROLES,
  isJemaatRole,
  isUnitLeadRole,
  tenantForBipra,
} from '../../server/lib/tenant-map.mjs';

describe('tenant-map', () => {
  it('BIPRA → tenant unit', () => {
    expect(tenantForBipra('PEMUDA')).toBe('tenant-youth');
    expect(tenantForBipra('REMAJA')).toBe('tenant-teen');
    expect(tenantForBipra('ANAK')).toBe('tenant-kids');
    expect(tenantForBipra('BAPAK')).toBe('tenant-men');
    expect(tenantForBipra('IBU')).toBe('tenant-women');
    expect(tenantForBipra('pemuda')).toBe('tenant-youth');
    expect(tenantForBipra(null)).toBeNull();
    expect(tenantForBipra('BOGUS')).toBeNull();
  });

  it('katalog peran jemaat & unit-lead', () => {
    expect(JEMAAT_ROLES).toEqual(['SUPERADMIN', 'BPMJ']);
    expect(UNIT_LEAD_ROLES).toEqual(['KOMISI', 'COMMITTEE', 'ALUMNI']);
    expect(isJemaatRole('BPMJ')).toBe(true);
    expect(isJemaatRole('MENTEE')).toBe(false);
    expect(isUnitLeadRole('KOMISI')).toBe(true);
    expect(isUnitLeadRole('MENTOR')).toBe(false);
  });

  it('tiap BIPRA punya tenant', () => {
    for (const bipra of Object.keys(BIPRA_TENANT)) {
      expect(tenantForBipra(bipra)).toMatch(/^tenant-/);
    }
  });
});
