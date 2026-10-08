import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Loader2, MonitorPlay, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KIND_LABEL, LivePayload, OrderKind } from '../../lib/liturgy-live';
import { rememberPortalPlace } from '../../lib/portal-place';

type SetSong = { id: string; moment?: string | null; song?: { id: string; title: string; sourceRef?: string | null } | null };
type OrderRow = {
  id: string; sortOrder: number; kind: string; serviceSongId?: string | null;
  title?: string | null; body?: string | null; owner?: string | null; minutes?: number | null; note?: string | null;
  serviceSong?: SetSong | null;
};

const KINDS: OrderKind[] = ['lagu', 'bacaan', 'doa', 'firman', 'persembahan', 'pengumuman', 'mc'];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

/**
 * Panel Tata Ibadah — susunan momen per event (milik Liturgia, tab Ibadah).
 * Lagu menunjuk setlist; momen lain membawa teks sendiri.
 */
export const LiturgyOrderPanel: React.FC<{ eventId: string; eventSlug?: string | null }> = ({ eventId, eventSlug }) => {
  const { addToast } = useApp();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [songs, setSongs] = useState<SetSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [form, setForm] = useState({ kind: 'lagu' as string, serviceSongId: '', title: '', body: '', owner: '', minutes: '' });

  const key = eventSlug || eventId;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const screenUrl = `${origin}/#/ibadah/${encodeURIComponent(key)}/layar`;
  const controlUrl = `${origin}/#/ibadah/${encodeURIComponent(key)}/kontrol`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s, l] = await Promise.all([
        api<{ items: OrderRow[] }>(`/api/events/${eventId}/order`),
        api<{ items: SetSong[] }>(`/api/events/${eventId}/songs`),
        api<LivePayload>(`/api/events/${eventId}/liturgy-live`).catch(() => null),
      ]);
      setItems(o.items || []);
      setSongs(s.items || []);
      setLiveStatus(l?.state?.status || '');
      if (!form.serviceSongId && s.items?.length) setForm((f) => ({ ...f, serviceSongId: s.items[0].id }));
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal muat tata ibadah', description: e instanceof Error ? e.message : '' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try {
      await fn();
      await load();
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
        api(`/api/events/${eventId}/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: form.kind,
            serviceSongId: form.kind === 'lagu' ? form.serviceSongId || null : null,
            title: form.title || null,
            body: form.body || null,
            owner: form.owner || null,
            minutes: form.minutes ? Number(form.minutes) : null,
          }),
        }),
      'Momen ditambahkan',
    );

  const move = (id: string, dir: -1 | 1) => {
    const order = items.map((i) => i.id);
    const idx = order.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    void mutate(
      () =>
        api(`/api/events/${eventId}/order/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: order }),
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

  return (
    <div className="p-4 rounded-2xl bg-white border border-[#D9D7D0] space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#1B1B1B]">
          <MonitorPlay className="w-4 h-4" /> Tata Ibadah
        </span>
        <span className="text-[11px] text-[#8C8880]">{items.length} momen · tampil di layar + HP jemaat</span>
        {liveStatus && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#1B1B1B] text-white">{liveStatus}</span>}
        <span className="flex-1" />
        <button type="button" onClick={() => copy(screenUrl, 'Link layar')} className={btnGhost} title={screenUrl}>
          <Copy className="w-3 h-3" /> Link layar
        </button>
        <a
          href={`#/ibadah/${encodeURIComponent(key)}/kontrol`}
          onClick={() => rememberPortalPlace()}
          className={btnGhost}
          title={controlUrl}
        >
          <ExternalLink className="w-3 h-3" /> Kontrol live
        </a>
      </div>

      <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] grid gap-2 md:grid-cols-3">
        <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        {form.kind === 'lagu' ? (
          <select className={`${inputCls} md:col-span-2`} value={form.serviceSongId} onChange={(e) => setForm({ ...form, serviceSongId: e.target.value })}>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>{s.song?.title || s.id}{s.song?.sourceRef ? ` (${s.song.sourceRef})` : ''}</option>
            ))}
            {!songs.length && <option value="">— belum ada lagu di setlist —</option>}
          </select>
        ) : (
          <>
            <input className={inputCls} placeholder="Judul momen" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className={inputCls} placeholder="Petugas (opsional)" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            <textarea className={`${inputCls} md:col-span-2`} rows={2} placeholder="Teks bacaan/doa/pengumuman…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <input className={inputCls} placeholder="Menit" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </>
        )}
        <div className="md:col-span-3">
          <button type="button" onClick={add} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah momen
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat susunan…</p>
      ) : !items.length ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada susunan — tambah momen pertama di atas (lagu diambil dari setlist).</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, idx) => (
            <li key={it.id} className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1B1B1B] text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#1B1B1B] truncate">
                  [{KIND_LABEL[it.kind] || it.kind}] {it.serviceSong?.song?.title || it.title || '—'}
                </p>
                <p className="text-[10px] text-[#8C8880] truncate">
                  {[it.owner, it.minutes ? `${it.minutes} mnt` : null, it.serviceSong?.moment].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" title="Naik" onClick={() => move(it.id, -1)} className={btnGhost}><ArrowUp className="w-3 h-3" /></button>
              <button type="button" title="Turun" onClick={() => move(it.id, 1)} className={btnGhost}><ArrowDown className="w-3 h-3" /></button>
              <button
                type="button"
                title="Hapus momen"
                onClick={() => {
                  if (!window.confirm('Hapus momen ini dari tata ibadah?')) return;
                  void mutate(() => api(`/api/events/${eventId}/order/${it.id}`, { method: 'DELETE' }), 'Momen dihapus');
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
