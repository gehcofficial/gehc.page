import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, HandHeart, Home, Users } from 'lucide-react';
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

type Serving = { responsible?: string | null; host?: string | null };

const dayLabel = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

/**
 * Blok publik “Petugas Ibadah” untuk tab Warta.
 * Menampilkan penanggung jawab + tuan rumah + daftar petugas (yang sudah
 * dikonfirmasi) untuk Minggu-minggu mendatang. Kartu disembunyikan hanya bila
 * ketiganya kosong.
 */
export const WartaServiceDutySection: React.FC = () => {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [serving, setServing] = useState<Record<string, Serving>>({});

  useEffect(() => {
    let cancelled = false;
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    fetch(`/api/db/service-schedule?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { duties: [], serving: {} }))
      .then((d) => {
        if (cancelled) return;
        setDuties((d.duties || []) as Duty[]);
        setServing((d.serving || {}) as Record<string, Serving>);
      })
      .catch(() => {
        if (!cancelled) { setDuties([]); setServing({}); }
      });
    return () => { cancelled = true; };
  }, []);

  const days = useMemo(() => {
    const byDay = new Map<string, Duty[]>();
    for (const d of duties) {
      const key = String(d.date || '').slice(0, 10);
      if (!key) continue;
      const list = byDay.get(key) || [];
      list.push(d);
      byDay.set(key, list);
    }
    for (const key of Object.keys(serving)) if (!byDay.has(key)) byDay.set(key, []);
    return [...byDay.entries()]
      .filter(([day, list]) => list.length > 0 || serving[day]?.responsible || serving[day]?.host)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 3);
  }, [duties, serving]);

  if (!days.length) return null;

  return (
    <section className="mb-12">
      <div className="mb-6">
        <SectionHeader
          eyebrow="Petugas Ibadah"
          title="Yang melayani di ibadah mendatang"
          subtitle="Penanggung jawab, tuan rumah, dan petugas yang sudah mengonfirmasi kesiapannya."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {days.map(([day, list]) => {
          const s = serving[day] || {};
          return (
            <div key={day} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#FF416C] flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> {dayLabel(day)}
              </p>
              {(s.responsible || s.host) && (
                <div className="mt-3 space-y-1">
                  {s.responsible && (
                    <p className="text-[11px] text-[#5C5850] flex items-center gap-1.5">
                      <HandHeart className="w-3.5 h-3.5 text-[#8C8880]" /> Penanggung Jawab: <strong>{s.responsible}</strong>
                    </p>
                  )}
                  {s.host && (
                    <p className="text-[11px] text-[#5C5850] flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-[#8C8880]" /> Tuan Rumah: <strong>{s.host}</strong>
                    </p>
                  )}
                </div>
              )}
              {list.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-[#EFEDE8] pt-3">
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
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

/**
 * Blok "Pelayanan" untuk satu tanggal warta (dipakai di detail Warta).
 * Menampilkan penanggung jawab, tuan rumah, dan petugas; tidak render bila kosong.
 */
export const WartaPelayananBlock: React.FC<{ date?: string | null }> = ({ date }) => {
  const day = String(date || '').slice(0, 10);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [serving, setServing] = useState<Serving>({});

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    let cancelled = false;
    fetch(`/api/db/service-schedule?from=${day}&to=${day}`)
      .then((r) => (r.ok ? r.json() : { duties: [], serving: {} }))
      .then((d) => {
        if (cancelled) return;
        setDuties((d.duties || []) as Duty[]);
        setServing((d.serving?.[day] || {}) as Serving);
      })
      .catch(() => { if (!cancelled) { setDuties([]); setServing({}); } });
    return () => { cancelled = true; };
  }, [day]);

  if (!duties.length && !serving.responsible && !serving.host) return null;

  return (
    <div className="rounded-[24px] border border-[#D9D7D0]/60 bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#FF416C]">Pelayanan</p>
      {(serving.responsible || serving.host) && (
        <div className="mt-2 space-y-1">
          {serving.responsible && (
            <p className="text-xs text-[#5C5850]">
              Penanggung Jawab: <strong>{serving.responsible}</strong>
            </p>
          )}
          {serving.host && (
            <p className="text-xs text-[#5C5850]">
              Tuan Rumah: <strong>{serving.host}</strong>
            </p>
          )}
        </div>
      )}
      {duties.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-[#EFEDE8] pt-3">
          {duties.map((d, i) => (
            <li key={`${d.role}-${d.name}-${i}`} className="text-xs text-[#1B1B1B] flex flex-wrap gap-x-2">
              <strong className="font-bold">{d.name}</strong>
              <span className="text-[#8C8880]">
                {d.role}
                {d.division ? ` · ${d.division}` : ''}
                {(d.timeStart || d.timeEnd) ? ` · ${d.timeStart || '—'}–${d.timeEnd || '—'}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
