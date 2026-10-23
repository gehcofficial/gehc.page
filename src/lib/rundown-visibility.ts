import type { PortalId } from './portal-profiles';

export type RundownAccessContext = {
  portalId: PortalId;
  isSuperAdmin?: boolean;
  isBpmj?: boolean;
  isKomisi?: boolean;
  isBodTimkerja?: boolean;
};

/** Rundown lengkap: BOD Youth, SUPERADMIN, BPMJ, KOMISI (paritas) — hanya bermakna di portal Pemuda. */
export function canViewFullWorshipRundown(ctx: RundownAccessContext): boolean {
  if (ctx.portalId !== 'youth') return true;
  return Boolean(
    ctx.isSuperAdmin || ctx.isBpmj || ctx.isKomisi || ctx.isBodTimkerja,
  );
}

export type RundownPhaseRow = {
  division?: string | null;
  no?: number | null;
  title?: string | null;
  minutes?: number | null;
  owner?: string | null;
  notes?: string | null;
  parallelGroup?: string | null;
  track?: string | null;
  anchor?: string | null;
};

/**
 * Filter baris rundown per divisi aktif. Tanpa hak penuh, hanya fase dengan
 * `division` yang cocok (case-insensitive). Fase tanpa division disembunyikan.
 */
export function filterRundownPhases<T extends RundownPhaseRow>(
  phases: T[],
  opts: { canViewFull: boolean; viewerDivision?: string | null },
): T[] {
  if (opts.canViewFull) return phases;
  const div = String(opts.viewerDivision || '').toUpperCase();
  if (!div) return [];
  return phases.filter((p) => String(p.division || '').toUpperCase() === div);
}

/** Varian Pembuka/Persembahan hanya diedit Liturgia; Didaskalia & divisi lain read-only. */
export function canEditLiturgiaPatternVariant(opts: {
  canViewFull: boolean;
  viewerDivision?: string | null;
  isSuperAdmin?: boolean;
  isKomisi?: boolean;
}): boolean {
  if (opts.isSuperAdmin || opts.isKomisi) return true;
  if (opts.canViewFull) return false;
  return String(opts.viewerDivision || '').toUpperCase() === 'LITURGIA';
}
