import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Users, Landmark } from 'lucide-react';
import { displayAvatar } from '../../lib/avatar';

type Member = { id: string; name: string; position?: string | null; subdivision?: string | null; division?: string | null; photoUrl?: string | null; isOpenRole?: boolean; role?: string | null };
type Unit = {
  code: string; label: string; labelEn: string; tagline: string; icon: string;
  subdivisions: string[]; positions: string[]; members: Member[];
};

/** Unit & Struktur Jemaat — BPMJ + 4 unit pelayanan (Info & read untuk anggota unit). */
export const ChurchOrgPanel: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/church/org', { credentials: 'include' });
      const d = r.ok ? await r.json() : { units: [] };
      setUnits(d.units || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat struktur jemaat…</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[#0EA5E9]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Unit & Struktur Jemaat</h3>
          <span className="text-[10px] text-[#8C8880]">BPMJ + unit pelayanan (di luar Pelsis BIPRA &amp; Kolom)</span>
        </div>
      </div>

      {units.map((u) => (
        <section key={u.code} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg leading-none" aria-hidden>{u.icon}</span>
            <h4 className="text-sm font-black text-[#1B1B1B]">{u.label}</h4>
            <span className="text-[10px] text-[#8C8880]">{u.labelEn}</span>
            <span className="ml-auto text-[10px] font-bold text-[#8C8880]">{u.members.filter((m) => !m.isOpenRole).length} pengurus</span>
          </div>
          <p className="text-xs text-[#5C5850]">{u.tagline}</p>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1.5">Sub-divisi</p>
              <div className="flex flex-wrap gap-1.5">
                {u.subdivisions.map((s) => <span key={s} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#D9D7D0]">{s}</span>)}
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1.5">Posisi</p>
              <div className="flex flex-wrap gap-1.5">
                {u.positions.map((p) => <span key={p} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#D9D7D0]">{p}</span>)}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1.5 flex items-center gap-1"><Users className="w-3 h-3" /> Pengurus &amp; Anggota</p>
            {u.members.length === 0 ? (
              <p className="text-[11px] text-[#8C8880] italic">Belum ada data anggota untuk unit ini.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-1.5">
                {u.members.map((m) => (
                  <li key={m.id} className={`flex items-center gap-2 p-2 rounded-xl bg-[#FAF9F5] ${m.isOpenRole ? 'opacity-70' : ''}`}>
                    {m.isOpenRole
                      ? <span className="w-7 h-7 rounded-full bg-white border border-dashed border-[#C9C7C0] flex items-center justify-center text-[11px] text-[#8C8880]">+</span>
                      : <img src={displayAvatar(m.name, m.photoUrl)} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1B1B1B] truncate">{m.name}</p>
                      <p className="text-[10px] text-[#8C8880] truncate">
                        {m.position || '—'}{m.subdivision ? ` · ${m.subdivision}` : ''}
                        {m.isOpenRole ? ' · posisi terbuka' : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
};

export default ChurchOrgPanel;
