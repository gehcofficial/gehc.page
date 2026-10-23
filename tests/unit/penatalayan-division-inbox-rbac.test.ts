import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  canAccessDivisionInbox,
  divisionHeadDivisions,
  isPenatalayanCoordinator,
} from '../../server/lib/penatalayan-bod-access.mjs';

describe('division inbox RBAC', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('SUPERADMIN (email terpercaya) lolos inbox tanpa prisma', async () => {
    vi.stubEnv('SUPERADMIN_EMAILS', 'ops@gehc.demo');
    const ok = await canAccessDivisionInbox(
      { id: 'u1', email: 'ops@gehc.demo', roles: [{ role: 'MENTOR' }] },
      null,
      'LITURGIA',
    );
    expect(ok).toBe(true);
  });

  it('koordinator penatalayan (KOMISI) boleh inbox divisi mana pun', async () => {
    expect(isPenatalayanCoordinator({ roles: [{ role: 'KOMISI' }] })).toBe(true);
    const ok = await canAccessDivisionInbox(
      { id: 'u1', roles: [{ role: 'KOMISI' }] },
      null,
      'LITURGIA',
    );
    expect(ok).toBe(true);
  });

  it('mentor tanpa kepala divisi ditolak', async () => {
    const prisma = {
      eventDivisionMember: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const ok = await canAccessDivisionInbox(
      { id: 'u-mentor', roles: [{ role: 'MENTOR' }] },
      prisma,
      'LITURGIA',
    );
    expect(ok).toBe(false);
  });

  it('LEAD divisi boleh inbox divisi sendiri', async () => {
    const prisma = {
      eventDivisionMember: {
        findMany: vi.fn().mockResolvedValue([
          { division: { division: 'LITURGIA' } },
        ]),
      },
    };
    const heads = await divisionHeadDivisions(prisma, 'u-hod');
    expect(heads.has('LITURGIA')).toBe(true);
    const ok = await canAccessDivisionInbox(
      { id: 'u-hod', roles: [{ role: 'MENTOR' }] },
      prisma,
      'LITURGIA',
    );
    expect(ok).toBe(true);
  });
});
