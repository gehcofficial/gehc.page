import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { SectionHeader } from './ui/SectionHeader';

type Duty = {
  date: string;
  role: string;
  division?: string | null;
  name: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  status?: string | null;
};

const dayLabel = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

/**
 * Seksi publik “Petugas Ibadah” — hanya menampilkan petugas yang SUDAH
 * dikonfirmasi (status CONFIRMED/DONE). Data dari /api/db/service-schedule.
 */
export const PublicServiceDutySection: React.FC = () => {
  const [duties, setDuties] = useState<Duty[]>([]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    fetch(`/api/db/service-schedule?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { duties: [] }))
      .then((d) => { if (!cancelled) setDuties((d.duties || []) as Duty[]); })
      .catch(() => { if (!cancelled) setDuties([]); });
    return () => { cancelled = true; };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Duty[]>();
    for (const d of duties) {
      const key = String(d.date || '').slice(0, 10);
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 3);
  }, [duties]);

  if (!byDay.length) return null;

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      <div className="mb-10">
        <SectionHeader
          eyebrow="Petugas Ibadah"
          title="Yang melayani di ibadah mendatang"
          subtitle="Nama petugas yang sudah mengonfirmasi kesiapannya."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {byDay.map(([day, list]) => (
          <div key={day} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#FF416C] flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> {dayLabel(day)}
            </p>
            <ul className="mt-3 space-y-2">
              {list.map((d, i) => (
                <li key={`${d.role}-${d.name}-${i}`} className="flex items-start gap-2">
                  <Users className="w-3.5 h-3.5 text-[#8C8880] mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-[#1B1B1B] truncate">{d.name}</span>
                    <span className="block text-[10px] text-[#8C8880] truncate">
                      {d.role}
                      {d.division ? ` · ${d.division}` : ''}
                      {(d.timeStart || d.timeEnd) ? ` · ${d.timeStart || '—'}–${d.timeEnd || '—'}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
