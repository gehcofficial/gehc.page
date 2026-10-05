import { describe, expect, it } from 'vitest';
import { syncRosterRole } from '../../server/lib/member-role-sync.mjs';

// Prisma tiruan: cukup untuk jalur syncRosterRole tanpa DB.
function mockPrisma() {
  const calls: { raUpdate: string[]; urDelete: unknown[]; raCreate: unknown; urCreate: unknown } = {
    raUpdate: [],
    urDelete: [],
    raCreate: null,
    urCreate: null,
  };
  const oldRa = { id: 'ra-old', userId: 'u1', role: 'MENTEE', groupId: 'g-kairos', isActive: true };
  return {
    calls,
    roleAssignment: {
      findMany: async () => [oldRa],
      findFirst: async () => null,
      update: async ({ where }: { where: { id: string } }) => {
        calls.raUpdate.push(where.id);
        return { ...oldRa, isActive: false };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.raCreate = data;
        return { id: 'ra-new', ...data };
      },
    },
    userRole: {
      findFirst: async () => null,
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        calls.urDelete.push(where);
        return { count: 1 };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.urCreate = data;
        return { id: 'ur-new', ...data };
      },
    },
    groupMember: { updateMany: async () => ({ count: 1 }) },
  };
}

describe('syncRosterRole — tanpa peran ganda', () => {
  it('menonaktifkan assignment lama DAN menghapus UserRole-nya', async () => {
    const prisma = mockPrisma();
    const assignment = await syncRosterRole(prisma as never, {
      userId: 'u1',
      groupId: 'g-dunamis',
      familyRole: 'COMENTOR',
      assignedBy: 'admin',
    });

    expect(assignment).toBeTruthy();
    // Assignment lama dinonaktifkan…
    expect(prisma.calls.raUpdate).toContain('ra-old');
    // …dan baris UserRole MENTEE@Kairos ikut dihapus (inti bug laporan).
    expect(prisma.calls.urDelete).toContainEqual({
      userId: 'u1',
      role: 'MENTEE',
      groupId: 'g-kairos',
    });
    // Assignment baru CO_MENTOR@Dunamis dibuat.
    expect(prisma.calls.raCreate).toMatchObject({ userId: 'u1', role: 'CO_MENTOR', groupId: 'g-dunamis' });
  });
});
