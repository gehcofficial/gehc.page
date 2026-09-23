/**
 * Approver regenerate Didaskalia: kepala divisi DIDASKALIA (LEAD/CO_LEAD),
 * SUPERADMIN selalu boleh, KOMISI sebagai cadangan bila belum ada kepala.
 */
import { getPrisma } from '../db.mjs';

const ROLES_OF = (authUser) => (authUser?.roles || []).map((r) => r.role).filter(Boolean);

export async function didaskaliaHeadIds(prisma) {
  try {
    const rows = await prisma.eventDivisionMember.findMany({
      where: { role: { in: ['LEAD', 'CO_LEAD'] }, eventDivision: { division: 'DIDASKALIA' } },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId).filter(Boolean))];
  } catch {
    return [];
  }
}

/** Penerima notifikasi persetujuan regenerate. */
export async function didaskaliaApproverIds(prisma) {
  const ids = new Set(await didaskaliaHeadIds(prisma));
  try {
    const admins = await prisma.userRole.findMany({ where: { role: 'SUPERADMIN' }, select: { userId: true }, take: 100 });
    admins.forEach((a) => a.userId && ids.add(a.userId));
  } catch { /* abaikan */ }
  if (!ids.size) {
    try {
      const kom = await prisma.userRole.findMany({ where: { role: 'KOMISI' }, select: { userId: true }, take: 100 });
      kom.forEach((k) => k.userId && ids.add(k.userId));
    } catch { /* abaikan */ }
  }
  return [...ids];
}

/** Boleh menyetujui/menolak regenerate? */
export async function isDidaskaliaApprover(authUser) {
  const roles = ROLES_OF(authUser);
  if (roles.includes('SUPERADMIN')) return true;
  const prisma = getPrisma();
  if (!prisma || !authUser?.id) return false;
  const heads = await didaskaliaHeadIds(prisma);
  if (heads.includes(authUser.id)) return true;
  // Cadangan: bila belum ada kepala DIDASKALIA sama sekali → KOMISI.
  if (!heads.length && roles.includes('KOMISI')) return true;
  return false;
}
