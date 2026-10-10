/**
 * Pelsus V2 18 Okt 2026 — varian preview by-person di `#/pelsus2/...`.
 * V1 (`#/pelsus/...`, alur per-surat-suara) tetap utuh sebagai pembanding.
 * Helper routing + antrean token bilik + surat-berikutnya (murni, teruji).
 */

export type Pelsus2View = 'home' | 'detail' | 'bilik' | 'layar' | 'panitia';
export type Pelsus2Route = { view: Pelsus2View; id: string };

export function parsePelsus2Hash(hash: string): Pelsus2Route | null {
  const raw = String(hash || '')
    .replace(/^#\/?/, '')
    .split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  if (seg[0] !== 'pelsus2') return null;
  if (!seg[1]) return { view: 'home', id: '' };
  // 'panitia' kata kunci — dicek sebelum fallback id election.
  if (seg[1] === 'panitia' && !seg[2]) return { view: 'panitia', id: '' };
  if (seg[2] === 'bilik') return { view: 'bilik', id: seg[1] };
  if (seg[2] === 'layar') return { view: 'layar', id: seg[1] };
  return { view: 'detail', id: seg[1] };
}

export function pelsus2Path(id?: string, view?: 'bilik' | 'layar' | 'panitia'): string {
  if (view === 'panitia') return '#/pelsus2/panitia';
  if (!id) return '#/pelsus2';
  if (view) return `#/pelsus2/${id}/${view}`;
  return `#/pelsus2/${id}`;
}

export function pelsus2Query(hash: string): URLSearchParams {
  const q = String(hash || '').split('?')[1] || '';
  return new URLSearchParams(q);
}

/** Prefix election khusus preview (di luar jangkauan bersih `pelsus:sim` yang menghapus `sim-*`). */
export const PREVIEW_PREFIXES = ['pv2-', 'sim-'];

/** Mode preview steril: `#/pelsus2?sim` hanya tampilkan election preview. */
export function isSimPreview(hash: string): boolean {
  return pelsus2Query(hash).has('sim');
}

export function filterSim<T extends { id: string }>(list: T[], hash: string): T[] {
  if (!isSimPreview(hash)) return list;
  return list.filter((e) => PREVIEW_PREFIXES.some((p) => e.id.startsWith(p)));
}

/**
 * Antrean token bilik berantai: `?tokens=A,B,C` (fallback `?token=A` warisan).
 * Sanitasi alfanumerik kapital, maks 10 token per antrean.
 */
export function parseTokenQueue(hash: string): string[] {
  const q = pelsus2Query(hash);
  const raw = q.get('tokens') || q.get('token') || '';
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
    .slice(0, 10);
}

export type MyElection = {
  id: string;
  open?: boolean;
  status?: string;
  myVoter?: { hasVoted: boolean } | null;
};

/** Surat suara berikut yang masih bisa dipilih (OPEN + terdaftar + belum). */
export function nextUnvoted(list: MyElection[], excludeId?: string): MyElection | null {
  for (const e of list) {
    if (excludeId && e.id === excludeId) continue;
    const open = e.open ?? e.status === 'OPEN';
    if (open && e.myVoter && !e.myVoter.hasVoted) return e;
  }
  return null;
}

/** Ringkasan progres "Sudah X dari N surat suara saya". */
export function myBallotProgress(list: MyElection[]): { done: number; total: number } {
  const mine = list.filter((e) => Boolean(e.myVoter));
  return { done: mine.filter((e) => Boolean(e.myVoter?.hasVoted)).length, total: mine.length };
}
