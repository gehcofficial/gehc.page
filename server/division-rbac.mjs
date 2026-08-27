/**
 * Division-level RBAC helpers for the approval workflow.
 *
 * Hierarchy:
 *   SUPERADMIN → full access
 *   KOMISI     → approve/reject all divisions
 *   COMMITTEE  → approve/reject only divisions where role = BOD (TIMKERJA derivative)
 *   DIVISION LEAD/CO_LEAD → submit for review, edit draft
 *   DIVISION MEMBER       → edit own content
 *   DIVISION VIEWER       → read only
 */

import { prisma as defaultPrisma } from './prisma-singleton.mjs';

function getPrisma() {
  return defaultPrisma;
}

/** Get user's global roles */
export function globalRoles(authUser) {
  return (authUser?.roles || []).map((r) => r.role);
}

/** Check if user has SUPERADMIN or KOMISI global role */
export function isKomisiOrSuperadmin(authUser) {
  const roles = globalRoles(authUser);
  return roles.includes('SUPERADMIN') || roles.includes('KOMISI');
}

/**
 * Check if COMMITTEE user is BOD derivative (TIMKERJA scope).
 * BOD = COMMITTEE + struktur_members.division = TIMKERJA or empty.
 */
export async function isBodTimkerja(authUser) {
  const roles = globalRoles(authUser);
  if (!roles.includes('COMMITTEE')) return false;
  if (!authUser?.email) return false;
  try {
    const prisma = getPrisma();
    if (!prisma) return false;
    const sm = await prisma.strukturMember.findFirst({
      where: { email: authUser.email },
    });
    return !(sm?.division) || sm.division.toUpperCase() === 'TIMKERJA';
  } catch {
    return false;
  }
}

/**
 * Get user's division role (LEAD|CO_LEAD|MEMBER|VIEWER) for a specific division.
 * Returns null if user is not a member of that division.
 */
export async function getDivisionRole(authUser, eventDivisionId) {
  if (!authUser?.id) return null;
  try {
    const prisma = getPrisma();
    if (!prisma) return null;
    const member = await prisma.eventDivisionMember.findUnique({
      where: {
        eventDivisionId_userId: {
          eventDivisionId,
          userId: authUser.id,
        },
      },
    });
    return member?.role || null;
  } catch {
    return null;
  }
}

/**
 * Can user submit this division for review?
 * Requires: division LEAD or CO_LEAD, and status = DRAFT or REJECTED
 */
export async function canSubmitDivision(authUser, divisionRecord) {
  if (!authUser || !divisionRecord) return false;

  // SUPERADMIN/KOMISI can always submit
  if (isKomisiOrSuperadmin(authUser)) return true;

  // BOD Tim Kerja can submit
  if (await isBodTimkerja(authUser)) return true;

  // Division member with LEAD or CO_LEAD role
  const divRole = await getDivisionRole(authUser, divisionRecord.id);
  if (!divRole) return false;

  const allowedStatuses = ['DRAFT', 'REJECTED'];
  return allowedStatuses.includes(divisionRecord.approvalStatus) &&
    (divRole === 'LEAD' || divRole === 'CO_LEAD');
}

/**
 * Can user approve/reject this division?
 * Requires: KOMISI or COMMITTEE (BOD scope), status = IN_REVIEW
 */
export async function canApproveDivision(authUser, divisionRecord) {
  if (!authUser || !divisionRecord) return false;

  // Only IN_REVIEW can be approved
  if (divisionRecord.approvalStatus !== 'IN_REVIEW') return false;

  // SUPERADMIN can always approve
  if (globalRoles(authUser).includes('SUPERADMIN')) return true;

  // KOMISI can approve any division
  if (isKomisiOrSuperadmin(authUser)) return true;

  // COMMITTEE (BOD Tim Kerja) can approve any division
  if (await isBodTimkerja(authUser)) return true;

  return false;
}

/**
 * Can user publish this division?
 * Requires: approvalStatus = APPROVED, and user has publish permission
 */
export async function canPublishDivision(authUser, divisionRecord) {
  if (!authUser || !divisionRecord) return false;

  // Only APPROVED can be published
  if (divisionRecord.approvalStatus !== 'APPROVED') return false;

  return isKomisiOrSuperadmin(authUser) || await isBodTimkerja(authUser);
}

/**
 * Can user edit this division's draft?
 * Requires: division member with LEAD/CO_LEAD/MEMBER role, status = DRAFT or REJECTED
 */
export async function canEditDivision(authUser, divisionRecord) {
  if (!authUser || !divisionRecord) return false;

  // SUPERADMIN/KOMISI can always edit
  if (isKomisiOrSuperadmin(authUser)) return true;

  // Only DRAFT or REJECTED can be edited
  const editableStatuses = ['DRAFT', 'REJECTED'];
  if (!editableStatuses.includes(divisionRecord.approvalStatus)) return false;

  // Division member with LEAD/CO_LEAD/MEMBER role
  const divRole = await getDivisionRole(authUser, divisionRecord.id);
  return divRole && ['LEAD', 'CO_LEAD', 'MEMBER'].includes(divRole);
}

/**
 * Can user view this division?
 * All authenticated users can view all divisions (read-only).
 */
export async function canViewDivision(authUser, divisionRecord) {
  return !!authUser;
}

/**
 * Log an approval action.
 */
export async function logApprovalAction(eventDivisionId, action, authUser, comment = null) {
  try {
    const prisma = getPrisma();
    if (!prisma) return;

    const roles = globalRoles(authUser);
    const actorRole = roles.includes('SUPERADMIN') ? 'SUPERADMIN'
      : roles.includes('KOMISI') ? 'KOMISI'
      : roles.includes('COMMITTEE') ? 'COMMITTEE'
      : 'DIVISION_MEMBER';

    await prisma.eventApprovalLog.create({
      data: {
        id: `eal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventDivisionId,
        action,
        actorId: authUser.id,
        actorRole,
        comment,
      },
    });
  } catch (e) {
    console.error('[DIVISION-RBAC] Failed to log approval action:', e.message);
  }
}

/** Valid status transitions */
export const VALID_TRANSITIONS = {
  DRAFT: ['IN_REVIEW'],       // submit for review
  IN_REVIEW: ['APPROVED', 'REJECTED', 'DRAFT'],  // approve, reject, or send back
  APPROVED: ['PUBLISHED', 'DRAFT'],  // publish or reopen
  REJECTED: ['DRAFT'],         // resubmit
  PUBLISHED: ['DRAFT', 'APPROVED'],  // unpublish
};

/** Check if transition is valid */
export function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}
