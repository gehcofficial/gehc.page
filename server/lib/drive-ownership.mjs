/**
 * Registry ACL: siapa boleh POST ke slot Website Visual / folder ops.
 * GET publik hanya untuk stem terdaftar di Website Visual [PUBLIK].
 */
import { TEN_HOMES, VISUAL_SLOTS, stemOfFileName } from './website-visuals.mjs';
import { getPrisma } from '../db.mjs';
import { isSuperadminEmail } from '../auth.mjs';
import { globalRoles, isKomisiOrSuperadmin, isBodTimkerja } from '../division-rbac.mjs';

export const GROUP_SUBFOLDERS = [
  'Absensi',
  'Materi PA',
  'Foto Kegiatan',
  'Dokumen Lainnya',
  'Agenda Mandiri',
  'Cover',
];

export const PILLAR_OPS_FOLDERS = ['Cover', 'Foto Kegiatan', 'Foto Tim'];

/** Mirror src/lib/pantatugas.ts — canonical names, Bahasa. */
export const CANONICAL_SUB_DIVISIONS = {
  LITURGIA: ['Liturgi & Ibadah', 'Musik & Vokal', 'Doa & Intercession'],
  DIDASKALIA: ['Kurikulum Pemuridan', 'Pembekalan Tim'],
  KOINONIA: ['Program & Acara', 'Persekutuan & Integrasi', 'Hubungan & Komunikasi'],
  DIAKONIA: [
    'Logistik & Fasilitas',
    'Konsumsi & Keramahan',
    'Kesehatan & Keselamatan',
    'Kasih Peduli & Benevolence',
    'Dukungan Perantau',
  ],
  MARTURIA: ['Dokumentasi Visual', 'Desain & Publikasi', 'Kesaksian & Story', 'Penginjilan & Misi'],
  BENZARPR: ['Merchandise & Produk', 'Penggalangan Dana', 'Persembahan & Donasi'],
};

export const PILLAR_DRIVE_LABEL = {
  LITURGIA: 'Liturgia',
  DIDASKALIA: 'Didaskalia',
  KOINONIA: 'Koinonia',
  DIAKONIA: 'Diakonia',
  MARTURIA: 'Marturia',
  BENZARPR: 'Benzarpreneurship',
};

/** Extra children under each canonical subdivision. Leave old Drive names in place. */
export const SUBDIVISION_CHILDREN = {
  'Liturgi & Ibadah': ['Foto', 'Berkas', 'Berkas/rundown', 'Foto/ibadah'],
  'Musik & Vokal': ['Foto', 'Berkas', 'Berkas/chord', 'Foto/rehearsal'],
  'Doa & Intercession': ['Foto', 'Berkas', 'Berkas/pokok-doa'],
  'Kurikulum Pemuridan': ['Foto', 'Berkas', 'Berkas/modul'],
  'Pembekalan Tim': ['Foto', 'Berkas', 'Foto/pembekalan', 'Berkas/materi-tim'],
  'Program & Acara': ['Foto', 'Berkas'],
  'Persekutuan & Integrasi': ['Foto', 'Berkas', 'Foto/welcome'],
  'Hubungan & Komunikasi': ['Foto', 'Berkas'],
  'Logistik & Fasilitas': ['Foto', 'Berkas', 'Inventaris', 'Berkas/checklist'],
  'Konsumsi & Keramahan': ['Foto', 'Berkas', 'Foto/distribusi'],
  'Kesehatan & Keselamatan': ['Foto', 'Berkas'],
  'Kasih Peduli & Benevolence': ['Foto', 'Berkas', 'Kunjungan'],
  'Dukungan Perantau': ['Foto', 'Berkas', 'Berkas/tips', 'Foto/komunitas'],
  'Dokumentasi Visual': ['Foto', 'Berkas', 'Arsip Acara'],
  'Desain & Publikasi': ['Foto', 'Berkas'],
  'Kesaksian & Story': ['Foto', 'Berkas', '_inbox'],
  'Penginjilan & Misi': ['Foto', 'Berkas', 'Foto/outreach'],
  'Merchandise & Produk': ['Foto', 'Berkas', 'produk'],
  'Penggalangan Dana': ['Foto', 'Berkas', 'produk'],
  'Persembahan & Donasi': ['Foto', 'Berkas', 'kampanye'],
};

export const BZP_CATEGORY_FOLDER = {
  MERCHANDISE: 'Merchandise & Produk',
  FUNDRAISING: 'Penggalangan Dana',
  DONATION: 'Persembahan & Donasi',
};

export const BZP_OPS_EXTRA = ['Pesanan', 'Cover'];

export const ZONE_OWNERS = {
  'Ruang Anggota [MENTEE]': {
    get: 'Semua yang login kecuali BPMJ/alumni (matriks gdrive-policy)',
    post: 'Pemilik file / diri sendiri — bukan arsip acara',
  },
  'Laporan Internal [KOMISI]': {
    get: 'KOMISI + SUPERADMIN',
    post: 'KOMISI — Jethro, PDF divisi. BPMJ tidak baca.',
  },
  'Ringkasan BPMJ [BPMJ]': {
    get: 'BPMJ + SUPERADMIN',
    post: 'KOMISI meletakkan saduran. Jangan gabung dengan Laporan Internal.',
  },
  'Arsip Generasi [ALUMNI]': {
    get: 'ALUMNI + KOMISI',
    post: 'Komisi (atau alumni kenangan sendiri). Bukan gudang foto Natal.',
  },
  'Warta Publik [PUBLIK]': {
    get: 'Publik',
    post: 'Marturia Dokumentasi; nama folder dari Didaskalia',
  },
  'Event Gallery [PUBLIK]': {
    get: 'Warisan — landing tidak memakai urutan file di sini',
    post: 'Deprecated. Arsip acara → Marturia/Dokumentasi Visual/Arsip Acara/',
  },
};

const MARTURIA_DESIGN = 'Desain & Publikasi';
const MARTURIA_STORY = 'Kesaksian & Story';
const MARTURIA_DOCS = 'Dokumentasi Visual';

function rolesOf(authUser) {
  return globalRoles(authUser);
}

export function isPlatformAdminUser(authUser) {
  if (!authUser) return false;
  if (isSuperadminEmail(authUser.email)) return true;
  return rolesOf(authUser).includes('SUPERADMIN');
}

export function houseStem(groupName) {
  return `cover-${String(groupName || '')
    .toLowerCase()
    .trim()}`;
}

export function isTenHome(name) {
  const n = String(name || '').toLowerCase();
  return TEN_HOMES.some((h) => h.toLowerCase() === n);
}

export function findRegisteredSlot(folder, stem) {
  const f = String(folder || '').toLowerCase();
  const s = stemOfFileName(stem);
  const exact = VISUAL_SLOTS.find((slot) => slot.folder.toLowerCase() === f && slot.stem.toLowerCase() === s);
  if (exact) return exact;
  if (f === 'kelompok' && /^cover-/.test(s)) {
    const house = s.replace(/^cover-/, '');
    if (isTenHome(house)) {
      return { folder: 'kelompok', stem: s, key: `kelompok.${house}`, usedAt: `Cover rumah ${house}` };
    }
  }
  if (f === 'pengurus' && s && !s.startsWith('contoh')) {
    return { folder: 'pengurus', stem: s, key: `pengurus.${s}`, usedAt: 'Foto pengurus' };
  }
  if (f === 'testimoni' && s && !s.startsWith('contoh')) {
    return { folder: 'testimoni', stem: s, key: `testimoni.${s}`, usedAt: 'Foto penulis testimoni' };
  }
  if (f === 'users' && s) {
    return { folder: 'users', stem: s, key: `users.${s}`, usedAt: 'Foto profil' };
  }
  if (f === 'panca' && /^cover-/.test(s)) {
    return { folder: 'panca', stem: s, key: `panca.${s.replace(/^cover-/, '')}`, usedAt: 'Cover panca/BOD' };
  }
  return null;
}

export async function loadStruktur(authUser) {
  if (!authUser?.email) return null;
  try {
    const prisma = getPrisma();
    if (!prisma) return null;
    return prisma.strukturMember.findFirst({ where: { email: authUser.email } });
  } catch {
    return null;
  }
}

export function groupIdsOf(authUser) {
  return (authUser?.roles || []).map((r) => r.groupId).filter(Boolean);
}

export function isMentorOfGroup(authUser, groupId) {
  if (!authUser || !groupId) return false;
  if (isKomisiOrSuperadmin(authUser) || isPlatformAdminUser(authUser)) return true;
  return (authUser.roles || []).some(
    (r) => r.groupId === groupId && (r.role === 'MENTOR' || r.role === 'CO_MENTOR'),
  );
}

export function isMemberOfGroup(authUser, groupId) {
  if (!authUser || !groupId) return false;
  if (isKomisiOrSuperadmin(authUser) || isPlatformAdminUser(authUser)) return true;
  if ((authUser.roles || []).some((r) => r.role === 'COMMITTEE' || r.role === 'BPMJ')) return true;
  return (authUser.roles || []).some((r) => r.groupId === groupId);
}

async function inSubdivision(authUser, division, subdivision) {
  if (isKomisiOrSuperadmin(authUser) || isPlatformAdminUser(authUser)) return true;
  const sm = await loadStruktur(authUser);
  if (!sm) return false;
  const div = String(sm.division || '').toUpperCase();
  if (div === 'TIMKERJA' || !div) return Boolean(rolesOf(authUser).includes('COMMITTEE'));
  if (div !== String(division || '').toUpperCase()) return false;
  if (!subdivision) return true;
  return String(sm.subdivision || '').toLowerCase() === String(subdivision).toLowerCase();
}

async function inDivision(authUser, division) {
  return inSubdivision(authUser, division, null);
}

/**
 * @returns {{ allowed: boolean, reason: string, slot?: object }}
 */
export async function resolveSlotWrite(authUser, folder, stem, extra = {}) {
  if (!authUser) return { allowed: false, reason: 'Belum login.' };
  const slot = findRegisteredSlot(folder, stem);
  if (!slot) return { allowed: false, reason: 'Slot tidak terdaftar.' };

  if (isPlatformAdminUser(authUser) || isKomisiOrSuperadmin(authUser)) {
    return { allowed: true, reason: 'komisi', slot };
  }

  const f = slot.folder.toLowerCase();
  const s = slot.stem.toLowerCase();

  if (f === 'brand') {
    return { allowed: false, reason: 'Logo hanya Komisi.' };
  }
  if (f === 'landing' || f === 'warta' || f === 'kegiatan') {
    const ok = await inSubdivision(authUser, 'MARTURIA', MARTURIA_DESIGN);
    return { allowed: ok, reason: ok ? 'marturia-desain' : 'Hanya Marturia Desain & Publikasi.', slot };
  }
  if (f === 'kelompok') {
    const groupId = extra.groupId;
    if (!groupId) return { allowed: false, reason: 'Kelompok wajib.', slot };
    const ok = isMentorOfGroup(authUser, groupId);
    return { allowed: ok, reason: ok ? 'mentor-rumah' : 'Hanya mentor/co rumah ini.', slot };
  }
  if (f === 'pengurus') {
    return { allowed: false, reason: 'Foto pengurus hanya Komisi.', slot };
  }
  if (f === 'testimoni') {
    const ok = await inSubdivision(authUser, 'MARTURIA', MARTURIA_STORY);
    return { allowed: ok, reason: ok ? 'marturia-kesaksian' : 'Hanya Marturia Kesaksian setelah Komisi setuju.', slot };
  }
  if (f === 'users') {
    const ok = extra.userId === authUser.id || s === String(authUser.id).toLowerCase();
    return { allowed: ok, reason: ok ? 'pemilik' : 'Hanya foto profil sendiri.', slot };
  }
  if (f === 'benzarpreneurship') {
    if (s === '03-qris') {
      const bzp = await inDivision(authUser, 'BENZARPR');
      const bod = await isBodTimkerja(authUser);
      const ok = bzp || bod;
      return { allowed: ok, reason: ok ? 'bzp-bendahara' : 'QRIS: BZP atau Bendahara Tim Kerja.', slot };
    }
    const ok = await inDivision(authUser, 'BENZARPR');
    return { allowed: ok, reason: ok ? 'bzp' : 'Hanya BZP.', slot };
  }
  if (f === 'panca') {
    const map = {
      'cover-liturgia': 'LITURGIA',
      'cover-didaskalia': 'DIDASKALIA',
      'cover-koinonia': 'KOINONIA',
      'cover-diakonia': 'DIAKONIA',
      'cover-marturia': 'MARTURIA',
      'cover-benzarpr': 'BENZARPR',
    };
    if (s === 'cover-bod') {
      const ok = await isBodTimkerja(authUser);
      return { allowed: ok, reason: ok ? 'bod' : 'Cover BOD: Ketua Tim Kerja / Komisi.', slot };
    }
    const div = map[s];
    if (!div) return { allowed: false, reason: 'Stem panca tidak dikenal.', slot };
    const ok = await inDivision(authUser, div);
    return { allowed: ok, reason: ok ? 'hod-divisi' : 'Hanya PIC/HoD divisi ini.', slot };
  }

  return { allowed: false, reason: 'Tidak diizinkan.', slot };
}

export async function assertSlotWrite(authUser, folder, stem, extra = {}) {
  const verdict = await resolveSlotWrite(authUser, folder, stem, extra);
  if (!verdict.allowed) {
    throw Object.assign(new Error(verdict.reason || 'Akses ditolak.'), { status: 403 });
  }
  return verdict.slot;
}

export async function isMarturiaStory(authUser) {
  return inSubdivision(authUser, 'MARTURIA', MARTURIA_STORY);
}

export async function isMarturiaDocs(authUser) {
  return inSubdivision(authUser, 'MARTURIA', MARTURIA_DOCS);
}

export async function isBzpStaff(authUser) {
  if (!authUser) return false;
  if (isKomisiOrSuperadmin(authUser) || isPlatformAdminUser(authUser)) return true;
  return inDivision(authUser, 'BENZARPR');
}

export async function isDiakoniaCare(authUser) {
  return inSubdivision(authUser, 'DIAKONIA', 'Kasih Peduli & Benevolence');
}

export async function isLiturgiaDoa(authUser) {
  return inSubdivision(authUser, 'LITURGIA', 'Doa & Intercession');
}

export function newEntityId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export { MARTURIA_DESIGN, MARTURIA_STORY, MARTURIA_DOCS };
