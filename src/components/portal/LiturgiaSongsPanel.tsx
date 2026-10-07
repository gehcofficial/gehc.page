import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Loader2, Music, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  buildQuickLyrics,
  parseSections,
  renderSelectedSections,
  stripChords,
  transposeChordPro,
} from '../../lib/song-chords';

/**
 * Panel Lagu Ibadah Liturgia — setlist per event + pustaka lintas-unit.
 * Dipasang di tab `ibadah` DivisionWorkspacePanel khusus LITURGIA.
 * ChordPro = kanonis; transpose/capo/bagian tersimpan per setlist,
 * master pustaka tidak diubah. Ekspor siap FreeShow (.show/ChordPro).
 */

type Song = {
  id: string;
  title: string;
  source: string;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  authors?: string | null;
  copyright?: string | null;
  ccli?: string | null;
  defaultKey?: string | null;
  lyricsChordPro?: string | null;
  sections: string[];
};

type SetItem = {
  id: string;
  songId: string;
  sortOrder: number;
  sections?: string[] | null;
  baseKey?: string | null;
  transpose: number;
  capo?: number | null;
  moment?: string | null;
  note?: string | null;
  song?: Song | null;
};

const SOURCES = [
  { id: '', label: 'Semua sumber' },
  { id: 'HIMNE_KJ', label: 'KJ' },
  { id: 'HIMNE_NKB', label: 'NKB' },
  { id: 'HIMNE_NNBT', label: 'NNBT' },
  { id: 'HIMNE_PKJ', label: 'PKJ' },
  { id: 'KLIK', label: 'KLIK' },
  { id: 'KONTEMPORER', label: 'Kontemporer' },
  { id: 'LOKAL', label: 'Lokal' },
  { id: 'SEKULER', label: 'Sekuler' },
];

const SOURCE_LABEL: Record<string, string> = {
  HIMNE_KJ: 'KJ',
  HIMNE_NKB: 'NKB',
  HIMNE_NNBT: 'NNBT',
  HIMNE_PKJ: 'PKJ',
  KLIK: 'KLIK',
  KONTEMPORER: 'Kontemporer',
  LOKAL: 'Lokal',
  SEKULER: 'Sekuler',
};

const MOMENTS = ['pembuka', 'firman', 'persembahan', 'penutup', 'bedah-lagu', 'bebas'];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-xs text-[#1B1B1B] focus:outline-none focus:border-black';
const btnDark =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50';
const btnGhost =
  'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]';

export const LiturgiaSongsPanel: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast } = useApp();
  const [items, setItems] = useState<SetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [lib, setLib] = useState<Song[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showLib, setShowLib] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'chord' | 'lirik'>('chord');
  const [form, setForm] = useState({
    title: '',
    source: 'LOKAL',
    sourceRef: '',
    sourceUrl: '',
    authors: '',
    copyright: '',
    ccli: '',
    defaultKey: '',
    lyricsChordPro: '[Verse 1]\n[C]Tulis lirik di sini [G]...\n\n[Chorus]\n[F]... [C]...',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ items: SetItem[] }>(`/api/events/${eventId}/songs`);
      setItems(d.items || []);
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal muat setlist', description: e instanceof Error ? e.message : '' });
    } finally {
      setLoading(false);
    }
  }, [eventId, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchLib = useCallback(async () => {
    setLibLoading(true);
    try {
      const d = await api<{ songs: Song[] }>(
        `/api/songs?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}&limit=50`,
      );
      setLib(d.songs || []);
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal cari pustaka', description: e instanceof Error ? e.message : '' });
    } finally {
      setLibLoading(false);
    }
  }, [q, source, addToast]);

  useEffect(() => {
    if (showLib) void searchLib();
  }, [showLib, searchLib]);

  const openItem = useMemo(() => items.find((i) => i.id === openId) || null, [items, openId]);

  const preview = useMemo(() => {
    if (!openItem?.song) return '';
    const body = renderSelectedSections(openItem.song.lyricsChordPro || '', openItem.sections ?? null);
    const t = transposeChordPro(body, openItem.transpose || 0);
    return view === 'lirik' ? stripChords(t) : t;
  }, [openItem, view]);

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

  const addSong = (songId: string) =>
    mutate(
      () =>
        api(`/api/events/${eventId}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId }),
        }),
      'Lagu masuk setlist',
    );

  const patchItem = (id: string, body: Record<string, unknown>, ok = 'Tersimpan') =>
    mutate(
      () =>
        api(`/api/events/${eventId}/songs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ok,
    );

  const move = async (id: string, dir: -1 | 1) => {
    const order = items.map((i) => i.id);
    const idx = order.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    await mutate(
      () =>
        api(`/api/events/${eventId}/songs/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: order }),
        }),
      'Urutan diperbarui',
    );
  };

  const createSong = async () => {
    if (!form.title.trim()) {
      addToast({ type: 'error', title: 'Judul lagu wajib' });
      return;
    }
    setSaving(true);
    try {
      const d = await api<{ song: Song }>('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sourceRef: form.sourceRef || null, defaultKey: form.defaultKey || null }),
      });
      setShowCreate(false);
      setForm({ ...form, title: '', sourceRef: '', lyricsChordPro: '' });
      await searchLib();
      if (d.song?.id) await addSong(d.song.id);
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal simpan lagu', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-white border border-[#D9D7D0] space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#1B1B1B]">
          <Music className="w-4 h-4" /> Lagu Ibadah
        </span>
        <span className="text-[11px] text-[#8C8880]">{items.length} lagu · pustaka lintas-unit · chord + transpose</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setShowLib((v) => !v)} className={btnGhost}>
          <Search className="w-3 h-3" /> {showLib ? 'Tutup pustaka' : 'Cari pustaka'}
        </button>
        <button type="button" onClick={() => setShowCreate((v) => !v)} className={btnGhost}>
          <Plus className="w-3 h-3" /> Lagu baru
        </button>
        <a href={`/api/events/${eventId}/songs/export`} target="_blank" rel="noreferrer" className={btnGhost} title="Payload FreeShow API-ready (JSON)">
          <Download className="w-3 h-3" /> Ekspor JSON
        </a>
      </div>

      {showCreate && (
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] grid gap-2 md:grid-cols-2">
          <input className={inputCls} placeholder="Judul lagu *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex gap-2">
            <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="HIMNE_KJ">Himne KJ</option>
              <option value="HIMNE_NKB">Himne NKB</option>
              <option value="HIMNE_NNBT">Himne NNBT (GMIM)</option>
              <option value="HIMNE_PKJ">Himne PKJ</option>
              <option value="KLIK">KLIK (GMIM)</option>
              <option value="KONTEMPORER">Kontemporer</option>
              <option value="LOKAL">Lokal / tim sendiri</option>
              <option value="SEKULER">Sekuler (momen bebas saja)</option>
            </select>
            <input className={inputCls} placeholder="Ref: KJ 478 / CCLI" value={form.sourceRef} onChange={(e) => setForm({ ...form, sourceRef: e.target.value })} />
          </div>
          <input className={inputCls} placeholder="Link SABDA / SongSelect" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
          <input className={inputCls} placeholder="Pencipta *" value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
          <input className={inputCls} placeholder="Copyright / CCLI" value={form.copyright} onChange={(e) => setForm({ ...form, copyright: e.target.value })} />
          <div className="flex gap-2">
            <input className={inputCls} placeholder="CCLI no." value={form.ccli} onChange={(e) => setForm({ ...form, ccli: e.target.value })} />
            <input className={inputCls} placeholder="Kunci (G)" value={form.defaultKey} onChange={(e) => setForm({ ...form, defaultKey: e.target.value })} />
          </div>
          <textarea className={`${inputCls} md:col-span-2 font-mono`} rows={6} placeholder="ChordPro: [Verse 1] + chord [C]..." value={form.lyricsChordPro} onChange={(e) => setForm({ ...form, lyricsChordPro: e.target.value })} />
          <div className="md:col-span-2 flex gap-2">
            <button type="button" onClick={() => void createSong()} disabled={saving} className={btnDark}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Simpan & masukkan ke setlist
            </button>
            <p className="text-[11px] text-[#8C8880] self-center">
              {form.source === 'SEKULER'
                ? 'Sekuler: wajib pencipta + link/tautan hak cipta, tanpa lirik (momen bebas/bedah-lagu saja).'
                : 'Full lirik hanya untuk lagu tim/public domain/berizin. Himne (KJ/NKB/NNBT/PKJ/KLIK) cukup metadata + link sumber.'}
            </p>
          </div>
        </div>
      )}

      {showLib && (
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] space-y-2">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Cari judul / KJ 478 / NNBT 42 / PKJ 15 / KLIK 125 / pencipta..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void searchLib(); }} />
            <select className={inputCls} style={{ maxWidth: 150 }} value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => void searchLib()} disabled={libLoading} className={btnDark}>
              {libLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Cari
            </button>
          </div>
          <div className="max-h-56 overflow-auto divide-y divide-[#ECEAE4]">
            {lib.map((s) => (
              <div key={s.id} className="py-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1B1B1B] truncate">
                    {s.title}
                    {s.source === 'SEKULER' && (
                      <span className="ml-1.5 px-1.5 py-px rounded-full bg-amber-100 text-amber-800 text-[9px] font-black align-middle">SEKULER · bebas saja</span>
                    )}
                  </p>
                  <p className="text-[10px] text-[#8C8880] truncate">
                    {s.sourceRef || SOURCE_LABEL[s.source] || s.source}{s.authors ? ` · ${s.authors}` : ''}{s.defaultKey ? ` · ${s.defaultKey}` : ''}{s.lyricsChordPro ? ' · ada chord' : ' · metadata saja'}
                  </p>
                </div>
                {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noreferrer" className={btnGhost}>Sumber</a>}
                <button type="button" onClick={() => void addSong(s.id)} disabled={saving} className={btnGhost}>
                  <Plus className="w-3 h-3" /> Pakai
                </button>
              </div>
            ))}
            {!libLoading && !lib.length && <p className="text-[11px] text-[#8C8880] py-2">Belum ada hasil — coba kata kunci lain atau buat lagu baru.</p>}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat setlist...</p>
      ) : !items.length ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada lagu untuk ibadah ini — cari dari pustaka atau buat lagu baru.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, idx) => (
            <li key={it.id} className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1B1B1B] text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1B1B1B] truncate">
                    {it.song?.title || it.songId}
                    {it.song?.source === 'SEKULER' && (
                      <span className="ml-1.5 px-1.5 py-px rounded-full bg-amber-100 text-amber-800 text-[9px] font-black align-middle">SEKULER</span>
                    )}
                  </p>
                  <p className="text-[10px] text-[#8C8880] truncate">
                    {[it.song?.sourceRef || it.song?.source, it.baseKey || it.song?.defaultKey, it.transpose ? `${it.transpose > 0 ? '+' : ''}${it.transpose}` : null, it.capo ? `capo ${it.capo}` : null, it.moment].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" title="Naik" onClick={() => void move(it.id, -1)} className={btnGhost}><ArrowUp className="w-3 h-3" /></button>
                <button type="button" title="Turun" onClick={() => void move(it.id, 1)} className={btnGhost}><ArrowDown className="w-3 h-3" /></button>
                <button type="button" onClick={() => { setOpenId(openId === it.id ? null : it.id); setView('chord'); }} className={btnGhost}>
                  {openId === it.id ? 'Tutup' : 'Atur'}
                </button>
                <button
                  type="button"
                  title="Hapus dari setlist"
                  onClick={() => {
                    if (!window.confirm(`Hapus "${it.song?.title}" dari setlist? (pustaka tetap ada)`)) return;
                    void mutate(() => api(`/api/events/${eventId}/songs/${it.id}`, { method: 'DELETE' }), 'Dihapus dari setlist');
                  }}
                  className={btnGhost}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {openId === it.id && (
                <div className="mt-2 pt-2 border-t border-[#D9D7D0] grid gap-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <select className={inputCls} style={{ maxWidth: 130 }} value={it.moment || ''} onChange={(e) => void patchItem(it.id, { moment: e.target.value || null })}>
                      <option value="">Momen...</option>
                      {MOMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input className={inputCls} style={{ maxWidth: 80 }} placeholder="Kunci" value={it.baseKey || ''} onChange={(e) => void patchItem(it.id, { baseKey: e.target.value || null })} />
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                      <button type="button" className={btnGhost} onClick={() => void patchItem(it.id, { transpose: (it.transpose || 0) - 1 })}>−1</button>
                      <span className="px-1">{(it.transpose || 0) > 0 ? `+${it.transpose}` : it.transpose || '0'}</span>
                      <button type="button" className={btnGhost} onClick={() => void patchItem(it.id, { transpose: (it.transpose || 0) + 1 })}>+1</button>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                      Capo
                      <button type="button" className={btnGhost} onClick={() => void patchItem(it.id, { capo: Math.max(0, (it.capo || 0) - 1) })}>−</button>
                      <span className="px-1">{it.capo || 0}</span>
                      <button type="button" className={btnGhost} onClick={() => void patchItem(it.id, { capo: Math.min(11, (it.capo || 0) + 1) })}>+</button>
                    </span>
                    <span className="flex-1" />
                    <button type="button" className={btnGhost} onClick={() => setView(view === 'chord' ? 'lirik' : 'chord')}>
                      Lihat: {view === 'chord' ? 'Chord' : 'Lirik'}
                    </button>
                  </div>

                  {!!it.song?.sections?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {it.song.sections.map((name) => {
                        const on = !it.sections?.length || it.sections.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              const all = it.song?.sections || [];
                              const cur = it.sections?.length ? it.sections : all;
                              const next = on ? cur.filter((s) => s !== name) : [...cur, name];
                              void patchItem(it.id, { sections: next.length === all.length ? [] : next }, 'Bagian diperbarui');
                            }}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border ${on ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
                            title={on ? 'Sembunyikan bagian' : 'Pakai bagian'}
                          >
                            [{name}]
                          </button>
                        );
                      })}
                      <span className="text-[10px] text-[#8C8880] self-center">— gelap = dipakai (semua gelap = semua bagian)</span>
                    </div>
                  )}

                  <pre className="p-2.5 rounded-xl bg-[#1B1B1B] text-[#F5F3EE] text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                    {preview || '(belum ada ChordPro — lengkapi di pustaka)'}
                  </pre>
                  <input
                    className={inputCls}
                    placeholder="Catatan pemusik (mis. ulangi chorus 2x)"
                    defaultValue={it.note || ''}
                    onBlur={(e) => { if (e.target.value !== (it.note || '')) void patchItem(it.id, { note: e.target.value || null }); }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={btnGhost} onClick={() => download(`/api/events/${eventId}/songs/export?download=show&itemId=${it.id}`)}>
                      <Download className="w-3 h-3" /> .show
                    </button>
                    <button type="button" className={btnGhost} onClick={() => download(`/api/events/${eventId}/songs/export?download=chordpro&itemId=${it.id}`)}>
                      <Download className="w-3 h-3" /> ChordPro
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        if (!it.song) return;
                        void navigator.clipboard?.writeText(buildQuickLyrics(it.song, it));
                        addToast({ type: 'success', title: 'Quick Lyrics disalin — tempel di FreeShow (CTRL+ALT+I)' });
                      }}
                    >
                      <Copy className="w-3 h-3" /> Salin Quick Lyrics
                    </button>
                  </div>
                  {!!parseSections(it.song?.lyricsChordPro || '').length && !it.song?.lyricsChordPro && (
                    <p className="text-[10px] text-amber-700">Lagu ini baru metadata (himne) — minta pemusik mengisi ChordPro agar bisa transpose & ekspor.</p>
                  )}
                  {it.song?.source === 'SEKULER' && it.moment && !['bebas', 'bedah-lagu'].includes(it.moment) && (
                    <p className="text-[10px] text-amber-700 font-bold">Lagu sekuler sebaiknya hanya untuk momen bebas/bedah-lagu — pindahkan momennya (server menolak momen inti).</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[10px] text-[#8C8880]">
        FreeShow: unduh `.show`/ChordPro per lagu lalu File → Import, atau dorong JSON Ekspor ke API lokal `http://localhost:5506` (FreeShow → Connections → aktifkan API).
      </p>
    </div>
  );
};
