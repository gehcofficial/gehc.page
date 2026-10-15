import React, { useCallback, useEffect, useState } from 'react';
import { Check, HandHelping, Loader2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import type { SearchableOption } from '../../lib/searchable-options';

/**
 * Bentuk item antrean minimal yang dipakai komponen ini.
 * (Duplikat ringan dari ServiceRoleRequest milik sesi paralel agar file ini
 * mandiri — rekonsiliasi saat types/penatalayan.ts mereka masuk main.)
 */
type QueueItem = {
  id: string;
  date: string;
  roleName?: string | null;
  requesterName?: string | null;
  note?: string | null;
  canFulfill?: boolean;
  canCancel?: boolean;
};

type Props = { division: string };

const dayLabel = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

/**
 * Antrean lowongan role per divisi: koordinator menunjuk nama (→ Dijadwalkan)
 * atau membatalkan. Hanya tampil bila ada yang menunggu.
 */
export const PenatalayanRequestQueue: React.FC<Props> = ({ division }) => {
  const { currentRole } = useApp();
  void currentRole;
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, SearchableOption[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/penatalayan/requests?division=${encodeURIComponent(division)}&status=PENDING`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setItems(d.requests || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const reload = () => void load();
    window.addEventListener('penatalayan:changed', reload);
    return () => window.removeEventListener('penatalayan:changed', reload);
  }, [load]);

  const searchPeople = useCallback(async (q: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/penatalayan/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d: unknown = await r.json().catch(() => ({}));
    const o = (typeof d === 'object' && d !== null ? d : {}) as { people?: unknown; users?: unknown };
    const list = Array.isArray(o.people) ? o.people : Array.isArray(o.users) ? o.users : [];
    return (list as Array<{ id: string; name: string }>).map((p) => ({ value: String(p.id), label: String(p.name) }));
  }, []);

  const act = useCallback(async (id: string, kind: 'fulfill' | 'cancel') => {
    const opts = picks[id] || [];
    if (kind === 'fulfill' && !opts.length) {
      setMsg('Pilih dulu orang yang ditunjuk.');
      return;
    }
    setBusy(`${kind}:${id}`);
    setMsg('');
    try {
      const r = await fetch(`/api/penatalayan/requests/${id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(kind === 'fulfill' ? { userId: opts[0].value } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal memproses.');
      setPicks((p) => { const n = { ...p }; delete n[id]; return n; });
      await load();
      window.dispatchEvent(new Event('penatalayan:changed'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memproses.');
    } finally {
      setBusy(null);
    }
  }, [picks, load]);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <HandHelping className="w-4 h-4 text-sky-700" />
        <h4 className="text-sm font-black text-[#1B1B1B]">Diminta ke Divisi ({items.length})</h4>
      </div>
      {msg && <p className="text-[11px] text-red-600">{msg}</p>}
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="rounded-xl bg-white border border-[#EFEDE8] p-2.5">
            <p className="text-xs font-black text-[#1B1B1B]">
              {it.roleName} <span className="font-normal text-[#8C8880]">· {dayLabel(it.date)}</span>
            </p>
            <p className="text-[11px] text-[#8C8880]">
              Diminta {it.requesterName ? `oleh ${it.requesterName}` : ''}{it.note ? ` — “${it.note}”` : ''}
            </p>
            {it.canFulfill !== false && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                  <SearchableMultiSelect
                    values={(picks[it.id] || []).map((o) => o.value)}
                    selectedOptions={picks[it.id] || []}
                    onSearch={searchPeople}
                    onChange={(_v, opts) => setPicks((p) => ({ ...p, [it.id]: opts.slice(0, 1) }))}
                    max={1}
                    placeholder="Tunjuk orang…"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy === `fulfill:${it.id}`}
                  onClick={() => void act(it.id, 'fulfill')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-50"
                >
                  {busy === `fulfill:${it.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Penuhi
                </button>
                {it.canCancel !== false && (
                  <button
                    type="button"
                    disabled={busy === `cancel:${it.id}`}
                    onClick={() => void act(it.id, 'cancel')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880] disabled:opacity-50"
                  >
                    {busy === `cancel:${it.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Batalkan
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PenatalayanRequestQueue;
