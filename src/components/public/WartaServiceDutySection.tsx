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

type Serving = {
  responsible?: string | null;
  host?: string | null;
  hostGroupId?: string | null;
  hostMembers?: string[];
  projected?: boolean;
};

const dayLabel = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

/**
 * Kelompokkan petugas per nama: satu nama = satu baris, role unik digabung
 * dengan “ · ” mengikuti urutan jadwal. Jam tidak ditampilkan (sudah ada di
 * info kegiatan) — publik hanya butuh nama + role.
 */
const mergeDutiesByName = (duties: Duty[]) => {
  const byName = new Map<string, { name: string; roles: string[] }>();
  for (const d of duties) {
    const name = String(d.name || '').trim() || '—';
    const role = String(d.role || '').trim();
    const entry = byName.get(name) || { name, roles: [] };
    if (role && !entry.roles.includes(role)) entry.roles.push(role);
    byName.set(name, entry);
  }
  return [...byName.values()];
};

/** Blok “Pelayanan” untuk satu hari (dipakai kartu Warta & detail Warta). */
const DutyDayBlock: React.FC<{ day: string; duties: Duty[]; serving: Serving }> = ({ day, duties, serving }) => (
  <div className="space-y-3">
    {serving.responsible && (
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-[#8C8880] flex items-center gap-1.5">
          <HandHeart className="w-3.5 h-3.5" /> Penanggung Jawab
        </p>
        <p className="text-xs font-bold text-[#1B1B1B]">
          {serving.responsible}
          {serving.projected ? <span className="font-normal text-[#8C8880]"> (perkiraan)</span> : null}
        </p>
        {duties.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {mergeDutiesByName(duties).map((p) => (
              <li key={p.name} className="text-[11px] text-[#1B1B1B] flex flex-wrap gap-x-1.5">
                <span className="font-bold">{p.name}</span>
                {p.roles.length > 0 && <span className="text-[#8C8880]">{p.roles.join(' · ')}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-[#B8B4AC] mt-0.5">Petugas belum ada.</p>
        )}
      </div>
    )}

    {serving.host && (
      <div className="border-t border-[#EFEDE8] pt-2">
        <p className="text-[11px] font-black uppercase tracking-wider text-[#8C8880] flex items-center gap-1.5">
          <Home className="w-3.5 h-3.5" /> Tuan Rumah
        </p>
        <p className="text-xs font-bold text-[#1B1B1B]">
          {serving.host}
          {serving.projected ? <span className="font-normal text-[#8C8880]"> (perkiraan)</span> : null}
        </p>
        {(serving.hostMembers || []).length > 0 ? (
          <p className="mt-1 text-[11px] text-[#5C5850] leading-relaxed">
            {(serving.hostMembers || []).join(' · ')}
          </p>
        ) : (
          <p className="text-[10px] text-[#B8B4AC] mt-0.5">Daftar anggota belum tersedia.</p>
        )}
      </div>
    )}

    <p className="sr-only">{day}</p>
  </div>
);

/**
 * Blok publik “Petugas Ibadah” untuk tab Warta.
 * Penanggung Jawab → daftar petugas penatalayan; Tuan Rumah → semua nama anggota.
 * Kartu disembunyikan hanya bila tidak ada penanggung, tuan rumah, maupun petugas.
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
          subtitle="Penanggung jawab beserta petugasnya, dan tuan rumah beserta anggotanya."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {days.map(([day, list]) => (
          <div key={day} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#FF416C] flex items-center gap-1.5 mb-3">
              <CalendarDays className="w-3.5 h-3.5" /> {dayLabel(day)}
            </p>
            <DutyDayBlock day={day} duties={list} serving={serving[day] || {}} />
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * Blok “Pelayanan” untuk satu tanggal warta (dipakai di detail Warta).
 * Struktur sama: Penanggung Jawab → petugas; Tuan Rumah → semua anggota.
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
      <p className="text-[11px] font-black uppercase tracking-wider text-[#FF416C] mb-3 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> Pelayanan
      </p>
      <DutyDayBlock day={day} duties={duties} serving={serving} />
    </div>
  );
};
