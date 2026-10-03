import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { ServiceDutySections, type DutyPerson } from '../public/DutyPersonChip';

type Duty = {
  date?: string | null;
  role?: string | null;
  division?: string | null;
  name?: string | null;
  avatar?: string | null;
};

type Serving = {
  responsible?: string | null;
  host?: string | null;
  projected?: boolean;
};

/** Kunci hari `YYYY-MM-DD` (WIB) dari eventDate ISO — dipakai memanggil service-schedule. */
export function dayKeyOf(eventDate: string | null | undefined): string | null {
  if (!eventDate) return null;
  const t = new Date(eventDate).getTime();
  if (Number.isNaN(t)) return null;
  // Geser ke WIB lalu ambil tanggalnya.
  const wib = new Date(t + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}

/** Ada konten pelayanan yang layak tampil (tanpa teks admin bila kosong). */
export function hasServingContent(duties: Duty[], serving: Serving): boolean {
  return duties.length > 0 || Boolean(serving.responsible) || Boolean(serving.host);
}

/**
 * Blok "Pelayanan Hari Ini" untuk Info Event: Penanggung Jawab
 * (Liturgia/Didaskalia/Marturia) + Tuan Rumah (Koinonia/Diakonia dari role
 * yang di-assign) — sumber endpoint publik service-schedule
 * (hanya CONFIRMED/DONE, tanpa email). Kosong → tidak render apa-apa.
 */
export const EventServiceDutyCard: React.FC<{ eventDate?: string | null }> = ({ eventDate }) => {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [serving, setServing] = useState<Serving>({});

  const day = dayKeyOf(eventDate);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    fetch(`/api/db/service-schedule?from=${day}&to=${day}`)
      .then((r) => (r.ok ? r.json() : { duties: [], serving: {} }))
      .then((d) => {
        if (cancelled) return;
        setDuties(((d.duties || []) as Duty[]).filter((x) => String(x.date || '').slice(0, 10) === day));
        setServing(((d.serving || {})[day] || {}) as Serving);
      })
      .catch(() => { if (!cancelled) { setDuties([]); setServing({}); } });
    return () => { cancelled = true; };
  }, [day]);

  if (!day || !hasServingContent(duties, serving)) return null;

  const officers: DutyPerson[] = duties.map((d) => ({
    name: String(d.name || '—'), avatar: d.avatar, role: d.role, division: d.division,
  }));

  return (
    <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-brand flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> Pelayanan Hari Ini
      </p>
      <ServiceDutySections duties={officers} responsible={serving.responsible} host={serving.host} projected={serving.projected} />
    </div>
  );
};
