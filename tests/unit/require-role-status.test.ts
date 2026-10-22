import { describe, expect, it } from 'vitest';
import { requireRole } from '../../server/auth.mjs';

function run(user: Record<string, unknown> | null, ...roles: string[]) {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  let next = false;
  requireRole(...roles)({ authUser: user }, res, () => { next = true; });
  return { next, statusCode: res.statusCode, body: res.body };
}

describe('requireRole account status', () => {
  it('rejects a pending account even when it already has a role', () => {
    const out = run({
      email: 'baru@example.com',
      accountStatus: 'PENDING',
      roles: [{ role: 'MENTEE', tenantId: 'tenant-men' }],
    }, 'MENTEE');
    expect(out.next).toBe(false);
    expect(out.statusCode).toBe(403);
  });

  it('allows an active account through an open requireRole()', () => {
    const out = run({
      email: 'aktif@example.com',
      accountStatus: 'ACTIVE',
      roles: [{ role: 'MENTEE' }],
    });
    expect(out.next).toBe(true);
  });

  it('still denies an active mentee from a staff-only route', () => {
    const out = run({
      email: 'aktif@example.com',
      accountStatus: 'ACTIVE',
      roles: [{ role: 'MENTEE' }],
    }, 'KOMISI');
    expect(out.next).toBe(false);
    expect(out.statusCode).toBe(403);
  });
});
