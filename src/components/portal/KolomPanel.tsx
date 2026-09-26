import React, { useEffect, useState } from 'react';
import { Plus, Save, MapPin, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Kolom = { id: string; number: number; name: string; area?: string | null; memberCount?: number };
type Member = { id: string; name: string; bipra?: string | null };

const EDIT_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI'];

/** Kelola Kolom teritorial + lihat anggotanya. */
export const KolomPanel: React.FC = () => {
  const { currentRole, addToast } = useApp();
  const canEdit = EDIT_ROLES.includes(currentRole);
  const [koloms, setKoloms] = useState<Kolom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState<{ number: string; name: string; area: string }>({ number: '', name: '', area: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch('/api/church/kolom', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { koloms: [] }))
      .then((d) => {
        const list: Kolom[] = Array.isArray(d?.koloms) ? d.koloms : [];
        setKoloms(list);
        setLoading(false);
        if (!activeId && list[0]) setActiveId(list[0].id);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/church/kolom/${encodeURIComponent(activeId)}/members`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers(Array.isArray(d?.members) ? d.members : []))
      .catch(() => setMembers([]));
  }, [activeId]);

  const add = async () => {
    const number = Number(draft.number);
    if (!Number.isInteger(number) || number < 1 || !draft.name.trim()) {
      addToast({ type: 'error', title: 'Isi nomor & nama kolom' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/church/kolom', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, name: draft.name.trim(), area: draft.area.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setDraft({ number: '', name: '', area: '' });
      load();
      addToast({ type: 'success', title: 'Kolom ditambahkan' });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal menambah kolom', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const active = koloms.find((k) => k.id === activeId);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide">Kolom &amp; Wilayah</h3>
          <p className="text-[11px] text-[#8C8880]">Kolom teritorial (campur BIPRA). Anggota diambil dari data jemaat.</p>
        </div>

        {loading ? (
          <p className="text-xs text-[#8C8880]">Memuat…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {koloms.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setActiveId(k.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  activeId === k.id ? 'bg-[#181818] text-white border-[#181818]' : 'bg-[#F3F1EC] text-[#1B1B1B] border-transparent'
                }`}
              >
                {k.number}. {k.name} <span className="opacity-60">({k.memberCount ?? 0})</span>
              </button>
            ))}
            {koloms.length === 0 && <p className="text-xs text-[#8C8880]">Belum ada kolom.</p>}
          </div>
        )}

        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-[90px_1fr_1fr_auto] gap-2 items-center pt-2 border-t border-[#EFEDE8]">
            <input
              value={draft.number}
              onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="No."
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            />
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Nama Kolom"
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            />
            <input
              value={draft.area}
              onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))}
              placeholder="Area/wilayah (opsional)"
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            />
            <button
              type="button"
              onClick={add}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#181818] text-white text-xs font-bold disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>
        )}
      </div>

      {active && (
        <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#FF416C]" />
            <h4 className="text-xs font-black uppercase tracking-wide">
              Kolom {active.number} · {active.name}
            </h4>
            <span className="text-[10px] text-[#8C8880] inline-flex items-center gap-1">
              <Users className="w-3 h-3" /> {members.length}
            </span>
          </div>
          {active.area && <p className="text-[11px] text-[#8C8880]">{active.area}</p>}
          {members.length === 0 ? (
            <p className="text-xs text-[#8C8880]">Belum ada anggota di kolom ini.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 rounded-2xl border border-[#EFEDE8]">
                  <span className="text-xs font-bold truncate">{m.name}</span>
                  <span className="text-[10px] text-[#8C8880]">{m.bipra || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KolomPanel;
