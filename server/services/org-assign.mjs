import crypto from 'node:crypto';
import { assignRoleToUser, revokeRoleAssignment, resolveAssignedByUserId } from '../role-assign.mjs';

export function genOrgId() {
  return crypto.randomBytes(32).toString('hex');
}

/** Build tree from flat org nodes */
export function buildOrgTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = [];
  for (const n of byId.values()) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId).children.push(n);
    else roots.push(n);
  }
  const sortRec = (list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    list.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

function meta(node) {
  const m = node?.metadata;
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
}

/** Map org slot metadata → RoleAssignment fields (for dual-write + tests) */
export function roleParamsFromOrgNode(node, positionOverride = null) {
  const m = meta(node);
  const portalRole = m.portalRole || (Array.isArray(m.portalRoles) ? m.portalRoles[0] : null);
  return {
    role: portalRole,
    position: positionOverride || m.position || node?.label || null,
    division: m.division || null,
    subdivision: m.subdivision || null,
    requiresGroup: Boolean(m.requiresGroup) || ['MENTOR', 'CO_MENTOR', 'MENTEE'].includes(portalRole || ''),
  };
}

/**
 * Assign user to org slot + dual-write RoleAssignment when portalRole is set.
 */
export async function assignOrgSlot(prisma, {
  userId,
  orgNodeId,
  positionOverride = null,
  groupId = null,
  familyRole = null,
  assignedBy,
  note = null,
  updateOnboarding = true,
}) {
  const node = await prisma.orgNode.findUnique({ where: { id: orgNodeId } });
  if (!node || !node.isActive) throw new Error('Slot organisasi tidak ditemukan.');

  assignedBy = await resolveAssignedByUserId(prisma, assignedBy);

  const m = meta(node);
  const maxAssignees = Number(m.maxAssignees ?? 99);
  const activeCount = await prisma.orgAssignment.count({
    where: { orgNodeId, isActive: true },
  });
  if (activeCount >= maxAssignees) {
    throw new Error(`Slot "${node.label}" sudah penuh (maks ${maxAssignees}).`);
  }

  const { role: portalRole, position, division, subdivision, requiresGroup } = roleParamsFromOrgNode(node, positionOverride);
  let roleAssignmentId = null;

  if (portalRole) {
    const needsGroup = requiresGroup;
    const { assignment } = await assignRoleToUser(prisma, {
      userId,
      role: portalRole,
      groupId: needsGroup ? groupId : null,
      position: division === 'TIMKERJA' || !division ? position : null,
      division: division || null,
      subdivision: subdivision || null,
      familyRole: familyRole || null,
      assignedBy,
      note,
      updateOnboarding,
    });
    roleAssignmentId = assignment.id;

    if (m.linkedKolomId && (m.leaderKind === 'DIAKEN' || m.leaderKind === 'PENATUA')) {
      await prisma.user.update({
        where: { id: userId },
        data: { kolomId: m.linkedKolomId },
      });
    }
  } else {
    try {
      await prisma.notification.create({
        data: {
          id: genOrgId(),
          type: 'ROLE_ASSIGNED',
          memberId: userId,
          title: 'Peran baru ditugaskan',
          message: `Kamu ditugaskan ke ${position || node.label}. Buka portal untuk melihat konteks peran aktif.`,
          payload: { orgNodeId, position, assignedBy, href: '#/account/roles' },
          status: 'OPEN',
        },
      });
    } catch (e) {
      console.warn('[org-assign] notifikasi ROLE_ASSIGNED gagal:', e?.message || e);
    }
  }

  const orgAssignment = await prisma.orgAssignment.create({
    data: {
      id: genOrgId(),
      userId,
      orgNodeId,
      position,
      roleAssignmentId,
      assignedBy,
      isActive: true,
    },
    include: { orgNode: true },
  });

  return { orgAssignment, roleAssignmentId };
}

export async function deactivateOrgAssignment(prisma, assignmentId) {
  const row = await prisma.orgAssignment.findUnique({ where: { id: assignmentId } });
  if (!row) throw new Error('Assignment tidak ditemukan.');
  await prisma.orgAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false },
  });
  if (row.roleAssignmentId) {
    await revokeRoleAssignment(prisma, row.roleAssignmentId);
  }
  return { ok: true };
}

/** Provision KOLOM leader slots when a new Kolom row is created */
export async function provisionKolomOrgNodes(prisma, kolom) {
  let root = await prisma.orgNode.findFirst({ where: { domain: 'KOLOM', slug: 'KOLOM_ROOT' } });
  if (!root) {
    root = await prisma.orgNode.create({
      data: {
        id: genOrgId(),
        domain: 'KOLOM',
        slug: 'KOLOM_ROOT',
        label: 'Kolom Teritorial',
        nodeKind: 'BRANCH',
        sortOrder: 0,
        metadata: {},
      },
    });
  }

  const slugBase = `KOLOM_${kolom.number}`;
  let branch = await prisma.orgNode.findFirst({ where: { domain: 'KOLOM', slug: slugBase } });
  if (!branch) {
    branch = await prisma.orgNode.create({
      data: {
        id: genOrgId(),
        domain: 'KOLOM',
        parentId: root.id,
        slug: slugBase,
        label: `Kolom ${kolom.number} — ${kolom.name}`,
        nodeKind: 'BRANCH',
        sortOrder: kolom.number,
        metadata: { linkedKolomId: kolom.id },
      },
    });
    for (const [sortOrder, spec] of [
      [1, { slug: 'DIAKEN', label: 'Diaken Kolom', leaderKind: 'DIAKEN' }],
      [2, { slug: 'PENATUA', label: 'Penatua Kolom', leaderKind: 'PENATUA' }],
      [3, { slug: 'ANGGOTA', label: 'Anggota Jemaat', leaderKind: null }],
    ]) {
      await prisma.orgNode.create({
        data: {
          id: genOrgId(),
          domain: 'KOLOM',
          parentId: branch.id,
          slug: `${slugBase}_${spec.slug}`,
          label: spec.label,
          nodeKind: 'POSITION_SLOT',
          sortOrder,
          metadata: {
            linkedKolomId: kolom.id,
            position: spec.label.replace(' Kolom', ''),
            maxAssignees: spec.leaderKind ? 1 : 999,
            leaderKind: spec.leaderKind,
          },
        },
      });
    }
  }
  return branch;
}
