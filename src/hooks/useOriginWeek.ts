import { useEffect, useMemo, useState } from 'react';
import { weekForEventDate, type WeekOverride } from '../lib/church-week';

function monthRange(iso?: string | null): { from: string; to: string; key: string } {
  const d = iso ? new Date(iso) : new Date(NaN);
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  // ±7 hari agar geseran lintas batas bulan tetap ketemu pasangannya.
  const from = new Date(first.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const to = new Date(last.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  return { from, to, key: `${from}_${to}` };
}

/**
 * {ym, weekIndex} untuk tanggal event dengan menghormati GESER:
 * event geseran 18→17 Okt me-resolve ke origin week (2026-10/W3).
 * Gagal muat override → fallback perilaku lama (tanpa reverse).
 */
export function useOriginWeek(eventDate?: string | null): { ym: string; weekIndex: number; loading: boolean } {
  const [overrides, setOverrides] = useState<WeekOverride[] | null>(null);
  const range = monthRange(eventDate);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/service-overrides?from=${range.from}&to=${range.to}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { overrides: [] }))
      .then((d) => {
        if (!cancelled) setOverrides(Array.isArray(d.overrides) ? d.overrides : []);
      })
      .catch(() => {
        if (!cancelled) setOverrides([]);
      });
    return () => {
      cancelled = true;
    };
  }, [range.key]);
  return useMemo(() => {
    if (!eventDate) return { ym: '', weekIndex: 1, loading: false };
    const { ym, weekIndex } = weekForEventDate(eventDate, overrides || []);
    return { ym, weekIndex, loading: overrides === null };
  }, [eventDate, overrides]);
}
