/**
 * P6 — Rute laporan presentasi (#/laporan/<jenis>/<periode>[/<unit>]).
 * Murni (tanpa DOM) agar mudah diuji; mirror server/lib/report-period.mjs.
 */

export type ReportKind = 'kas' | 'fasilitas' | 'bpmj' | 'unit';

export type ParsedReportHash = {
  kind: ReportKind;
  /** `YYYY-MM` (bulan) atau `YYYY-Www` (minggu ISO). */
  period: string;
  /** Kode unit (khusus kind 'unit'), mis. PEMUDA. */
  unit?: string;
  path: string;
};

export const REPORT_KINDS: ReportKind[] = ['kas', 'fasilitas', 'bpmj', 'unit'];

const KIND_LABEL: Record<ReportKind, string> = {
  kas: 'Laporan Kas',
  fasilitas: 'Laporan Fasilitas',
  bpmj: 'Laporan BPMJ',
  unit: 'Laporan Unit',
};

export function reportKindLabel(kind: ReportKind): string {
  return KIND_LABEL[kind] || 'Laporan';
}

const PERIOD_RE = /^(\d{4}-\d{2}|\d{4}-W\d{1,2})$/i;

/** `#/laporan/...` → parsed (null bila bukan rute laporan). */
export function parseReportHash(hash: string): ParsedReportHash | null {
  const raw = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] !== 'laporan') return null;
  const kind = String(parts[1] || '').toLowerCase() as ReportKind;
  if (!REPORT_KINDS.includes(kind)) return null;
  if (kind === 'unit') {
    const unit = String(parts[2] || '').toUpperCase();
    const period = String(parts[3] || '');
    if (!unit || !PERIOD_RE.test(period)) return null;
    return { kind, unit, period: period.toUpperCase(), path: `#/laporan/unit/${unit}/${period.toUpperCase()}` };
  }
  const period = String(parts[2] || '');
  if (!PERIOD_RE.test(period)) return null;
  return { kind, period: period.toUpperCase(), path: `#/laporan/${kind}/${period.toUpperCase()}` };
}

export function isReportHash(hash: string): boolean {
  return parseReportHash(hash) !== null;
}

export function reportHashPath(r: { kind: ReportKind; period: string; unit?: string }): string {
  const p = r.period.toUpperCase();
  return r.kind === 'unit' ? `#/laporan/unit/${String(r.unit || '').toUpperCase()}/${p}` : `#/laporan/${r.kind}/${p}`;
}

export function reportAbsoluteUrl(r: { kind: ReportKind; period: string; unit?: string }, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/${reportHashPath(r)}`;
}

/** Kode unit (laporan) untuk id portal. */
export const PORTAL_UNIT_CODE: Record<string, string> = {
  jemaat: 'JEMAAT',
  youth: 'PEMUDA',
  men: 'BAPAK',
  women: 'IBU',
  teen: 'REMAJA',
  kids: 'ANAK',
  kolom: 'KOLOM',
  community: 'KOMUNITAS',
};

export function unitCodeForPortal(portalId: string): string | null {
  return PORTAL_UNIT_CODE[portalId] || null;
}

/** Nomor minggu ISO untuk sebuah tanggal. */
export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Kamis minggu ini
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Kunci periode saat ini. */
export function currentPeriodKeys(date = new Date()): { month: string; week: string } {
  return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, week: isoWeekKey(date) };
}
