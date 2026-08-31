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
    };

    const result = await revokeRoleAssignment(prisma, 'ra-1');
    expect(result.ok).toBe(true);
    expect(prisma.orgAssignment.updateMany).toHaveBeenCalledWith({
      where: { roleAssignmentId: 'ra-1', isActive: true },
      data: { isActive: false },
    });
    expect(prisma.groupMember.deleteMany).toHaveBeenCalled();
  });
});
