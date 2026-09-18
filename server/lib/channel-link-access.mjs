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

/** Badan kepemimpinan (kanal permanen). */
export const LEADERSHIP_CATALOG = [
  { id: 'KOMISI', name: 'Komisi' },
  { id: 'TIMKERJA', name: 'Tim Kerja (BOD)' },
  { id: 'BPMJ', name: 'BPMJ' },
];

/** Kategorial BIPRA. */
export const BIPRA_CATALOG = [
  { id: 'BAPAK', name: 'Pria / Kaum Bapa (P/KB)' },
  { id: 'IBU', name: 'Wanita / Kaum Ibu (W/KI)' },
  { id: 'PEMUDA', name: 'Pemuda' },
  { id: 'REMAJA', name: 'Pra Remaja' },
  { id: 'ANAK', name: 'Anak' },
];

const DIVISION_IDS = new Set(DIVISION_CATALOG.map((d) => d.id));

/** Kanal yang hanya boleh ditulis Komisi/Superadmin. */
const KOMISI_ONLY_KINDS = new Set(['EVENT', 'KOLOM', 'LEADERSHIP', 'BIPRA']);

export function isChannelWriterSync(authUser, isBod = false) {
  const r = globalRoles(authUser);
  if (r.includes('SUPERADMIN') || r.includes('KOMISI') || r.includes('BPMJ')) return true;
  return r.includes('COMMITTEE') && isBod;
}

export function canWriteKindSync(authUser, kind, isBod = false) {
  if (!isChannelWriterSync(authUser, isBod)) return false;
  const r = globalRoles(authUser);
  const komisi = r.includes('SUPERADMIN') || r.includes('KOMISI');
  if (KOMISI_ONLY_KINDS.has(String(kind || '').toUpperCase())) return komisi;
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
    const [ras, eventMembers] = await Promise.all([
      prisma.roleAssignment.findMany({
        where: { userId: authUser.id, isActive: true, division: { not: null } },
        select: { division: true },
      }).catch(() => []),
      // Staf divisi event (Tim Kerja per divisi) — sumber ketiga bila struktur/RA kosong.
      prisma.eventDivisionMember.findMany({
        where: { userId: authUser.id },
        select: { eventDivision: { select: { division: true } } },
      }).catch(() => []),
    ]);
    for (const ra of ras) {
      const d = String(ra.division || '').toUpperCase();
      if (DIVISION_IDS.has(d)) codes.add(d);
    }
    for (const m of eventMembers) {
      const d = String(m.eventDivision?.division || '').toUpperCase();
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

// ---------- Kanal personal berjenjang ("Grup WhatsApp Saya") ----------

/**
 * BOD Tim Kerja sesungguhnya: COMMITTEE **dengan** RoleAssignment divisi TIMKERJA/kosong.
 * `isBodTimkerja()` lama menganggap setiap COMMITTEE tanpa baris struktur sebagai BOD
 * (baris struktur di app ini tidak memuat email), jadi terlalu longgar untuk scope kanal personal.
 */
export async function isTimKerjaBod(authUser) {
  const r = globalRoles(authUser);
  if (!r.includes('COMMITTEE')) return false;
  const prisma = getPrisma();
  if (!prisma || !authUser?.id) return false;
  try {
    const ra = await prisma.roleAssignment.findFirst({
      where: { userId: authUser.id, isActive: true, role: 'COMMITTEE' },
      select: { division: true },
    }).catch(() => null);
    if (!ra) return false;
    const div = String(ra.division || '').toUpperCase();
    return !div || div === 'TIMKERJA';
  } catch {
    return false;
  }
}

/** Peringkat pengurus: yang di atas melihat kanal di bawahnya. */
export function channelRank(authUser, { isBod = false, isSuperadmin = false } = {}) {
  if (isSuperadmin) return 'ADMIN';
  const r = globalRoles(authUser);
  if (r.includes('SUPERADMIN')) return 'ADMIN';
  if (r.includes('BPMJ')) return 'BPMJ';
  if (r.includes('KOMISI')) return 'KOMISI';
  if (r.includes('COMMITTEE') && isBod) return 'BOD';
  return 'MEMBER';
}

/** Hanya Superadmin/Admin yang melihat seluruh kanal. */
export const SEE_ALL_RANKS = new Set(['ADMIN']);

/** Kanal kepemimpinan yang melekat pada peran (tanpa melihat kanal lain). */
export function leadershipRefsFor(rank) {
  if (rank === 'ADMIN') return ['KOMISI', 'TIMKERJA', 'BPMJ'];
  if (rank === 'BPMJ') return ['BPMJ'];
  if (rank === 'KOMISI') return ['KOMISI'];
  if (rank === 'BOD') return ['TIMKERJA'];
  return [];
}

/** Jenis kanal yang tampil di kartu personal (EVENT punya permukaan sendiri). */
export const PERSONAL_CHANNEL_KINDS = [
  'LEADERSHIP',
  'BIPRA',
  'KOLOM',
  'GROUP',
  'DIVISION',
  'RECREATIONAL',
];

/**
 * Scope kanal personal: hanya kluster milik pengguna + kanal kepemimpinan sesuai perannya.
 * Hanya ADMIN (Superadmin) yang melihat seluruh kanal. Pure (tanpa DB) agar mudah diuji.
 * @returns {{ seeAll: boolean, refs: Array<{ kind: string, refId: string }> }}
 */
export function personalChannelScope({
  rank = 'MEMBER',
  bipra = null,
  kolomId = null,
  groupIds = [],
  divisionCodes = [],
  recreationalIds = [],
} = {}) {
  if (SEE_ALL_RANKS.has(rank)) return { seeAll: true, refs: [] };
  const refs = [];
  const push = (kind, ids) => {
    for (const id of new Set((ids || []).filter(Boolean))) {
      refs.push({ kind, refId: String(id) });
    }
  };
  push('LEADERSHIP', leadershipRefsFor(rank));
  push('GROUP', groupIds);
  push('DIVISION', divisionCodes);
  push('BIPRA', [bipra]);
  push('KOLOM', [kolomId]);
  push('RECREATIONAL', recreationalIds);
  return { seeAll: false, refs };
}
