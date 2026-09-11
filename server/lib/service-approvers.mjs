/**
 * Siapa boleh apa di perencanaan ibadah (keputusan: tema = hasil rembuk
 * BOD Tim Kerja + Didaskalia + kepala divisi; approval perubahan di mereka).
 */
import { getPrisma } from '../db.mjs';
import { isBodTimkerja } from '../division-rbac.mjs';
import { loadStruktur } from './drive-ownership.mjs';

export function hasOwnedRole(authUser, ...roles) {
  const owned = (authUser?.roles || []).map((r) => r.role);
  return roles.some((r) => owned.includes(r));
}

/** Anggota divisi Didaskalia (struktur) — seluruh Didaskalia. */
export async function isDidaskaliaMember(authUser) {
  try {
    const sm = await loadStruktur(authUser);
    return String(sm?.division || '').toUpperCase() === 'DIDASKALIA';
  } catch {
    return false;
  }
}

/** Kepala divisi (LEAD/CO_LEAD di divisi event mana pun). */
export async function isDivisionHead(authUser) {
  try {
    const prisma = getPrisma();
    if (!prisma || !authUser?.id) return false;
    const row = await prisma.eventDivisionMember.findFirst({
      where: { userId: authUser.id, role: { in: ['LEAD', 'CO_LEAD'] } },
      select: { id: true },
    });
    return !!row;
  } catch {
    return false;
  }
}

/** Boleh edit tema bulan/minggu + generate: Komisi / BOD Tim Kerja / Didaskalia. */
export async function canEditServiceTheme(authUser) {
  if (!authUser) return false;
  if (hasOwnedRole(authUser, 'SUPERADMIN', 'KOMISI')) return true;
  try {
    if (await isBodTimkerja(authUser)) return true;
  } catch { /* lanjut */ }
  return isDidaskaliaMember(authUser);
}

/** Boleh memutus request tukar: Komisi + BOD + kepala divisi + Didaskalia. */
export async function isServiceApprover(authUser) {
  if (!authUser) return false;
  if (hasOwnedRole(authUser, 'SUPERADMIN', 'KOMISI')) return true;
  try {
    if (await isBodTimkerja(authUser)) return true;
  } catch { /* lanjut */ }
  try {
    if (await isDivisionHead(authUser)) return true;
  } catch { /* lanjut */ }
  return isDidaskaliaMember(authUser);
}

export async function requireServiceTheme(req, res) {
  if (await canEditServiceTheme(req.authUser)) return true;
  res.status(403).json({ error: 'Ubah tema/generate hanya untuk Komisi, BOD Tim Kerja, atau divisi Didaskalia.' });
  return false;
}

/** userId penerima antrean swap: Komisi/Superadmin + BOD + kepala divisi + Didaskalia. */
export async function approverUserIdsForService(prisma) {
  const out = new Set();
  try {
    const rows = await prisma.userRole.findMany({
      where: { role: { in: ['KOMISI', 'SUPERADMIN'] } },
      select: { userId: true },
      take: 100,
    });
    rows.forEach((r) => r.userId && out.add(r.userId));
  } catch { /* abaikan */ }
  try {
    const sms = await prisma.strukturMember.findMany({
      where: { division: { in: ['TIMKERJA', 'DIDASKALIA'] } },
      select: { userId: true, email: true },
      take: 100,
    });
    const emails = [];
    sms.forEach((s) => {
      if (s.userId) out.add(s.userId);
      else if (s.email) emails.push(s.email);
    });
    if (emails.length) {
      const users = await prisma.user.findMany({ where: { email: { in: [...new Set(emails)] } }, select: { id: true } });
      users.forEach((u) => out.add(u.id));
    }
  } catch { /* abaikan */ }
  try {
    const leads = await prisma.eventDivisionMember.findMany({
      where: { role: { in: ['LEAD', 'CO_LEAD'] } },
      select: { userId: true },
      take: 200,
    });
    leads.forEach((r) => r.userId && out.add(r.userId));
  } catch { /* abaikan */ }
  return [...out];
}
