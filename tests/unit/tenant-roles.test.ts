import { describe, it, expect } from 'vitest';
import {
  JEMAAT_TENANT_ID,
  applyTenantScope,
  rolesInTenant,
} from '../../server/lib/tenant-roles.mjs';

const rows = [
  { role: 'MENTEE', tenantId: 'tenant-youth' },
  { role: 'KOMISI', tenantId: 'tenant-men' },
  { role: 'BPMJ', tenantId: JEMAAT_TENANT_ID },
  { role: 'SUPERADMIN', tenantId: 'tenant-youth' },
  { role: 'COMMITTEE', tenantId: 'tenant-women' },
];

describe('tenant-roles — rolesInTenant', () => {
  it('peran unit aktif + jemaat + SUPERADMIN berlaku; unit lain tidak', () => {
    const men = rolesInTenant(rows, 'tenant-men');
    expect(men.map((r) => r.role).sort()).toEqual(['BPMJ', 'KOMISI', 'SUPERADMIN']);

    const youth = rolesInTenant(rows, 'tenant-youth');
    expect(youth.map((r) => r.role).sort()).toEqual(['BPMJ', 'MENTEE', 'SUPERADMIN']);
  });

  it('hub (tenant-jemaat) hanya peran jemaat + SUPERADMIN', () => {
    const jemaat = rolesInTenant(rows, JEMAAT_TENANT_ID);
    expect(jemaat.map((r) => r.role).sort()).toEqual(['BPMJ', 'SUPERADMIN']);
  });

  it('aman untuk input kosong', () => {
    expect(rolesInTenant(undefined, 'tenant-men')).toEqual([]);
  });
});

describe('tenant-roles — applyTenantScope', () => {
  it('menyimpan rolesAll penuh & roles ter-scope', () => {
    const user: Record<string, any> = { id: 'u1', roles: [...rows] };
    applyTenantScope(user, 'tenant-men');
    expect(user.rolesAll).toHaveLength(rows.length);
    expect(user.roles.map((r) => r.role).sort()).toEqual(['BPMJ', 'KOMISI', 'SUPERADMIN']);
    expect(user.rolesScoped).toBe(true);
  });

  it('fallback longgar bila tak ada peran di tenant (anti-terkunci)', () => {
    const user: Record<string, any> = { id: 'u2', roles: [{ role: 'MENTEE', tenantId: 'tenant-youth' }] };
    applyTenantScope(user, 'tenant-men');
    expect(user.roles).toHaveLength(1);
    expect(user.rolesScoped).toBe(false);
    expect(user.rolesAll).toHaveLength(1);
  });

  it('user tanpa peran tidak error', () => {
    const user: Record<string, any> = { id: 'u3', roles: [] };
    applyTenantScope(user, 'tenant-men');
    expect(user.roles).toEqual([]);
    expect(user.rolesScoped).toBe(false);
  });
});
