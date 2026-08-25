/**
 * Role-based access policy untuk Google Drive (fase 1: baca-saja).
 *
 * Konvensi: TAG zona ditulis DI DALAM nama folder, contoh:
 *   "Event Gallery [PUBLIK]"
 *   "Kelompok Mentoring [MENTOR]"
 *   "RUACH [GROUP:RUACH]"
 *   "Laporan Internal [KOMISI]"
 *
 * Aturan resolusi:
 *   1. Tag terdekat dalam rantai induk menang (anak mewarisi induk,
 *      tag eksplisit pada anak me-narrowing/mengganti).
 *   2. Tanpa tag apa pun di seluruh rantai = DENY (kecuali SUPERADMIN).
 *   3. Tamu (tanpa sesi) hanya boleh zona [PUBLIK].
 *   4. [GROUP:NAMA] di-resolve lewat tabel `groups`: diizinkan bagi
 *      Mentor/Co-Mentor binaan tersebut, Mentee anggota grup tersebut,
 *      serta Committee ke atas.
 */

import { getPrisma, isDbConfigured } from './db.mjs';

export const ZONES = {
  PUBLIK: {
    label: 'Publik',
    // null = termasuk tamu tanpa sesi
    allow: null,
    description: 'Terbuka untuk semua orang termasuk tanpa login',
  },
  MENTEE: {
    label: 'Anggota (login)',
    allow: ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'],
    description: 'Semua yang telah login Google',
  },
  MENTOR: {
    label: 'Pembina',
    allow: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'],
    description: 'Mentor, co-mentor, dan pengurus ke atas',
  },
  COMMITTEE: {
    label: 'Tim Kerja',
    allow: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'],
    description: 'Tim kerja & komisi',
  },
  KOMISI: {
    label: 'Komisi',
    allow: ['SUPERADMIN', 'KOMISI'],
    description: 'Komisi Pemuda saja',
  },
  BPMJ: {
    label: 'BPMJ',
    allow: ['SUPERADMIN', 'BPMJ'],
    description: 'Badan Pekerja Majelis Jemaat',
  },
  ALUMNI: {
    label: 'Alumni',
    allow: ['SUPERADMIN', 'KOMISI', 'ALUMNI'],
    description: 'Alumni & komisi (arsip generasi)',
  },
};

const TAG_RE = /\[([A-Z]+(?::[^\]]+)?)\]/i;

/** Ambil tag zona dari sebuah nama folder, mis. "RUACH [GROUP:RUACH]" → "GROUP:RUACH". */
export function parseTag(folderName) {
  const m = (folderName || '').match(TAG_RE);
  return m ? m[1].toUpperCase() : null;
}

function normalizeRoles(authUser) {
  return (authUser?.roles || []).map((r) => r.role);
}

let _groupMapCache = null;
let _groupMapAt = 0;

/** Map<namaLower, groupId> — dibandingkan di JS agar bebas masalah collation TiDB. */
async function groupNameMap() {
  if (_groupMapCache && Date.now() - _groupMapAt < 60_000) return _groupMapCache;
  const prisma = getPrisma();
  const groups = await prisma.group.findMany({ select: { id: true, name: true } });
  _groupMapCache = new Map(groups.map((g) => [g.name.toLowerCase().trim(), g.id]));
  _groupMapAt = Date.now();
  return _groupMapCache;
}

async function groupIdByName(name) {
  if (!isDbConfigured()) return null;
  const map = await groupNameMap();
  return map.get(String(name).toLowerCase().trim()) || null;
}

/**
 * Cek akses satu zona/tag terhadap user.
 * @returns {{allowed:boolean, reason:string}}
 */
async function zoneAllows(tag, authUser) {
  const roles = normalizeRoles(authUser);
  const isGuest = !authUser;

  let zoneKey = tag;
  let groupName = null;
  if (tag?.startsWith('GROUP:')) {
    zoneKey = 'GROUP';
    groupName = tag.slice(6).trim();
  }

  if (zoneKey === 'PUBLIK') return { allowed: true, reason: 'zona publik' };

  if (isGuest) return { allowed: false, reason: 'perlu login untuk konten ini' };

  if (zoneKey === 'GROUP') {
    if (!groupName) return { allowed: false, reason: 'tag GROUP tidak lengkap' };
    if (roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE')) {
      return { allowed: true, reason: 'pengurus' };
    }
    const gid = await groupIdByName(groupName);
    if (!gid) return { allowed: false, reason: `grup "${groupName}" tidak ditemukan di database` };
    const scoped = roles.some(
      (r) => (r === 'MENTOR' || r === 'CO_MENTOR' || r === 'MENTEE') &&
        (authUser.roles || []).some((ur) => ur.role === r && ur.groupId === gid)
    );
    return scoped
      ? { allowed: true, reason: `anggota/pembina grup ${groupName}` }
      : { allowed: false, reason: `bukan pembina/anggota grup ${groupName}` };
  }

  const zone = ZONES[zoneKey];
  if (!zone) return { allowed: false, reason: `zona tidak dikenal: ${tag}` };
  if (zone.allow === null) return { allowed: true, reason: 'zona terbuka' };
  const ok = roles.some((r) => zone.allow.includes(r));
  return ok
    ? { allowed: true, reason: `role memenuhi zona ${zone.label}` }
    : { allowed: false, reason: `zona ${zone.label} membutuhkan: ${zone.allow.join(', ')}` };
}

/**
 * Resolusi akses atas rantai folder.
 * @param {Array<{id:string,name:string}>} chain — urutan dari INDUK TERATAS → folder tujuan
 *        (output getFolderChain). Evaluasi dimulai dari FOLDER TUJUAN (elemen terakhir),
 *         berjalan naik ke root; tag terdekat dari tujuan yang menang.
 * @param {object|null} authUser — req.authUser
 */
export async function resolveAccess(chain, authUser) {
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i];
    const tag = parseTag(node.name);
    if (tag) {
      const result = await zoneAllows(tag, authUser);
      return { ...result, tag, matchedFolder: node.name };
    }
  }
  // Tidak ada tag di seluruh rantai.
  if (normalizeRoles(authUser).includes('SUPERADMIN')) {
    return { allowed: true, reason: 'SUPERADMIN (rantai tanpa tag)', tag: null };
  }
  return {
    allowed: false,
    reason: 'folder belum bertag — tambahkan [PUBLIK]/[MENTEE]/[MENTOR]/… pada namanya (lihat drive-integration.md)',
    tag: null,
  };
}

/** Ringkasan matriks untuk UI audit. */
export function matrixForUser(authUser) {
  const rows = [];
  for (const [key, z] of Object.entries(ZONES)) {
    // sinkron dengan zoneAllows — versi cepat tanpa DB
    let allowed;
    if (z.allow === null) allowed = true;
    else if (!authUser) allowed = false;
    else allowed = normalizeRoles(authUser).some((r) => z.allow.includes(r));
    rows.push({ zone: key, label: z.label, description: z.description, allowed });
  }
  return rows;
}
