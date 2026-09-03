import { describe, it, expect } from 'vitest';
import {
  isPlatformRoot,
  isPlatformAdminActor,
} from '../../server/lib/platform-rbac.mjs';

describe('platform-rbac', () => {
  it('isPlatformRoot true when operator session active', () => {
    const req = { platformOperator: { status: 'ACTIVE' }, platformAdmin: false };
    expect(isPlatformRoot(req)).toBe(true);
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
