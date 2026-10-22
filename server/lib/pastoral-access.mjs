import { canAccessTenant } from './tenant-scope.mjs';
import { isActiveAccount } from './account-status.mjs';

/** Staf yang boleh melihat PII pastoral seluruh grup di tenant aktif. */
export const PASTORAL_STAFF_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE'];

/** Baca direktori lengkap / absensi / transisi mentor: staf atau mentor rumah itu. */
export const GROUP_DIRECTORY_ROLES = [...PASTORAL_STAFF_ROLES, 'MENTOR', 'CO_MENTOR'];

/** Rapat event & papan penatalayan. */
export const EVENT_PASTORAL_ROLES = [...GROUP_DIRECTORY_ROLES];

export const STRUKTUR_PII_ROLES = [...PASTORAL_STAFF_ROLES];

function roleNames(user) {
  return (user?.roles || []).map((r) => r.role);
}

export function isPastoralStaff(user) {
  if (!isActiveAccount(user)) return false;
  const roles = roleNames(user);
  return PASTORAL_STAFF_ROLES.some((r) => roles.includes(r));
}

export function isGroupPastor(user, groupId) {
  if (!isActiveAccount(user) || !groupId) return false;
  return (user.roles || []).some(
    (r) => r.groupId === groupId && (r.role === 'MENTOR' || r.role === 'CO_MENTOR'),
  );
}

export function canReadGroupPastoral(user, groupId) {
  return isPastoralStaff(user) || isGroupPastor(user, groupId);
}

export function canReadStrukturPii(user) {
  if (!isActiveAccount(user)) return false;
  const roles = roleNames(user);
  return STRUKTUR_PII_ROLES.some((r) => roles.includes(r));
}

export function redactUserContact(user, keepContact) {
  if (!user) return user;
  if (keepContact) return user;
  return { id: user.id, name: user.name, avatar: user.avatar || null };
}

export async function loadScopedGroup(prisma, req, groupId) {
  if (!prisma || !groupId) return null;
  const group = await prisma.group.findUnique({
    where: { id: String(groupId) },
    select: { id: true, tenantId: true, name: true },
  });
  if (!group || !canAccessTenant(req, group.tenantId)) return null;
  return group;
}

export async function loadScopedEvent(prisma, req, eventId, select) {
  if (!prisma || !eventId) return null;
  const event = await prisma.eventProgram.findUnique({
    where: { id: String(eventId) },
    select: select || { id: true, tenantId: true },
  });
  if (!event || !canAccessTenant(req, event.tenantId)) return null;
  return event;
}
