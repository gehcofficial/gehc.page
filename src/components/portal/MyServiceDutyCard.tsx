import React from 'react';
import { CalendarClock, CheckCheck, CheckCircle2, Clock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { useMyServiceDuty, type ServiceDuty } from '../../hooks/usePortalQueries';

const dayLabel = (iso?: string | null) => {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
};

/**
 * Kartu “Tugas penatalayan saya” — daftar tugas mendatang milik pengguna,
 * dengan aksi konfirmasi/selesai (backend mengizinkan petugas mengubah statusnya).
 */
export const MyServiceDutyCard: React.FC = () => {
  const { t } = useLang();
  const { addToast } = useApp();
  const qc = useQueryClient();
  const md = t.portal.myDuty;
  const { data: duties = [] } = useMyServiceDuty(true);

  if (!duties.length) return null;

  const setStatus = async (duty: ServiceDuty, status: 'CONFIRMED' | 'DONE') => {
    const r = await fetch(`/api/penatalayan/schedules/${duty.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      addToast({ type: 'error', title: d.error || 'Gagal mengubah status tugas' });
      return;
    }
    addToast({ type: 'success', title: status === 'CONFIRMED' ? md.confirmed : md.doneToast });
    void qc.invalidateQueries({ queryKey: ['my-service-duty'] });
  };

  const statusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    const label = s === 'CONFIRMED' ? md.statusConfirmed : s === 'DONE' ? md.statusDone : md.statusScheduled;
    const cls = s === 'DONE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s === 'CONFIRMED'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
  };

  return (
    <div className="rounded-[32px] border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm space-y-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4" /> {md.title}
        </p>
        <p className="text-xs text-[#5C5850] mt-0.5">{md.subtitle}</p>
      </div>
      <ul className="space-y-1.5">
        {duties.map((duty) => {
          const s = String(duty.status || '').toUpperCase();
          return (
            <li key={duty.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-white border border-indigo-100">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#1B1B1B] truncate">
                  {duty.role}
                  {duty.division ? <span className="ml-1.5 text-[10px] font-bold text-[#8C8880]">{duty.division}</span> : null}
                </p>
                <p className="text-[10px] text-[#8C8880] flex flex-wrap items-center gap-x-2">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {dayLabel(duty.date)}</span>
                  {(duty.timeStart || duty.timeEnd) && <span>{duty.timeStart || '—'}–{duty.timeEnd || '—'}</span>}
                  {duty.event?.name && <span className="truncate">· {duty.event.name}</span>}
                </p>
              </div>
              {statusBadge(s)}
              {s === 'SCHEDULED' && (
                <button
                  type="button"
                  onClick={() => void setStatus(duty, 'CONFIRMED')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-600 text-white text-[11px] font-bold"
                >
                  <CheckCircle2 className="w-3 h-3" /> {md.confirm}
                </button>
              )}
              {s === 'CONFIRMED' && (
                <button
                  type="button"
                  onClick={() => void setStatus(duty, 'DONE')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold"
                >
                  <CheckCheck className="w-3 h-3" /> {md.done}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
