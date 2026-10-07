import { describe, expect, it } from 'vitest';
import {
  assertMentorAssignScope,
  hasMentorRole,
  isScopedMentor,
  partitionByScope,
} from '../../server/lib/mentor-assign.mjs';

const stubPrisma = (groupIds: string[], members: Array<{ userId: string; groupId: string }>) => ({
  roleAssignment: {
    findMany: async () => groupIds.map((groupId) => ({ groupId })),
  },
  groupMember: {
    findMany: async (args: { where: { groupId?: { in: string[] }; userId?: string } }) => {
      if (args.where.userId) {
        return members.filter((m) => m.userId === args.where.userId).map((m) => ({ groupId: m.groupId }));
      }
      return members
        .filter((m) => !args.where.groupId || args.where.groupId.in.includes(m.groupId))
        .map((m) => ({ userId: m.userId }));
    },
    findFirst: async () => null,
  },
});

describe('mentor-assign: peran', () => {
  it('koordinator bukan scoped mentor', () => {
    expect(isScopedMentor({ id: 'u1', roles: [{ role: 'KOMISI' }] })).toBe(false);
    expect(isScopedMentor({ id: 'u1', roles: [{ role: 'SUPERADMIN' }, { role: 'MENTOR' }] })).toBe(false);
    expect(isScopedMentor({ id: 'u1', roles: [{ role: 'MENTOR' }] })).toBe(true);
    expect(isScopedMentor({ id: 'u1', roles: [{ role: 'CO_MENTOR' }] })).toBe(true);
    expect(isScopedMentor({ id: 'u1', roles: [{ role: 'MENTEE' }] })).toBe(false);
    expect(hasMentorRole({ roles: [{ role: 'MENTOR' }] })).toBe(true);
  });
});

describe('mentor-assign: partitionByScope', () => {
  it('memisahkan tanpa bocor nama', () => {
    const allowed = new Set(['u1', 'u2']);
    expect(partitionByScope(['u1', 'u3', 'u1'], allowed)).toEqual({ ok: ['u1'], denied: 1 });
    expect(partitionByScope([], allowed)).toEqual({ ok: [], denied: 0 });
  });
});

describe('mentor-assign: assertMentorAssignScope', () => {
  const me = { id: 'mentor1', roles: [{ role: 'MENTOR' }] };
  const prisma = stubPrisma(
    ['g1'],
    [
      { userId: 'mentor1', groupId: 'g1' },
      { userId: 'a1', groupId: 'g1' },
      { userId: 'b9', groupId: 'g2' },
    ],
  );

  it('lolos bila semua anggota binaan', async () => {
    await expect(assertMentorAssignScope(prisma, me, ['a1', 'mentor1'])).resolves.toEqual(['a1', 'mentor1']);
  });

  it('403 all-or-nothing bila ada di luar binaan (tanpa nama)', async () => {
    await expect(assertMentorAssignScope(prisma, me, ['a1', 'b9'])).rejects.toMatchObject({ status: 403 });
    try {
      await assertMentorAssignScope(prisma, me, ['b9']);
      expect.unreachable();
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('b9');
      expect(String((e as Error).message)).toContain('1 orang');
    }
  });

  it('mentor tanpa grup tidak bisa assign', async () => {
    const empty = stubPrisma([], []);
    await expect(assertMentorAssignScope(empty, me, ['a1'])).rejects.toMatchObject({ status: 403 });
  });
});
