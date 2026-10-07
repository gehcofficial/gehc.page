/**
 * Penugasan penatalayan oleh mentor/co-mentor (scope kelompok binaan).
 *
 * Aturan: mentor hanya boleh menugaskan anggota ACTIVE dari kelompok yang
 * dibinanya (via mentoredGroupIds — RoleAssignment + GroupMember), dan hanya
 * komponen scope UNIT. Koordinator (SUPERADMIN/KOMISI/COMMITTEE) tak terbatas.
 */
import { isCoordinatorUser } from './penatalayan-status.mjs';

export function hasMentorRole(authUser) {
  const roles = (authUser?.roles || []).map((r) => r.role);
  return roles.includes('MENTOR') || roles.includes('CO_MENTOR');
}

/** True bila aktor wajib dibatasi scope kelompok (mentor non-koordinator). */
export function isScopedMentor(authUser) {
  if (!authUser) return false;
  if (isCoordinatorUser(authUser)) return false;
  return hasMentorRole(authUser);
}

/**
 * Himpunan userId anggota ACTIVE di kelompok binaan aktor.
 * Memakai prisma yang dioper (bukan global) agar deterministik & teruji.
 */
export async function mentorScopedMemberIds(prisma, authUser) {
  const set = new Set();
  if (!prisma || !authUser?.id) return set;
  try {
    const [assignments, memberships] = await Promise.all([
      prisma.roleAssignment.findMany({
        where: { userId: authUser.id, isActive: true, groupId: { not: null }, familyRole: { in: ['MENTOR', 'CO_MENTOR', 'COMENTOR'] } },
        select: { groupId: true },
      }).catch(() => []),
      prisma.groupMember.findMany({
        where: { userId: authUser.id, status: 'ACTIVE', familyRole: { in: ['MENTOR', 'COMENTOR'] } },
        select: { groupId: true },
      }).catch(() => []),
    ]);
    const groupIds = [...new Set([...assignments, ...memberships].map((r) => r.groupId).filter(Boolean))];
    if (!groupIds.length) return set;
    const rows = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds }, status: 'ACTIVE' },
      select: { userId: true },
    }).catch(() => []);
    for (const r of rows) if (r.userId) set.add(String(r.userId));
    set.add(String(authUser.id));
  } catch { /* kosong = tidak boleh assign */ }
  return set;
}

/** Murni: pisahkan yang di dalam scope vs di luar (tanpa bocor nama). */
export function partitionByScope(userIds, allowedSet) {
  const ok = [];
  let denied = 0;
  for (const id of [...new Set((userIds || []).map((s) => String(s)))]) {
    if (allowedSet.has(id)) ok.push(id);
    else denied += 1;
  }
  return { ok, denied };
}

/**
 * Guard all-or-nothing untuk jalur mentor: melempar { status:403 } bila ada
 * SATU pun di luar kelompok binaan (pesan hanya jumlah, tanpa nama).
 */
export async function assertMentorAssignScope(prisma, authUser, userIds) {
  const allowed = await mentorScopedMemberIds(prisma, authUser);
  const { ok, denied } = partitionByScope(userIds, allowed);
  if (denied > 0 || !ok.length) {
    const e = new Error(
      denied > 0
        ? `Di luar kelompok binaan: ${denied} orang ditolak. Mentor hanya menugaskan anggota kelompoknya sendiri.`
        : 'Tidak ada anggota kelompok binaan yang dipilih.',
    );
    e.status = 403;
    throw e;
  }
  return ok;
}
