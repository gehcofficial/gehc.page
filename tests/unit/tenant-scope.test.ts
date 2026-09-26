import { describe, it, expect } from 'vitest';
import {
  activeTenantId,
  canAccessTenant,
  isJemaatScope,
  tenantForWrite,
  tenantWhere,
  withTenant,
} from '../../server/lib/tenant-scope.mjs';

const req = (host: string) => ({ headers: { host } });
const MEN = req('men.gehc.page');
const HUB = req('gehc.page');
const STG_MEN = req('staging-men.gehc.page');
const UNKNOWN = req('localhost');

describe('tenant-scope', () => {
  it('tenant aktif dari host', () => {
    expect(activeTenantId(MEN)).toBe('tenant-men');
    expect(activeTenantId(HUB)).toBe('tenant-jemaat');
    expect(activeTenantId(STG_MEN)).toBe('tenant-men');
    expect(activeTenantId(UNKNOWN)).toBe('tenant-youth');
  });

  it('tenantWhere: unit → in(unit, jemaat); jemaat → null', () => {
    expect(tenantWhere(MEN)).toEqual({ tenantId: { in: ['tenant-men', 'tenant-jemaat'] } });
    expect(tenantWhere(HUB)).toBeNull();
  });

  it('isJemaatScope hanya untuk hub', () => {
    expect(isJemaatScope(HUB)).toBe(true);
    expect(isJemaatScope(MEN)).toBe(false);
  });

  it('tenantForWrite: unit aktif; hub → tenant-jemaat', () => {
    expect(tenantForWrite(MEN)).toBe('tenant-men');
    expect(tenantForWrite(HUB)).toBe('tenant-jemaat');
  });

  it('withTenant menggabungkan filter', () => {
    expect(withTenant(MEN, { isPublished: true })).toEqual({
      isPublished: true,
      tenantId: { in: ['tenant-men', 'tenant-jemaat'] },
    });
    expect(withTenant(HUB, { isPublished: true })).toEqual({ isPublished: true });
  });

  it('canAccessTenant: unit → miliknya/jemaat; jemaat → semua', () => {
    expect(canAccessTenant(MEN, 'tenant-men')).toBe(true);
    expect(canAccessTenant(MEN, 'tenant-jemaat')).toBe(true);
    expect(canAccessTenant(MEN, 'tenant-youth')).toBe(false);
    expect(canAccessTenant(HUB, 'tenant-youth')).toBe(true);
  });
});
