import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, CalendarDays, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_COLORS, SERVICE_TYPE_LABELS } from '../../types/penatalayan';

type BoardRole = { id: string; name: string; division: string; subDivision?: string | null; serviceTypes?: string | null };
type BoardSchedule = {
  id: string;
  date: string;
  status: string;
  timeStart?: string | null;
  role: BoardRole | null;
  user: { id: string; name: string } | null;
  checklist: { done: number; total: number };
};
type BoardEvent = { id: string; name: string; serviceType?: string | null; date: string };

const DIVISION_LABEL: Record<string, string> = {
  LITURGIA: 'Liturgia', DIDASKALIA: 'Didaskalia', KOINONIA: 'Koinonia', DIAKONIA: 'Diakonia', MARTURIA: 'Marturia',
};
const DIVISION_ORDER = ['DIDASKALIA', 'LITURGIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'];

const dayLabel = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Papan kontrol: siapa bertugas untuk ibadah mendatang (lintas divisi). */
export const PenatalayanBoard: React.FC<{ focusDivision?: string }> = ({ focusDivision }) => {
  const [data, setData] = useState<{ schedules: BoardSchedule[]; roles: BoardRole[]; events: BoardEvent[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(28);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = isoDaysFromNow(0);
      const to = isoDaysFromNow(days);
      const r = await fetch(`/api/penatalayan/board?from=${from}&to=${to}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setData({ schedules: d.schedules || [], roles: d.roles || [], events: d.events || [] });
    } catch {
      setData({ schedules: [], roles: [], events: [] });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, { date: string; serviceType: string | null; eventName: string | null; items: BoardSchedule[] }>();
    for (const s of data?.schedules || []) {
      const key = String(s.date).slice(0, 10);
      if (!map.has(key)) {
        const ev = (data?.events || []).find((e) => e.date === key);
        map.set(key, { date: key, serviceType: ev?.serviceType || null, eventName: ev?.name || null, items: [] });
      }
      map.get(key)!.items.push(s);
    }
    // Tambahkan tanggal ibadah yang belum ada penugasan sama sekali.
    for (const e of data?.events || []) {
      if (!map.has(e.date)) map.set(e.date, { date: e.date, serviceType: e.serviceType || null, eventName: e.name, items: [] });
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const rolesForDivision = useCallback((division: string, serviceType: string | null) => {
    return (data?.roles || []).filter((r) => r.division === division
      && (!serviceType || String(r.serviceTypes || '').split(',').map((x) => x.trim().toUpperCase()).includes(serviceType)));
  }, [data]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat papan petugas…
      </div>
    );
  }

  const empty = byDate.length === 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="w-4 h-4 text-[#0EA5E9]" />
        <h4 className="text-sm font-black text-[#1B1B1B]">Papan Petugas Ibadah</h4>
        <span className="text-[10px] text-[#8C8880]">kontrol lintas divisi</span>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-auto text-[11px] px-2 py-1 rounded-lg border border-[#D9D7D0]">
          <option value={14}>14 hari</option>
          <option value={28}>28 hari</option>
          <option value={56}>56 hari</option>
        </select>
      </div>

      {empty ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada ibadah mendatang pada rentang ini.</p>
      ) : (
        <div className="space-y-3">
          {byDate.map((day) => {
            const divisions = focusDivision ? [focusDivision] : DIVISION_ORDER;
            return (
              <div key={day.date} className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black text-[#1B1B1B]">{dayLabel(day.date)}</p>
                  {day.serviceType && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                      {SERVICE_TYPE_LABELS[day.serviceType] || day.serviceType}
                    </span>
                  )}
                  {day.eventName && <span className="text-[10px] text-[#8C8880]">{day.eventName}</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {divisions.map((div) => {
                    const catalog = rolesForDivision(div, day.serviceType);
                    const assigned = day.items.filter((s) => s.role?.division === div);
                    const missing = catalog.filter((r) => !assigned.some((a) => a.role?.id === r.id));
                    return (
                      <div key={div} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">{DIVISION_LABEL[div] || div}</p>
                          <span className={`text-[10px] font-bold ${missing.length ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {assigned.length}/{catalog.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {assigned.map((s) => (
                            <div key={s.id} className="flex items-center gap-1.5 text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${SERVICE_STATUS_COLORS[s.status]?.bg || 'bg-gray-300'}`} />
                              <span className="font-semibold text-[#1B1B1B] truncate">{s.role?.name}</span>
                              <span className="text-[#8C8880] truncate">· {s.user?.name || '—'}</span>
                              {s.checklist.total > 0 && (
                                <span className="ml-auto text-[9px] text-[#8C8880]">{s.checklist.done}/{s.checklist.total}</span>
                              )}
                            </div>
                          ))}
                          {missing.length > 0 && (
                            <div className="flex items-start gap-1.5 pt-0.5 text-[10px] text-amber-700">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span className="truncate">Kosong: {missing.map((m) => m.name).join(', ')}</span>
                            </div>
                          )}
                          {assigned.length > 0 && missing.length === 0 && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" /> Lengkap
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#8C8880]">
                  {day.items.length} penugasan · {day.items.filter((s) => s.status === 'DONE').length} selesai ·{' '}
                  {day.items.filter((s) => s.status === 'CONFIRMED').length} dikonfirmasi
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PenatalayanBoard;
