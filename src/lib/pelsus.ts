/**
 * Pelsus 11 Okt 2026 — helper routing + kuorum (murni, teruji).
 * Alur warta: Juklak → Absensi/Kuorum → Cara memilih → Pilih.
 */

export type PelsusScope = 'BIPRA' | 'KOLOM' | 'BPMJ';
export type PelsusView = 'home' | 'detail' | 'bilik' | 'layar';
export type PelsusRoute = { view: PelsusView; id: string };

export function parsePelsusHash(hash: string): PelsusRoute | null {
  const raw = String(hash || '')
    .replace(/^#\/?/, '')
    .split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  if (seg[0] !== 'pelsus') return null;
  if (!seg[1]) return { view: 'home', id: '' };
  if (seg[2] === 'bilik') return { view: 'bilik', id: seg[1] };
  if (seg[2] === 'layar') return { view: 'layar', id: seg[1] };
  return { view: 'detail', id: seg[1] };
}

export function pelsusPath(id?: string, view?: 'bilik' | 'layar'): string {
  if (!id) return '#/pelsus';
  if (view) return `#/pelsus/${id}/${view}`;
  return `#/pelsus/${id}`;
}

/** Kuorum terpenuhi? need = ceil(total * num/den). */
export function quorumNeed(total: number, num = 2, den = 3): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  if (t <= 0) return 0;
  return Math.ceil((t * (num || 2)) / (den || 3));
}

export function quorumMet(voted: number, total: number, num = 2, den = 3): boolean {
  return (Number(voted) || 0) >= quorumNeed(total, num, den) && quorumNeed(total, num, den) > 0;
}

export const SCOPE_LABEL: Record<PelsusScope, string> = {
  BIPRA: 'Penatua BIPRA',
  KOLOM: 'Penatua & Diaken Kolom',
  BPMJ: 'BPMJ',
};

export function electionSubtitle(e: { scope: string; bipra?: string | null; kolomId?: string | null; roleTarget?: string | null }): string {
  const parts: string[] = [];
  if (e.scope === 'BIPRA' && e.bipra) parts.push(e.bipra);
  if (e.scope === 'KOLOM' && e.kolomId) parts.push(e.kolomId);
  if (e.roleTarget) parts.push(e.roleTarget);
  return parts.join(' · ');
}

/** Backoff polling: 503 → mundur 5→30 dtk + jitter (anti thundering-herd). */
export function nextPollDelay(failures: number, baseMs = 15000): number {
  const capped = Math.min(failures, 5);
  const delay = baseMs * Math.pow(1.5, capped);
  return Math.min(60000, Math.floor(delay + Math.random() * 2000));
}
