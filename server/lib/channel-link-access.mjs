import { isKomisiOrSuperadmin, isBodTimkerja, globalRoles } from '../division-rbac.mjs';
import { mentoredGroupIds, strukturDivision } from './checkin-access.mjs';
import { getPrisma } from '../db.mjs';

export const DIVISION_CATALOG = [
  { id: 'LITURGIA', name: 'Liturgia' },
  { id: 'DIDASKALIA', name: 'Didaskalia' },
  { id: 'KOINONIA', name: 'Koinonia' },
  { id: 'DIAKONIA', name: 'Diakonia' },
  { id: 'MARTURIA', name: 'Marturia' },
  { id: 'BENZARPR', name: 'Benzarpreneurship' },
];

const DIVISION_IDS = new Set(DIVISION_CATALOG.map((d) => d.id));

export function isChannelWriterSync(authUser, isBod = false) {
  const r = globalRoles(authUser);
  if (r.includes('SUPERADMIN') || r.includes('KOMISI') || r.includes('BPMJ')) return true;
  return r.includes('COMMITTEE') && isBod;
}

export function canWriteKindSync(authUser, kind, isBod = false) {
  if (!isChannelWriterSync(authUser, isBod)) return false;
  const r = globalRoles(authUser);
  const komisi = r.includes('SUPERADMIN') || r.includes('KOMISI');
  if (kind === 'EVENT' || kind === 'KOLOM') return komisi;
  return true;
}

export async function isChannelWriter(authUser) {
  if (!authUser) return false;
  const r = globalRoles(authUser);
  if (r.includes('SUPERADMIN') || r.includes('KOMISI') || r.includes('BPMJ')) return true;
  return isBodTimkerja(authUser);
}

export async function canWriteKind(authUser, kind) {
  if (!authUser || !kind) return false;
  return canWriteKindSync(authUser, kind, await isBodTimkerja(authUser));
}

export async function menteeGroupIds(authUser) {
  if (!authUser?.id) return [];
  const fromRoles = (authUser.roles || [])
    .filter((r) => r.role === 'MENTEE' && r.groupId)
    .map((r) => r.groupId);
  const prisma = getPrisma();
  if (!prisma) return [...new Set(fromRoles.filter(Boolean))];
  try {
    const [assignments, members] = await Promise.all([
      prisma.roleAssignment.findMany({
        where: {
          userId: authUser.id,
          isActive: true,
          groupId: { not: null },
          familyRole: 'MENTEE',
        },
        select: { groupId: true },
      }),
      prisma.groupMember.findMany({
        where: {
          userId: authUser.id,
          status: 'ACTIVE',
          familyRole: 'MENTEE',
        },
        select: { groupId: true },
      }),
    ]);
    return [...new Set([...fromRoles, ...assignments, ...members].map((r) => r.groupId).filter(Boolean))];
  } catch {
    return [...new Set(fromRoles.filter(Boolean))];
  }
}

export async function scopedGroupIds(authUser) {
  const [mentor, mentee] = await Promise.all([mentoredGroupIds(authUser), menteeGroupIds(authUser)]);
  return [...new Set([...mentor, ...mentee])];
}

export async function scopedDivisionCodes(authUser) {
  const codes = new Set();
  const div = await strukturDivision(authUser);
  if (DIVISION_IDS.has(div)) codes.add(div);
  const prisma = getPrisma();
  if (!prisma || !authUser?.id) return [...codes];
  try {
    const ras = await prisma.roleAssignment.findMany({
      where: { userId: authUser.id, isActive: true, division: { not: null } },
      select: { division: true },
    });
    for (const ra of ras) {
      const d = String(ra.division || '').toUpperCase();
      if (DIVISION_IDS.has(d)) codes.add(d);
    }
  } catch {
    /* ignore */
  }
  return [...codes];
}

export async function isBroadChannelViewer(authUser) {
  const r = globalRoles(authUser);
  if (isKomisiOrSuperadmin(authUser) || r.includes('BPMJ')) return true;
  return isBodTimkerja(authUser);
}
