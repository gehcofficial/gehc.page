import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Loader2, MonitorPlay, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  KIND_LABEL, LivePayload, OrderKind, PatternLite,
  patternSegments, skeletonFromPattern,
} from '../../lib/liturgy-live';
import { rememberPortalPlace } from '../../lib/portal-place';

type SetSong = { id: string; moment?: string | null; song?: { id: string; title: string; sourceRef?: string | null } | null };
type OrderRow = {
  id: string; sortOrder: number; kind: string; serviceSongId?: string | null;
  segmentKey?: string | null; phaseNo?: number | null;
  title?: string | null; body?: string | null; owner?: string | null; minutes?: number | null; note?: string | null;
  serviceSong?: SetSong | null;
  display?: { kind?: string; title?: string; auto?: boolean; hasLyrics?: boolean; body?: string } | null;
};

type WeekPattern = { code: string; name: string; defaultDurationMin?: number | null; phases?: PatternLite['phases'] };

const KINDS: OrderKind[] = ['lagu', 'bacaan', 'doa', 'firman', 'persembahan', 'pengumuman', 'mc'];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

/**
 * Panel Tata Ibadah — susunan momen per event (milik Liturgia, tab Ibadah).
 * Kerangka segmen mengikuti pola Didaskalia pekan ini (baca-saja);
 * Liturgia mengisi lagu per slot + momen kustom. Segmen firman auto-sync
 * perikop Studio (fallback teks manual).
 */
export const LiturgyOrderPanel: React.FC<{
  eventId: string; eventSlug?: string | null; yearMonth?: string | null; weekIndex?: number | null;
}> = ({ eventId, eventSlug, yearMonth, weekIndex }) => {
  const { addToast } = useApp();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [songs, setSongs] = useState<SetSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [pattern, setPattern] = useState<WeekPattern | null>(null);
  const [patternCode, setPatternCode] = useState('');
  const [showPattern, setShowPattern] = useState(false);
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
      if (yearMonth && weekIndex) {
        try {
          const [w, p] = await Promise.all([
            api<{ week?: { patternCode?: string } }>(`/api/didaskalia/studio/${yearMonth}/${weekIndex}`),
            api<{ patterns?: WeekPattern[] }>('/api/worship/patterns'),
          ]);
          const code = String(w.week?.patternCode || 'MONOLOG').toUpperCase();
          setPatternCode(code);
          setPattern((p.patterns || []).find((x) => String(x.code || '').toUpperCase() === code) || null);
        } catch {
          /* referensi pola opsional — composer tetap jalan */
        }
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal muat tata ibadah', description: e instanceof Error ? e.message : '' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, yearMonth, weekIndex, addToast]);

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

  const skeleton = useMemo(() => (pattern ? skeletonFromPattern(pattern) : []), [pattern]);
  const emptySlots = useMemo(
    () => items.filter((i) => i.kind === 'lagu' && !i.serviceSongId).length,
    [items],
  );

  const buildSkeleton = () => {
    if (!skeleton.length) return;
    if (items.length && !window.confirm(`Tambah ${skeleton.length} momen kerangka pola di akhir susunan?`)) return;
    void mutate(
      () =>
        api(`/api/events/${eventId}/order/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: skeleton }),
        }),
      `Kerangka ${patternCode} ditambahkan`,
    );
  };

  const fillSlot = (itemId: string, serviceSongId: string) => {
    if (!serviceSongId) return;
    void mutate(
      () =>
        api(`/api/events/${eventId}/order/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceSongId }),
        }),
      'Lagu slot diisi',
    );
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

      {pattern && (
        <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-sky-900">
              Rundown pola: {pattern.name || patternCode}
            </span>
            <span className="text-[10px] text-sky-700">
              {pattern.defaultDurationMin ? `${pattern.defaultDurationMin}′ baku` : ''} · panduan baca-saja
            </span>
            <span className="flex-1" />
            <button type="button" onClick={() => setShowPattern((v) => !v)} className={btnGhost}>
              {showPattern ? 'Sembunyikan' : 'Lihat fase'}
            </button>
            {!!skeleton.length && (
              <button
                type="button"
                onClick={buildSkeleton}
                disabled={saving}
                title="Buat momen kerangka (slot lagu kosong + firman auto) di akhir susunan"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700 text-white text-xs font-bold disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Bangun kerangka ({skeleton.length})
              </button>
            )}
          </div>
          {showPattern && (
            <ol className="space-y-1">
              {(pattern.phases || []).map((f, i) => (
                <li key={i} className="text-[11px] text-sky-900">
                  <strong>{f.no || i + 1}. {f.title}</strong>
                  {f.minutes ? <span className="text-sky-700"> · {f.minutes}′</span> : null}
                  {f.owner ? <span className="text-sky-700"> · {f.owner}</span> : null}
                  {f.notes ? <span className="block text-sky-700/80">{f.notes}</span> : null}
                </li>
              ))}
            </ol>
          )}
          {!!emptySlots && (
            <p className="text-[11px] font-bold text-amber-700">
              {emptySlots} slot lagu belum diisi — pilih lagu per slot di bawah.
            </p>
          )}
        </div>
      )}

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
                  {it.kind === 'firman' && it.display && (
                    <span className="ml-1.5 px-1.5 py-px rounded-full text-[9px] font-black align-middle bg-sky-100 text-sky-800">
                      {it.display.auto ? 'auto-sync' : 'manual'}
                    </span>
                  )}
                  {it.segmentKey && (
                    <span className="ml-1.5 text-[9px] font-bold text-[#8C8880] align-middle">§{it.segmentKey}</span>
                  )}
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
      {items.some((i) => i.kind === 'lagu' && !i.serviceSongId) && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <p className="text-[11px] font-black text-amber-800">Slot lagu kosong — pilih lagu setlist:</p>
          {items.filter((i) => i.kind === 'lagu' && !i.serviceSongId).map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#1B1B1B] truncate" style={{ maxWidth: 140 }}>
                {it.title || it.segmentKey || 'Lagu'}
              </span>
              <select
                className={inputCls}
                defaultValue=""
                disabled={saving || !songs.length}
                onChange={(e) => fillSlot(it.id, e.target.value)}
              >
                <option value="">Pilih lagu…</option>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>{s.song?.title || s.id}{s.song?.sourceRef ? ` (${s.song.sourceRef})` : ''}</option>
                ))}
              </select>
            </div>
          ))}
          {!songs.length && <p className="text-[11px] text-amber-700">Setlist masih kosong — tambah lagu dulu di kartu Lagu Ibadah.</p>}
        </div>
      )}
    </div>
  );
};
