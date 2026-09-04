import React, { useEffect, useMemo, useState } from 'react';
import { ChurchYearCalendarPanel } from './ChurchYearCalendarPanel';

type Layers = {
  sinode?: { id: string; startDate: string; name: string }[];
  jemaat?: { id: string; startDate: string; name: string }[];
  liturgis?: { id: string; startDate: string; name: string }[];
  timKerja?: { id: string; startDate: string; name: string }[];
  kelompok?: { id: string; startDate: string; name: string }[];
};

const LAYER_KEYS = [
  { id: 'sinode', label: 'Sinode' },
  { id: 'jemaat', label: 'Jemaat' },
  { id: 'liturgis', label: 'Liturgis' },
  { id: 'timKerja', label: 'Tim Kerja' },
  { id: 'kelompok', label: 'Kelompok' },
] as const;

export const YouthCalendarPanel: React.FC<{
  compact?: boolean;
  onPromote?: (payload: { name: string; startDate: string }) => void;
}> = ({ compact, onPromote }) => {
  const [layers, setLayers] = useState<Layers>({});
  const [on, setOn] = useState<Record<string, boolean>>({
    sinode: true,
    jemaat: true,
    liturgis: true,
    timKerja: true,
    kelompok: true,
  });
  const year = new Date().getFullYear();

  useEffect(() => {
    fetch(`/api/portal/calendar?year=${year}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLayers(d.layers || {}))
      .catch(() => setLayers({}));
  }, [year]);

  const extra = useMemo(() => {
    const rows: { date: string; name: string; tag: string }[] = [];
    for (const key of LAYER_KEYS) {
      if (!on[key.id]) continue;
      for (const e of layers[key.id] || []) {
        if (e.startDate) rows.push({ date: e.startDate, name: e.name, tag: key.label });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, compact ? 8 : 24);
  }, [layers, on, compact]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LAYER_KEYS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setOn((s) => ({ ...s, [k.id]: !s[k.id] }))}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              on[k.id] ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880]'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {extra.length > 0 && (
        <ul className="text-xs space-y-1">
          {extra.map((e) => (
            <li key={`${e.tag}-${e.date}-${e.name}`} className="flex gap-2">
              <span className="text-[#8C8880] w-24 shrink-0">{e.date}</span>
              <span className="font-bold text-[#EA580C] w-16 shrink-0">{e.tag}</span>
              <span>{e.name}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && <ChurchYearCalendarPanel onPromote={onPromote} />}
    </div>
  );
};
