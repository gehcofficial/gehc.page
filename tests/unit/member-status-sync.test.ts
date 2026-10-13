import { describe, expect, it } from 'vitest';
import { markNonaktifBulk, restoreActiveBulk } from '../../server/lib/member-role-sync.mjs';

// Prisma tiruan: cukup untuk jalur bulk NONAKTIF/ACTIVE tanpa DB.
function mockPrisma(rows: Array<Record<string, unknown>>, currentPeriod = '2026-09') {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  return {
    updates,
    groupMember: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter(
          (r) =>
            (where.status === undefined || r.status === where.status) &&
            (where.userId === undefined || r.userId === where.userId),
        ),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ where, data });
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      count: async () => 0,
    },
    group: { update: async () => ({}) },
    groupBatch: { findFirst: async () => ({ period: currentPeriod }) },
  };
}

describe('markNonaktifBulk — roster ikut NONAKTIF (anti-hantu pohon)', () => {
  it('mengubah ACTIVE→PAST, membiarkan ALUMNI/PAST/MOVED', async () => {
    const rows = [
      { id: 'a', userId: 'u1', groupId: 'g', status: 'ACTIVE' },
      { id: 'b', userId: 'u1', groupId: 'g', status: 'ALUMNI' },
      { id: 'c', userId: 'u1', groupId: 'g', status: 'MOVED' },
    ];
    const prisma = mockPrisma(rows);
    const res = await markNonaktifBulk(prisma as never, { userIds: ['u1'] });
    expect(res).toEqual({ updated: 1, users: 1 });
    expect(prisma.updates).toEqual([{ where: { id: 'a' }, data: { status: 'PAST', alumniNote: null } }]);
  });
});

describe('restoreActiveBulk — aktivasi ulang memulihkan pohon', () => {
  it('memulihkan ALUMNI@periode-berjalan, melewati generasi lama + PAST', async () => {
    const rows = [
      { id: 'a', userId: 'u1', groupId: 'g', status: 'ALUMNI', batchPeriod: '2026-09' },
      { id: 'b', userId: 'u1', groupId: 'g', status: 'ALUMNI', batchPeriod: '2026-06' },
      { id: 'c', userId: 'u1', groupId: 'g', status: 'PAST', batchPeriod: '2026-09' },
    ];
    const prisma = mockPrisma(rows);
    const res = await restoreActiveBulk(prisma as never, { userIds: ['u1'] });
    expect(res).toEqual({ updated: 1, users: 1 });
    expect(prisma.updates).toEqual([
      { where: { id: 'a' }, data: { status: 'ACTIVE', movedToGroupId: null, alumniDate: null, alumniNote: null } },
    ]);
  });
});
