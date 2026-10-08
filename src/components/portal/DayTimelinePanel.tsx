import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Copy, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type DayItem = {
  id: string; sortOrder: number; kind: string; eventId?: string | null;
  title?: string | null; body?: string | null; owner?: string | null;
  minutes?: number | null; note?: string | null;
  event?: {
    id: string; name: string; slug?: string | null; eventDate?: string | null;
    status?: string | null; orderCount?: number | null; liveStatus?: string | null;
  } | null;
};

type ChurchEvent = { id: string; name: string; slug?: string | null; eventDate?: string | null };

const KINDS = [
  { id: 'ibadah-block', label: 'Ibadah (blok)' },
  { id: 'pengumuman', label: 'Pengumuman' },
  { id: 'selebrasi', label: 'Selebrasi / HUT' },
  { id: 'makan', label: 'Makan bersama' },
  { id: 'games', label: 'Games / kebersamaan' },
  { id: 'sambutan', label: 'Sambutan' },
  { id: 'lainnya', label: 'Lainnya' },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.label]));

function todayWib(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

/**
 * Panel Timeline Hari — susunan blok acara sehari milik Koinonia.
 * Blok ibadah menunjuk event (detail lagu di tab Liturgia); blok lain
 * (pengumuman/selebrasi/makan/games) diisi langsung di sini.
 */
export const DayTimelinePanel: React.FC<{ initialDay?: string | null }> = ({ initialDay }) => {
  const { addToast } = useApp();
  const [day, setDay] = useState(() => initialDay || todayWib());
  const [items, setItems] = useState<DayItem[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kind: 'pengumuman', eventId: '', title: '', body: '', owner: '', minutes: '' });

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const [t, e] = await Promise.all([
        api<{ items: DayItem[] }>(`/api/day-timeline?day=${encodeURIComponent(d)}`),
        api<{ events?: ChurchEvent[] } | ChurchEvent[]>('/api/events').catch(() => ({ events: [] })),
      ]);
      setItems(t.items || []);
      const list = Array.isArray(e) ? e : e.events || [];
      setEvents(list);
      if (!form.eventId && list.length) setForm((f) => ({ ...f, eventId: list[0].id }));
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal muat timeline', description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast]);

  useEffect(() => {
    void load(day);
  }, [day, load]);

  const mutate = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try {
      await fn();
      await load(day);
      addToast({ type: 'success', title: ok });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const add = () =>
    mutate(
      () =>
        api('/api/day-timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day,
            kind: form.kind,
            eventId: form.kind === 'ibadah-block' ? form.eventId || null : null,
            title: form.title || null,
            body: form.body || null,
            owner: form.owner || null,
            minutes: form.minutes ? Number(form.minutes) : null,
          }),
        }),
      'Blok ditambahkan',
    );

  const move = (id: string, dir: -1 | 1) => {
    const order = items.map((i) => i.id);
    const idx = order.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    void mutate(
      () =>
        api('/api/day-timeline/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day, orderedIds: order }),
        }),
      'Urutan diperbarui',
    );
  };

  const copy = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url);
    addToast({ type: 'success', title: `${label} disalin` });
  };

  const btnGhost =
    'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]';
  const inputCls =
    'w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-xs text-[#1B1B1B] focus:outline-none focus:border-black';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="p-4 rounded-2xl bg-white border border-[#D9D7D0] space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#1B1B1B]">
          <CalendarDays className="w-4 h-4" /> Timeline Hari
        </span>
        <input
          type="date"
          className={inputCls}
          style={{ maxWidth: 160 }}
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <span className="text-[11px] text-[#8C8880]">{items.length} blok · ibadah + pengumuman + selebrasi</span>
      </div>

      <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] grid gap-2 md:grid-cols-3">
        <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        {form.kind === 'ibadah-block' ? (
          <select className={`${inputCls} md:col-span-2`} value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            {!events.length && <option value="">— belum ada event —</option>}
          </select>
        ) : (
          <>
            <input className={inputCls} placeholder="Judul blok" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className={inputCls} placeholder="PIC (opsional)" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            <textarea className={`${inputCls} md:col-span-2`} rows={2} placeholder="Isi pengumuman / rundown selebrasi…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <input className={inputCls} placeholder="Menit" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </>
        )}
        <div className="md:col-span-3">
          <button type="button" onClick={add} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah blok
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat timeline…</p>
      ) : !items.length ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada blok hari ini — tambah blok ibadah + pengumuman/selebrasi di atas.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, idx) => (
            <li key={it.id} className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1B1B1B] text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#1B1B1B] truncate">
                  [{KIND_LABEL[it.kind] || it.kind}] {it.kind === 'ibadah-block' ? it.event?.name || it.title || '—' : it.title || '—'}
                </p>
                <p className="text-[10px] text-[#8C8880] truncate">
                  {[
                    it.owner,
                    it.minutes ? `${it.minutes} mnt` : null,
                    it.kind === 'ibadah-block' && it.event
                      ? `${it.event.orderCount ?? 0} momen${it.event.liveStatus ? ` · ${it.event.liveStatus}` : ''}`
                      : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              {it.kind === 'ibadah-block' && it.event?.slug && (
                <button
                  type="button"
                  title="Salin link layar ibadah"
                  onClick={() => copy(`${origin}/#/ibadah/${encodeURIComponent(it.event?.slug || it.eventId || '')}/layar`, 'Link layar')}
                  className={btnGhost}
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
              <button type="button" title="Naik" onClick={() => move(it.id, -1)} className={btnGhost}><ArrowUp className="w-3 h-3" /></button>
              <button type="button" title="Turun" onClick={() => move(it.id, 1)} className={btnGhost}><ArrowDown className="w-3 h-3" /></button>
              <button
                type="button"
                title="Hapus blok"
                onClick={() => {
                  if (!window.confirm('Hapus blok ini dari timeline?')) return;
                  void mutate(() => api(`/api/day-timeline/${it.id}`, { method: 'DELETE' }), 'Blok dihapus');
                }}
                className={btnGhost}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default DayTimelinePanel;
