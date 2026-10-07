import React, { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, Circle, Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Shot = {
  id: string;
  eventId: string;
  item: string;
  sortOrder: number;
  done: boolean;
  assigneeId?: string | null;
};

/**
 * Tab Liputan Marturia — shotlist checklist + penanggung jawab + penghitung live.
 * Struktur Drive: Dokumentasi Visual / Foto · Berkas · Arsip Acara.
 */
export const MarturiaLiputanTab: React.FC<{ eventId: string; eventName?: string }> = ({ eventId, eventName }) => {
  const { addToast } = useApp();
  const [items, setItems] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [photoCount, setPhotoCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/shotlist`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch(`/api/gallery?eventId=${encodeURIComponent(eventId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      ]);
      setItems(s.items || []);
      setPhotoCount(Array.isArray(g.items) ? g.items.length : null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/shotlist/seed`, { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal membuat shotlist');
      addToast({ type: 'success', title: d.seeded ? `${d.seeded} shot dibuat` : 'Shotlist sudah ada' });
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally {
      setSeeding(false);
    }
  };

  const toggle = async (shot: Shot) => {
    const r = await fetch(`/api/marturia/shotlist/${shot.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !shot.done }),
    });
    if (r.ok) await load();
  };

  const assign = async (shot: Shot, assigneeId: string) => {
    const r = await fetch(`/api/marturia/shotlist/${shot.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    });
    if (r.ok) await load();
  };

  const add = async () => {
    const item = newItem.trim();
    if (!item) return;
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/shotlist`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    });
    if (r.ok) { setNewItem(''); await load(); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Hapus shot ini?')) return;
    await fetch(`/api/marturia/shotlist/${id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  };

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat liputan…</p>;
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Camera className="w-4 h-4 text-[#DC2626]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Liputan · Dokumentasi Visual</h3>
          <span className="text-[11px] font-bold text-[#8C8880]">{eventName}</span>
          <span className="ml-auto text-[11px] font-bold text-[#1B1B1B] bg-[#FAF9F5] border border-[#D9D7D0] rounded-full px-2.5 py-1">
            {done}/{items.length} shot{photoCount !== null ? ` · ${photoCount} foto masuk` : ''}
          </span>
        </div>
        <p className="text-[11px] text-[#8C8880] mt-1">Brief shotlist H-3, assign fotografer per shot, centang live saat H+0.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold text-[#1B1B1B]">Belum ada shotlist untuk event ini.</p>
          <p className="text-xs text-[#8C8880] mt-1">Mulai dari template 6 shot standar, lalu sesuaikan.</p>
          <button type="button" onClick={() => void seed()} disabled={seeding} className="mt-3 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">
            {seeding ? 'Membuat…' : 'Buat dari template'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${s.done ? 'border-emerald-200' : 'border-[#D9D7D0]/60'}`}>
              <button type="button" onClick={() => void toggle(s)} title={s.done ? 'Batalkan centang' : 'Tandai selesai'}>
                {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5 text-[#D9D7D0]" />}
              </button>
              <p className={`flex-1 text-xs font-bold ${s.done ? 'text-[#8C8880] line-through' : 'text-[#1B1B1B]'}`}>{s.item}</p>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[#8C8880]">
                <UserPlus className="w-3 h-3" />
                <input
                  defaultValue={s.assigneeId || ''}
                  placeholder="Fotografer…"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.assigneeId || '')) void assign(s, v); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-28 px-2 py-1 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] focus:outline-none focus:border-black"
                />
              </span>
              <button type="button" onClick={() => void remove(s.id)} className="p-1.5 rounded-lg text-[#8C8880] hover:text-red-500" title="Hapus">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
              placeholder="Tambah shot khusus event ini… (Enter)"
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs focus:outline-none focus:border-black"
            />
            <button type="button" onClick={() => void add()} disabled={!newItem.trim()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
