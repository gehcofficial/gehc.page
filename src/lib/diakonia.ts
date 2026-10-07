/**
 * Diakonia — konstanta + helper murni (Sprint A).
 * Dipakai UI + diuji unit. Server (routes/diakonia.mjs) memirror literal yang sama.
 */

/** Area operasional by-event. */
export const CHECK_AREAS = ['LOGISTIK', 'KONSUMSI', 'KESEHATAN'] as const;
export type CheckArea = (typeof CHECK_AREAS)[number];

/** Status kesiapan per area. */
export const CHECK_STATUS = ['BELUM', 'SIAP', 'KENDALA'] as const;
export type CheckStatus = (typeof CHECK_STATUS)[number];

export function isCheckArea(s: string): s is CheckArea {
  return (CHECK_AREAS as readonly string[]).includes(s);
}

export function isCheckStatus(s: string): s is CheckStatus {
  return (CHECK_STATUS as readonly string[]).includes(s);
}

export type ReadinessInput = { area: string; status: string; note?: string | null };

/** Ringkasan readiness: siap bila semua area SIAP; kendala bila ada KENDALA. */
export function summarizeReadiness(checks: ReadinessInput[]): {
  overall: CheckStatus;
  siap: number;
  kendala: number;
  belum: number;
} {
  const byArea = new Map<string, string>();
  for (const c of checks) {
    if (isCheckArea(c.area) && isCheckStatus(c.status)) byArea.set(c.area, c.status);
  }
  let siap = 0;
  let kendala = 0;
  let belum = 0;
  for (const a of CHECK_AREAS) {
    const s = byArea.get(a) || 'BELUM';
    if (s === 'SIAP') siap += 1;
    else if (s === 'KENDALA') kendala += 1;
    else belum += 1;
  }
  const overall: CheckStatus = kendala > 0 ? 'KENDALA' : belum > 0 ? 'BELUM' : 'SIAP';
  return { overall, siap, kendala, belum };
}

/** Status pipeline kasus mercy. */
export const CASE_STATUS = ['LAPOR', 'ASSESS', 'BANTUAN', 'FOLLOWUP', 'TUTUP'] as const;
export type CaseStatus = (typeof CASE_STATUS)[number];

const CASE_NEXT: Record<CaseStatus, CaseStatus | null> = {
  LAPOR: 'ASSESS',
  ASSESS: 'BANTUAN',
  BANTUAN: 'FOLLOWUP',
  FOLLOWUP: 'TUTUP',
  TUTUP: null,
};

export function nextCaseStatus(s: string): CaseStatus | null {
  const cur = (CASE_STATUS as readonly string[]).includes(s) ? (s as CaseStatus) : null;
  if (!cur) return null;
  return CASE_NEXT[cur];
}

export function isCaseStatus(s: string): s is CaseStatus {
  return (CASE_STATUS as readonly string[]).includes(s);
}

/** Jenis kasus mercy. */
export const CASE_KINDS = ['SAKIT', 'DUKA', 'SUSAH', 'PERANTAU', 'LAINNYA'] as const;

export function isCaseKind(s: string): boolean {
  return (CASE_KINDS as readonly string[]).includes(s);
}
