import { describe, it, expect } from 'vitest';
import {
  isPlatformRoot,
  isPlatformAdminActor,
} from '../../server/lib/platform-rbac.mjs';
import {
  applyPlatformAdminPortalRole,
  normalizeGrantUserIdent,
} from '../../server/platform-operators.mjs';

describe('platform-rbac', () => {
  it('isPlatformRoot true when operator session active', () => {
    const req = { platformOperator: { status: 'ACTIVE' }, platformAdmin: false };
    expect(isPlatformRoot(req)).toBe(true);
  });

  it('isPlatformAdminActor true for active operator', () => {
    const req = { platformOperator: { status: 'ACTIVE' }, platformAdmin: false, authUser: null };
    expect(isPlatformAdminActor(req)).toBe(true);
  });

  it('isPlatformAdminActor true for grant without operator', () => {
    const req = { platformOperator: null, platformAdmin: true, authUser: { roles: [] } };
    expect(isPlatformAdminActor(req)).toBe(true);
  });

  it('isPlatformAdminActor false without grant or operator', () => {
    const req = { platformOperator: null, platformAdmin: false, authUser: { roles: [{ role: 'MENTEE' }] } };
    expect(isPlatformAdminActor(req)).toBe(false);
  });
});

describe('normalizeGrantUserIdent', () => {
  it('strips leading @ and whitespace', () => {
    expect(normalizeGrantUserIdent('  @AISaerang ')).toBe('AISaerang');
  });
});

describe('applyPlatformAdminPortalRole', () => {
  it('adds SUPERADMIN when grant is active and user is only MENTEE', () => {
    const user = {
      id: 'usr-1',
      roles: [{ userId: 'usr-1', tenantId: 'tenant-youth', role: 'MENTEE' }],
    };
    applyPlatformAdminPortalRole(user, true);
    expect(user.roles.map((r) => r.role)).toEqual(['MENTEE', 'SUPERADMIN']);
  });

  it('does not duplicate SUPERADMIN', () => {
    const user = {
      id: 'usr-1',
      roles: [{ userId: 'usr-1', tenantId: 'tenant-youth', role: 'SUPERADMIN' }],
    };
    applyPlatformAdminPortalRole(user, true);
    expect(user.roles.filter((r) => r.role === 'SUPERADMIN')).toHaveLength(1);
  });

  it('leaves roles unchanged without a grant', () => {
    const user = {
      id: 'usr-1',
      roles: [{ userId: 'usr-1', tenantId: 'tenant-youth', role: 'MENTEE' }],
    };
    applyPlatformAdminPortalRole(user, false);
    expect(user.roles.map((r) => r.role)).toEqual(['MENTEE']);
  });
});
