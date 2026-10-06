import { describe, expect, it, vi, beforeEach } from 'vitest';

const stub = vi.hoisted(() => ({
  assignments: [] as { groupId: string }[],
  members: [] as { groupId: string }[],
  target: null as { userId: string; groupId: string } | null,
}));

vi.mock('../../server/db.mjs', () => ({
  getPrisma: () => ({
    roleAssignment: { findMany: async () => stub.assignments },
    groupMember: {
      findMany: async (args: { where?: { userId?: string; groupId?: { in: string[] } } }) => {
        const w = args?.where || {};
        if (w.groupId && typeof w.groupId === 'object' && w.userId) {
          if (stub.target && w.userId === stub.target.userId && (w.groupId as { in: string[] }).in.includes(stub.target.groupId)) {
            return [{ id: 'gm-1' }];
          }
          return [];
        }
        return stub.members;
      },
      findFirst: async (args: { where?: { userId?: string; groupId?: { in: string[] } } }) => {
        const w = args?.where || {};
        if (w.groupId && typeof w.groupId === 'object' && w.userId) {
          if (stub.target && w.userId === stub.target.userId && (w.groupId as { in: string[] }).in.includes(stub.target.groupId)) {
            return { id: 'gm-1' };
          }
          return null;
        }
        return stub.members[0] || null;
      },
    },
  }),
  getDbLabel: () => 'test',
}));

import { mentoredGroupIds, isGroupMentorOf } from '../../server/lib/checkin-access.mjs';

beforeEach(() => {
  stub.assignments = [];
  stub.members = [];
  stub.target = null;
});

describe('mentor-attendance: grup binaan', () => {
  it('menggabung assignment + keanggotaan tanpa duplikat', async () => {
    stub.assignments = [{ groupId: 'g1' }, { groupId: 'g2' }];
    stub.members = [{ groupId: 'g2' }, { groupId: 'g3' }];
    expect(await mentoredGroupIds({ id: 'u-mentor' })).toEqual(['g1', 'g2', 'g3']);
  });

  it('tanpa auth → kosong', async () => {
    expect(await mentoredGroupIds(null)).toEqual([]);
    expect(await mentoredGroupIds({})).toEqual([]);
  });
});

describe('mentor-attendance: izin tandai', () => {
  it('diri sendiri selalu boleh', async () => {
    expect(await isGroupMentorOf({ id: 'u1' }, 'u1')).toBe(true);
  });

  it('anggota grup binaan boleh', async () => {
    stub.assignments = [{ groupId: 'g1' }];
    stub.target = { userId: 'u-anggota', groupId: 'g1' };
    expect(await isGroupMentorOf({ id: 'u-mentor' }, 'u-anggota')).toBe(true);
  });

  it('di luar grup binaan ditolak', async () => {
    stub.assignments = [{ groupId: 'g1' }];
    stub.target = { userId: 'u-luar', groupId: 'g9' };
    expect(await isGroupMentorOf({ id: 'u-mentor' }, 'u-luar')).toBe(false);
  });

  it('bukan mentor (tanpa grup) ditolak', async () => {
    stub.target = { userId: 'u-x', groupId: 'g1' };
    expect(await isGroupMentorOf({ id: 'u-biasa' }, 'u-x')).toBe(false);
  });

  it('tanpa auth atau target ditolak', async () => {
    expect(await isGroupMentorOf(null, 'u-x')).toBe(false);
    expect(await isGroupMentorOf({ id: 'u1' }, '')).toBe(false);
  });
});
