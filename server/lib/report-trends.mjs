/**
 * P7 — Tren bulanan (murni). Dipakai Dasbor BPMJ.
 */

/** Daftar kunci bulan `YYYY-MM` (ascending) untuk `n` bulan terakhir. */
export function lastMonths(n, ref = new Date()) {
  const out = [];
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * Gabungkan agregat mentah menjadi baris tren per bulan.
 * rows: { cash?: [{ym,direction,total}], bzp?: [{ym,total}], bookings?: [{ym,count}], incidents?: [{ym,count}] }
 */
export function mergeTrend(months, rows = {}) {
  const cashIn = new Map();
  const cashOut = new Map();
  for (const r of rows.cash || []) {
    const k = String(r.ym);
    if (String(r.direction).toUpperCase() === 'IN') cashIn.set(k, (cashIn.get(k) || 0) + Number(r.total || 0));
    else cashOut.set(k, (cashOut.get(k) || 0) + Number(r.total || 0));
  }
  const bzp = new Map((rows.bzp || []).map((r) => [String(r.ym), Number(r.total || 0)]));
  const bookings = new Map((rows.bookings || []).map((r) => [String(r.ym), Number(r.count || 0)]));
  const incidents = new Map((rows.incidents || []).map((r) => [String(r.ym), Number(r.count || 0)]));
  return months.map((ym) => ({
    ym,
    cashIn: cashIn.get(ym) || 0,
    cashOut: cashOut.get(ym) || 0,
    net: (cashIn.get(ym) || 0) - (cashOut.get(ym) || 0),
    bzp: bzp.get(ym) || 0,
    bookings: bookings.get(ym) || 0,
    incidents: incidents.get(ym) || 0,
  }));
}

/** Nilai maksimum satu kolom (untuk skala bar). */
export function maxOf(trend, key) {
  return (trend || []).reduce((m, r) => Math.max(m, Number(r[key] || 0)), 0);
}
