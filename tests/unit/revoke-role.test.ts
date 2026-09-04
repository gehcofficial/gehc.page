import { describe, expect, it, vi } from 'vitest';
import { revokeRoleAssignment } from '../../server/role-assign.mjs';

describe('revokeRoleAssignment', () => {
  it('deactivates role, userRole, groupMember, and orgAssignment', async () => {
    const assignment = {
      id: 'ra-1',
      userId: 'u-1',
      role: 'MENTEE',
      groupId: 'g-1',
    };

    const prisma = {
      roleAssignment: {
        findUnique: vi.fn().mockResolvedValue(assignment),
        update: vi.fn().mockResolvedValue(assignment),
      },
      userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      groupMember: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      orgAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { findUnique: vi.fn() },
      groupBatch: { findFirst: vi.fn(), update: vi.fn() },
    };

    const result = await revokeRoleAssignment(prisma, 'ra-1');
    expect(result.ok).toBe(true);
    expect(prisma.orgAssignment.updateMany).toHaveBeenCalledWith({
      where: { roleAssignmentId: 'ra-1', isActive: true },
      data: { isActive: false },
    });
    expect(prisma.groupMember.deleteMany).toHaveBeenCalled();
  });

  it('clears current-batch landing names when MENTOR is revoked', async () => {
    const assignment = {
      id: 'ra-2',
      userId: 'u-2',
      role: 'MENTOR',
      groupId: 'g-1',
    };
    const prisma = {
      roleAssignment: {
        findUnique: vi.fn().mockResolvedValue(assignment),
        update: vi.fn().mockResolvedValue(assignment),
      },
      userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      groupMember: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      orgAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u-2', name: 'Alvandi Isaerang' }) },
      groupBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'b-1',
          mentorUserId: 'u-2',
          mentorName: 'Alvandi I.',
          comentorUserId: null,
          comentorName: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await revokeRoleAssignment(prisma, 'ra-2');
    expect(prisma.groupBatch.update).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { mentorName: 'TBD', mentorUserId: null },
    });
  });
});
