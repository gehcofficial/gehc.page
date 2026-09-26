import React, { useEffect, useState } from 'react';
import { Search, Mail, Phone } from 'lucide-react';

type Member = {
  id: string;
  name: string;
  avatar?: string | null;
  bipra?: string | null;
  kolomId?: string | null;
  membershipKind?: string;
  memberStatus?: string;
  phone?: string | null;
  email?: string | null;
};

type Kolom = { id: string; number: number; name: string };

const BIPRA_LABEL: Record<string, string> = {
  BAPAK: 'Kaum Bapa',
  IBU: 'Kaum Ibu',
  PEMUDA: 'Pemuda',
  REMAJA: 'Remaja',
  ANAK: 'Anak',
};

/** Daftar anggota unit aktif (dari BIPRA/Kolom). Kontak tampil bila diizinkan server. */
export const UnitMembersPanel: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [koloms, setKoloms] = useState<Kolom[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/church/kolom', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { koloms: [] }))
      .then((d) => setKoloms(Array.isArray(d?.koloms) ? d.koloms : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/unit/members${q ? `?q=${encodeURIComponent(q)}` : ''}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((d) => {
          if (cancelled) return;
          setMembers(Array.isArray(d?.members) ? d.members : []);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const kolomName = (id?: string | null) => koloms.find((k) => k.id === id)?.name || '—';

  return (
    <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide">Anggota Unit</h3>
          <p className="text-[11px] text-[#8C8880]">
            Anggota unit ini (dari BIPRA/Kolom). Kontak hanya tampil untuk pengurus.
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#BDBAB2]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama…"
            className="pl-8 pr-3 py-2 rounded-xl border border-[#D9D7D0] text-xs w-52"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880]">Memuat…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-[#8C8880]">Tidak ada anggota.</p>
      ) : (
        <>
          <p className="text-[10px] text-[#BDBAB2]">{members.length} anggota</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl border border-[#EFEDE8]">
                {m.avatar ? (
                  <img src={m.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#F3F1EC]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{m.name}</p>
                  <p className="text-[10px] text-[#8C8880] truncate">
                    {BIPRA_LABEL[m.bipra || ''] || m.bipra || '—'}
                    {m.kolomId ? ` · Kolom ${kolomName(m.kolomId)}` : ''}
                  </p>
                  {(m.phone || m.email) && (
                    <p className="text-[10px] text-[#8C8880] truncate flex items-center gap-2 mt-0.5">
                      {m.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {m.phone}
                        </span>
                      )}
                      {m.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {m.email}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UnitMembersPanel;
