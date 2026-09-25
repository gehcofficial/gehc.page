/**
 * Akses unit pelayanan jemaat (BPMJ + 4 unit). Satu sumber kebenaran (server).
 *
 * Aturan: unit jemaat dapat diakses oleh
 *   - SUPERADMIN / BPMJ (oversight), atau
 *   - anggota unit tsb (StrukturMember.division / RoleAssignment.division), atau
 *   - kepala/bendahara unit (position pada unit tsb).
 * Unit & posisi berbasis `division` + `position` (tanpa enum Role baru).
 */
import { getPrisma } from '../db.mjs';
import { globalRoles } from '../division-rbac.mjs';

export const CHURCH_UNIT_CODES = ['PEMBANGUNAN', 'THL', 'TECHTEAM', 'PANJI'];
const CHURCH_UNIT_SET = new Set(CHURCH_UNIT_CODES);

export function isSuperadminUser(authUser) {
  return globalRoles(authUser).includes('SUPERADMIN');
}

export function isBpmjUser(authUser) {
  return globalRoles(authUser).includes('BPMJ');
}

/** Struktur jemaat user (by email) + role assignment aktif dengan division unit jemaat. */
export async function churchUnitsOf(authUser) {
  if (!authUser) return [];
  const prisma = getPrisma();
  if (!prisma) return [];
  const found = new Set();
  try {
    if (authUser.email) {
      const rows = await prisma.strukturMember.findMany({
        where: { email: authUser.email },
        select: { division: true },
      }).catch(() => []);
      for (const r of rows) {
        const d = String(r.division || '').toUpperCase();
        if (CHURCH_UNIT_SET.has(d)) found.add(d);
      }
    }
    if (authUser.id) {
      const ras = await prisma.roleAssignment.findMany({
        where: { userId: authUser.id, isActive: true, division: { not: null } },
        select: { division: true },
      }).catch(() => []);
      for (const r of ras) {
        const d = String(r.division || '').toUpperCase();
        if (CHURCH_UNIT_SET.has(d)) found.add(d);
      }
    }
  } catch {
    return [];
  }
  return [...found];
}

/** Kepala/pejabat unit: BPMJ, SUPERADMIN, atau anggota unit tsb. */
export async function canAccessChurchUnit(authUser, code) {
  const c = String(code || '').toUpperCase();
  if (!CHURCH_UNIT_SET.has(c)) return false;
  if (isSuperadminUser(authUser) || isBpmjUser(authUser)) return true;
  const units = await churchUnitsOf(authUser);
  return units.includes(c);
}

/** Pejabat gereja (BPMJ / Ketua / Bendahara / Sekretaris di struktur jemaat). */
export async function isChurchLeader(authUser) {
  if (!authUser) return false;
  if (isSuperadminUser(authUser) || isBpmjUser(authUser)) return true;
  const prisma = getPrisma();
  if (!prisma || !authUser.email) return false;
  try {
    const rows = await prisma.strukturMember.findMany({ where: { email: authUser.email }, select: { position: true } }).catch(() => []);
    return rows.some((r) => /ketua|bendahara|sekretaris/i.test(String(r.position || '')));
  } catch {
    return false;
  }
}

/** Bendahara (gereja / unit) — pengelola keuangan satu pintu. */
export async function isBendahara(authUser) {
  if (!authUser) return false;
  if (isSuperadminUser(authUser)) return true;
  const prisma = getPrisma();
  if (!prisma || !authUser.email) return false;
  try {
    const rows = await prisma.strukturMember.findMany({ where: { email: authUser.email }, select: { position: true } }).catch(() => []);
    return rows.some((r) => /bendahara/i.test(String(r.position || '')));
  } catch {
    return false;
  }
}

/** Middleware Express: batasi endpoint ke satu unit jemaat. */
export function requireChurchUnit(code) {
  return async (req, res, next) => {
    try {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const ok = await canAccessChurchUnit(req.authUser, code);
      if (!ok) return res.status(403).json({ error: `Akses unit jemaat ${String(code).toUpperCase()} terbatas untuk anggotanya.` });
      next();
    } catch (e) {
      res.status(500).json({ error: `Gagal memeriksa akses unit jemaat: ${String(e.message || e)}` });
    }
  };
}
