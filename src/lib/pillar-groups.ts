/**
 * Pengelompokan anggota pilar per sub-divisi untuk kartu Orang Kami:
 * Kepala Divisi dulu, lalu tiap sub-divisi (yang kosong tetap tampil),
 * tanpa teks ganda bila sub-divisi == jabatan.
 */
import type { PublicOrgMember } from '../hooks/usePublicOrgTree';

export type PillarSubGroup = {
  /** Nama sub-divisi canonical, atau '' untuk tanpa sub. */
  sub: string;
  people: PublicOrgMember[];
};

/** Baris jabatan mengandung "Kepala Divisi"? */
export function isHeadOfDivision(position?: string | null): boolean {
  return /kepala divisi/i.test(String(position || ''));
}

/** Alias sub-divisi ke bucket tampil (display-only, DB tidak diubah). */
const SUB_ALIASES: Record<string, Record<string, string>> = {
  DIDASKALIA: {
    kurikulum: 'Kurikulum dan Modul',
    'kurikulum pemuridan': 'Kurikulum dan Modul',
    'kurikulum & pembekalan': 'Kurikulum dan Modul',
    'pembekalan tim': 'Pembekalan dan Pengarahan',
  },
};

const DIDASKALIA_SUBS = ['Kurikulum dan Modul', 'Pembekalan dan Pengarahan'];

/** Canonical subs divisi (urutan tampil); Didaskalia memakai bucket tunggal. */
export function canonicalSubsFor(division: string, fallback: string[]): string[] {
  if (String(division || '').toUpperCase() === 'DIDASKALIA') return DIDASKALIA_SUBS;
  return fallback;
}

/** Petakan sub mentah ke bucket tampil. */
export function bucketSubOf(division: string, subdivision?: string | null): string | null {
  const sub = String(subdivision || '').trim();
  if (!sub) return null;
  const alias = SUB_ALIASES[String(division || '').toUpperCase()]?.[sub.toLowerCase()];
  return alias || sub;
}

/** Gabung sub-divisi + jabatan; bila sama (abaikan kapital/spasi) tampil sekali. */
export function dedupeRoleLine(subdivision?: string | null, position?: string | null): string {
  const parts = [subdivision, position].map((s) => String(s || '').trim()).filter(Boolean);
  const seen = new Set<string>();
  return parts
    .filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(' · ');
}

/**
 * Susun anggota satu divisi: kepala divisi + grup per sub-divisi canonical
 * (urutan canonical; sub kosong tetap ada dengan people=[]), lalu sisanya.
 */
export function groupPillarMembers(
  members: PublicOrgMember[],
  canonicalSubs: string[],
  division?: string,
): { head: PublicOrgMember[]; groups: PillarSubGroup[]; ungrouped: PublicOrgMember[] } {
  const div = String(division || members[0]?.division || '').toUpperCase();
  const canonical = div === 'DIDASKALIA' ? canonicalSubsFor(div, canonicalSubs) : canonicalSubs;
  const head = members.filter((m) => isHeadOfDivision(m.position));
  const rest = members.filter((m) => !isHeadOfDivision(m.position));
  const bySub = new Map<string, PublicOrgMember[]>();
  const ungrouped: PublicOrgMember[] = [];
  for (const m of rest) {
    const bucket = bucketSubOf(div, m.subdivision);
    if (bucket) {
      const list = bySub.get(bucket) || [];
      list.push(m);
      bySub.set(bucket, list);
    } else {
      ungrouped.push(m);
    }
  }
  const groups: PillarSubGroup[] = [];
  for (const c of canonical) groups.push({ sub: c, people: bySub.get(c) || [] });
  for (const [sub, people] of bySub) {
    if (!canonical.some((c) => c.toLowerCase() === sub.toLowerCase())) groups.push({ sub, people });
  }
  return { head, groups, ungrouped };
}
