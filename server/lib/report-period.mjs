/**
 * P6 — Periode laporan (bulan / minggu ISO) + label. Murni, mudah diuji.
 */
import { monthRange } from './church-cash.mjs';

const MONTH_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Rentang minggu ISO (YYYY-Www) → { from, to (eksklusif), label }. */
export function isoWeekRange(str) {
  const m = /^(\d{4})-W(\d{1,2})$/i.exec(String(str || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // Senin=1 … Minggu=7
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const from = new Date(week1Mon);
  from.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 7);
  const endIncl = new Date(to);
  endIncl.setUTCDate(to.getUTCDate() - 1);
  const fmt = (d) => `${d.getUTCDate()} ${MONTH_ID[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
  return {
    type: 'week',
    from,
    to,
    label: `Minggu ${week} · ${fmt(from)}–${fmt(endIncl)}`,
    key: `${year}-W${String(week).padStart(2, '0')}`,
  };
}

/** Rentang bulan → { from, to (eksklusif), label, key }. */
export function monthPeriod(str) {
  const r = monthRange(str);
  const month = Number(r.ym.slice(5, 7)) - 1;
  const year = Number(r.ym.slice(0, 4));
  return { type: 'month', from: r.from, to: r.to, label: `${MONTH_ID[month]} ${year}`, key: r.ym };
}

/**
 * Parse `YYYY-MM` (bulan) atau `YYYY-Www` (minggu). Bila kosong/tak valid →
 * bulan berjalan.
 */
export function parsePeriod(str) {
  const s = String(str || '').trim();
  if (/^\d{4}-W\d{1,2}$/i.test(s)) {
    const w = isoWeekRange(s);
    if (w) return w;
  }
  return monthPeriod(s);
}
