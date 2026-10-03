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
): { head: PublicOrgMember[]; groups: PillarSubGroup[]; ungrouped: PublicOrgMember[] } {
  const head = members.filter((m) => isHeadOfDivision(m.position));
  const rest = members.filter((m) => !isHeadOfDivision(m.position));
  const bySub = new Map<string, PublicOrgMember[]>();
  const ungrouped: PublicOrgMember[] = [];
  for (const m of rest) {
    const sub = String(m.subdivision || '').trim();
    const canonical = canonicalSubs.find((c) => c.toLowerCase() === sub.toLowerCase());
    if (canonical) {
      const list = bySub.get(canonical) || [];
      list.push(m);
      bySub.set(canonical, list);
    } else if (sub) {
      const list = bySub.get(sub) || [];
      list.push(m);
      bySub.set(sub, list);
    } else {
      ungrouped.push(m);
    }
  }
  const groups: PillarSubGroup[] = [];
  for (const c of canonicalSubs) groups.push({ sub: c, people: bySub.get(c) || [] });
  for (const [sub, people] of bySub) {
    if (!canonicalSubs.some((c) => c.toLowerCase() === sub.toLowerCase())) groups.push({ sub, people });
  }
  return { head, groups, ungrouped };
}
