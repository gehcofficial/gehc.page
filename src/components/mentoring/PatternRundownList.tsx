import React from 'react';
import { normalizeCreativeLabPhases } from '../../lib/creative-lab-rundown';
import { divisionLabel } from '../../lib/worship-patterns';

export type PatternPhase = {
  no?: number;
  title?: string;
  minutes?: number;
  owner?: string;
  division?: string | null;
};

/**
 * Daftar fase rundown pola (read-only) — dipakai di kontrol Didaskalia,
 * Ruang Kontrol (semua divisi), dan expander Jadwal Pelayanan (tuan rumah/PJ).
 * `bare` = tanpa kartu pembungkus (untuk expander yang sudah ber-card).
 */
export const PatternRundownList: React.FC<{
  patternName?: string | null;
  phases?: PatternPhase[] | null;
  bare?: boolean;
}> = ({ patternName, phases, bare }) => {
  const rows = normalizeCreativeLabPhases(Array.isArray(phases) ? phases : []);
  if (!rows.length) return null;
  const list = (
    <ol className="space-y-2">
      {rows.map((p, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-[#EFEDE8] p-3">
          <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] font-black flex items-center justify-center shrink-0">
            {p.no ?? i + 1}
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold">
              {p.title}
              {p.division ? (
                <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 font-bold whitespace-nowrap">
                  {divisionLabel(p.division)}
                </span>
              ) : null}
            </p>
            <p className="text-[11px] text-[#8C8880]">
              {[p.minutes ? `${p.minutes}'` : null, p.owner].filter(Boolean).join(' · ')}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
  if (bare) return <div className="mt-2">{list}</div>;
  return (
    <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
      <p className="text-sm font-black">Rundown pola{patternName ? ` — ${patternName}` : ''}</p>
      <div className="mt-3">{list}</div>
    </div>
  );
};

export default PatternRundownList;
