/**
 * Akses panel divisi — satu sumber kebenaran (server).
 *
 * Aturan (keputusan pemilik): panel `div-<DIV>` hanya untuk
 *   - anggota divisi itu (struktur / RoleAssignment / anggota Tim Kerja event)
 *   - kepala divisi itu (LEAD/CO_LEAD pada divisi tersebut) — per-divisi
 *   - SUPERADMIN
 * KOMISI/Tim Kerja yang tidak terdaftar di divisi mana pun TIDAK mendapat panel divisi.
 */
import { getPrisma } from '../db.mjs';
import { scopedDivisionCodes, DIVISION_CATALOG } from './channel-link-access.mjs';

export const DIVISION_IDS = new Set(DIVISION_CATALOG.map((d) => d.id));

export function globalRoles(authUser) {
  return (authUser?.roles || []).map((r) => r.role).filter(Boolean);
}

export function isSuperadminUser(authUser) {
  return globalRoles(authUser).includes('SUPERADMIN');
}

/** Divisi tempat user menjadi kepala (LEAD/CO_LEAD) — per-divisi, bukan lintas divisi. */
export async function headDivisions(authUser) {
  if (!authUser?.id) return [];
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const rows = await prisma.eventDivisionMember.findMany({
      where: { userId: authUser.id, role: { in: ['LEAD', 'CO_LEAD'] } },
      select: { eventDivision: { select: { division: true } } },
    });
    const set = new Set();
    for (const r of rows) {
      const d = String(r.eventDivision?.division || '').toUpperCase();
      if (DIVISION_IDS.has(d)) set.add(d);
    }
    return [...set];
  } catch {
    return [];
  }
}

/** Semua divisi yang boleh diakses user (anggota ∪ kepala). */
export async function divisionCodesFor(authUser) {
  if (!authUser) return [];
  const [member, heads] = await Promise.all([
    scopedDivisionCodes(authUser).catch(() => []),
    headDivisions(authUser),
  ]);
  return [...new Set([...member, ...heads])].filter((d) => DIVISION_IDS.has(d));
}

export async function canAccessDivision(authUser, division) {
  const div = String(division || '').toUpperCase();
  if (!DIVISION_IDS.has(div)) return false;
  if (isSuperadminUser(authUser)) return true;
  const codes = await divisionCodesFor(authUser);
  return codes.includes(div);
}

/**
 * Middleware Express: batasi endpoint ke satu divisi.
 * `resolver` boleh string ('BENZARPR') atau fungsi (req) => divisi.
 */
export function requireDivision(resolver) {
  return async (req, res, next) => {
    try {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const div = String(typeof resolver === 'function' ? resolver(req) : resolver).toUpperCase();
      const ok = await canAccessDivision(req.authUser, div);
      if (!ok) return res.status(403).json({ error: `Akses panel divisi ${div} terbatas untuk anggota divisi tersebut.` });
      next();
    } catch (e) {
      res.status(500).json({ error: `Gagal memeriksa akses divisi: ${String(e.message || e)}` });
    }
  };
}
