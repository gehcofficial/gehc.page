import { describe, it, expect } from 'vitest';
import { reviveRow, restoreScope, REGEN_HOME_IDS } from '../../server/lib/regen-undo.mjs';

describe('regen-undo', () => {
  it('scope default 10 rumah', () => {
    expect(REGEN_HOME_IDS).toHaveLength(10);
  });

  it('reviveRow mengubah ISO tanggal menjadi Date', () => {
    const r = reviveRow({ id: 'x', createdAt: '2026-06-01T00:00:00.000Z', name: 'Agape', batchPeriod: '2026-06', joinedDate: '2026-06-01T00:00:00.000Z' });
    expect(r.createdAt instanceof Date).toBe(true);
    expect(r.joinedDate instanceof Date).toBe(true);
    expect(r.batchPeriod).toBe('2026-06');
  });

  it('restoreScope menulis ulang baris dari snapshot', async () => {
    const calls = { deletes: 0, created: {} as Record<string, number>, userUpdates: 0 };
    const del = async () => { calls.deletes += 1; return { count: 0 }; };
    const make = (name: string) => ({
      deleteMany: del,
      createMany: async ({ data }: { data: unknown[] }) => { calls.created[name] = (calls.created[name] || 0) + data.length; return { count: data.length }; },
    });
    const prisma = {
      mentorTransition: make('mentorTransition'),
      roleAssignment: make('roleAssignment'),
      userRole: make('userRole'),
      groupMember: make('groupMember'),
      groupBatch: make('groupBatch'),
      group: { update: async () => ({}) },
      user: { update: async () => { calls.userUpdates += 1; return {}; } },
    };
    await restoreScope(prisma, {
      batches: [{ id: 'b1', groupId: 'grp-1', period: '2026-06', createdAt: '2026-06-01T00:00:00.000Z' }],
      members: [{ id: 'm1', groupId: 'grp-1', userId: 'u1' }],
      roleAssignments: [], userRoles: [], transitions: [],
      groups: [{ id: 'grp-1', memberCount: 1 }],
      users: [{ id: 'u1', isBeyonders: true, isIndividuExplicit: false, onboardingStatus: 'ACTIVE', memberStatus: 'ACTIVE' }],
    });
    expect(calls.deletes).toBe(5);
    expect(calls.created.groupBatch).toBe(1);
    expect(calls.created.groupMember).toBe(1);
    expect(calls.userUpdates).toBe(1);
  });
});
