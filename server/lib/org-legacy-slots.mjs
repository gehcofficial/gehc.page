/** Catalog + rename map for Youth panca/BZP slots. Keep in sync with src/lib/pantatugas.ts */

export const SUBDIVISION_MIGRATION = {
  LITURGIA: {
    'Liturgi & Musik': 'Musik & Vokal',
    Pendoa: 'Doa & Intercession',
    Intercessor: 'Doa & Intercession',
  },
  DIDASKALIA: {
    'Kurikulum & Pembekalan': 'Kurikulum Pemuridan',
  },
  KOINONIA: {
    'Program Persekutuan': 'Program & Acara',
    'Public Relations (PR)': 'Hubungan & Komunikasi',
  },
  DIAKONIA: {
    'Logistik & Akomodasi': 'Logistik & Fasilitas',
    Konsumsi: 'Konsumsi & Keramahan',
    'Medis & First Aid': 'Kesehatan & Keselamatan',
  },
  MARTURIA: {
    Dokumentasi: 'Dokumentasi Visual',
    'Penginjilan Praktis': 'Penginjilan & Misi',
  },
  BENZARPR: {
    Merchandise: 'Merchandise & Produk',
    Fundraising: 'Penggalangan Dana',
    Donation: 'Persembahan & Donasi',
  },
};

export const CURRENT_PILLAR_SUBS = {
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

export function parseOrgMeta(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

export function pillarSlotSlug(division, subName) {
  return `${division}_${String(subName || '').replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`;
}

export function legacyCanonicalName(division, name) {
  const map = SUBDIVISION_MIGRATION[String(division || '').toUpperCase()];
  if (!map || !name) return null;
  return map[name] || map[String(name).trim()] || null;
}

export function subdivisionKeyOf(node) {
  const m = parseOrgMeta(node?.metadata);
  return String(m.subdivision || node?.label || '').trim();
}

export function isLegacyPantaSlot(node) {
  if (!node || String(node.nodeKind) !== 'POSITION_SLOT') return false;
  const m = parseOrgMeta(node.metadata);
  const division = String(m.division || '').toUpperCase();
  if (!SUBDIVISION_MIGRATION[division]) return false;
  const key = subdivisionKeyOf(node);
  if (legacyCanonicalName(division, key)) return true;
  const slug = String(node.slug || '').toUpperCase();
  for (const oldName of Object.keys(SUBDIVISION_MIGRATION[division])) {
    if (slug === pillarSlotSlug(division, oldName)) return true;
  }
  return false;
}

/** Pillar open-role on public landing: HoD (no sub) or current catalog name only. */
export function isCanonicalPillarSubdivision(division, subdivision) {
  const div = String(division || '').toUpperCase();
  const list = CURRENT_PILLAR_SUBS[div];
  if (!list) return true;
  const name = String(subdivision || '').trim();
  if (!name) return true;
  return list.includes(name);
}
