import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Loader2, Music, Pencil, Plus, Search, Trash2, Wand2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  PICKER_KEYS,
  SECTION_TEMPLATES,
  buildQuickLyrics,
  compileChordOverLyrics,
  parseSections,
  renderSelectedSections,
  stripChords,
  transposeChordPro,
  transposeKey,
  transposeSteps,
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
  story?: string | null;
  meaning?: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const chordRef = useRef<HTMLTextAreaElement | null>(null);
  const [mySetting, setMySetting] = useState<{ transpose: number; capo: number | null } | null>(null);
  const [useMine, setUseMine] = useState(false);
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
    story: '',
    meaning: '',
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

  // Transpose/capo personal pemusik untuk lagu yang dibuka (per akun, fallback default item).
  useEffect(() => {
    setMySetting(null);
    setUseMine(false);
    if (!openId) return;
    void api<{ setting: { transpose: number; capo: number | null } | null }>(
      `/api/events/${eventId}/songs/${openId}/mysetting`,
    )
      .then((d) => { if (d.setting) { setMySetting(d.setting); setUseMine(true); } })
      .catch(() => undefined);
  }, [openId, eventId]);

  const effTranspose = useMine && mySetting ? mySetting.transpose : openItem?.transpose || 0;

  const saveMine = async (transpose: number, capo: number | null) => {
    if (!openId) return;
    setSaving(true);
    try {
      const d = await api<{ setting: { transpose: number; capo: number | null } }>(
        `/api/events/${eventId}/songs/${openId}/mysetting`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transpose, capo }) },
      );
      setMySetting(d.setting);
      setUseMine(true);
      addToast({ type: 'success', title: 'Transpose saya tersimpan' });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal simpan', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => {
    if (!openItem?.song) return '';
    const body = renderSelectedSections(openItem.song.lyricsChordPro || '', openItem.sections ?? null);
    const t = transposeChordPro(body, effTranspose);
    return view === 'lirik' ? stripChords(t) : t;
  }, [openItem, view, effTranspose]);

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
      const payload = { ...form, sourceRef: form.sourceRef || null, defaultKey: form.defaultKey || null };
      if (editingId) {
        const d = await api<{ song: Song }>(`/api/songs/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        addToast({ type: 'success', title: `Lirik "${d.song?.title || ''}" diperbarui` });
        setEditingId(null);
        setShowCreate(false);
        await searchLib();
        await load();
      } else {
        const d = await api<{ song: Song }>('/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setShowCreate(false);
        setForm({ ...form, title: '', sourceRef: '', lyricsChordPro: '' });
        await searchLib();
        if (d.song?.id) await addSong(d.song.id);
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal simpan lagu', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  /** Muat lagu pustaka/setlist ke editor untuk diisi lirik + chord. */
  const loadIntoForm = (s: Song) => {
    setForm({
      title: s.title || '',
      source: s.source || 'LOKAL',
      sourceRef: s.sourceRef || '',
      sourceUrl: s.sourceUrl || '',
      authors: s.authors || '',
      copyright: s.copyright || '',
      ccli: s.ccli || '',
      defaultKey: s.defaultKey || '',
      lyricsChordPro: s.lyricsChordPro || '',
      story: s.story || '',
      meaning: s.meaning || '',
    });
    setEditingId(s.id);
    setShowCreate(true);
    setShowLib(false);
  };

  /** Sisipkan template bagian pada posisi kursor textarea chord. */
  const insertTemplate = (name: string) => {
    const ta = chordRef.current;
    const snippet = `\n[${name}]\n`;
    if (!ta) {
      setForm({ ...form, lyricsChordPro: `${form.lyricsChordPro || ''}${snippet}` });
      return;
    }
    const start = ta.selectionStart ?? (form.lyricsChordPro || '').length;
    const end = ta.selectionEnd ?? start;
    const cur = form.lyricsChordPro || '';
    setForm({ ...form, lyricsChordPro: `${cur.slice(0, start)}${snippet}${cur.slice(end)}` });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + snippet.length;
    });
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
          <div className="md:col-span-2 flex items-center gap-2">
            <span className="text-xs font-black text-[#1B1B1B]">
              {editingId ? 'Isi lirik + chord (perbarui pustaka)' : 'Lagu baru'}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...form, title: '', sourceRef: '', lyricsChordPro: '' });
                }}
                className={btnGhost}
              >
                Batal edit
              </button>
            )}
          </div>
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
            <select className={inputCls} title="Nada dasar partitur" value={form.defaultKey} onChange={(e) => setForm({ ...form, defaultKey: e.target.value })}>
              <option value="">Nada dasar…</option>
              {PICKER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <textarea className={`${inputCls} md:col-span-2`} rows={3} placeholder="Kisah di balik lagu (terkurasi — tampil di bedah lagu bila lagu ini dipilih)" value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} />
          <textarea className={`${inputCls} md:col-span-2`} rows={2} placeholder="Makna singkat lagu (1-2 kalimat, terkurasi)" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          <div className="md:col-span-2 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-bold text-[#8C8880]">Bagian:</span>
            {SECTION_TEMPLATES.slice(0, 8).map((t) => (
              <button key={t} type="button" onClick={() => insertTemplate(t)} className={btnGhost} title={`Sisipkan [${t}]`}>
                [{t}]
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              title="Gabungkan baris chord di atas lirik menjadi inline [C]"
              onClick={() => setForm({ ...form, lyricsChordPro: compileChordOverLyrics(form.lyricsChordPro || '') })}
              className={btnGhost}
            >
              <Wand2 className="w-3 h-3" /> Gabungkan chord di atas
            </button>
          </div>
          <textarea ref={chordRef} className={`${inputCls} md:col-span-2 font-mono`} rows={8} placeholder={'[Verse 1]\n[C]Tulis lirik di sini [G]...\n\natau tulis chord di baris atas, lirik di bawahnya — lalu klik "Gabungkan chord di atas"'} value={form.lyricsChordPro} onChange={(e) => setForm({ ...form, lyricsChordPro: e.target.value })} />
          <div className="md:col-span-2 flex gap-2">
            <button type="button" onClick={() => void createSong()} disabled={saving} className={btnDark}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {editingId ? 'Perbarui lagu' : 'Simpan & masukkan ke setlist'}
            </button>
            <p className="text-[11px] text-[#8C8880] self-center">
              {form.source === 'SEKULER'
                ? 'Sekuler: wajib pencipta + link/tautan hak cipta, tanpa lirik (momen bebas/bedah-lagu saja).'
                : 'Tulis lirik per bait + chord inline [C]. Chord boleh ditulis di baris atas lirik lalu digabungkan.'}
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
                {s.source !== 'SEKULER' && (
                  <button type="button" title={s.lyricsChordPro ? 'Edit lirik + chord' : 'Isi lirik + chord'} onClick={() => loadIntoForm(s)} className={btnGhost}>
                    <Pencil className="w-3 h-3" /> {s.lyricsChordPro ? 'Edit' : 'Isi lirik'}
                  </button>
                )}
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
                    <select
                      className={inputCls}
                      style={{ maxWidth: 110 }}
                      title="Main di kunci — transpose dihitung otomatis dari nada dasar"
                      value=""
                      onChange={(e) => {
                        const target = e.target.value;
                        if (!target) return;
                        const base = it.baseKey || it.song?.defaultKey || 'C';
                        void patchItem(it.id, { transpose: transposeSteps(base, target) }, `Transpose ${base}→${target}`);
                      }}
                    >
                      <option value="">Main di… ({transposeKey(it.baseKey || it.song?.defaultKey || 'C', it.transpose || 0)})</option>
                      {PICKER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                      Capo
                      <button type="button" className={btnGhost} onClick={() => void patchItem(it.id, { capo: Math.max(0, (it.capo || 0) - 1) })}>−</button>
                      <span className="px-1">{it.capo || 0}</span>
                      <button type="button" className={btnGhost} onClick={() => void patchItem(it.id, { capo: Math.min(11, (it.capo || 0) + 1) })}>+</button>
                    </span>
                    <button
                      type="button"
                      title={mySetting ? `Transpose saya ${mySetting.transpose > 0 ? `+${mySetting.transpose}` : mySetting.transpose}, capo ${mySetting.capo ?? 0} — klik untuk ${useMine ? 'lihat default tim' : 'lihat chord saya'}` : 'Atur transpose/capo personal (tersimpan per akun)'}
                      onClick={() => {
                        if (!mySetting) {
                          void saveMine(it.transpose || 0, it.capo ?? null);
                        } else {
                          setUseMine(!useMine);
                        }
                      }}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold border ${useMine && mySetting ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
                    >
                      {mySetting ? `Saya ${mySetting.transpose > 0 ? `+${mySetting.transpose}` : mySetting.transpose}${mySetting.capo ? ` · capo ${mySetting.capo}` : ''}` : 'Chord saya'}
                    </button>
                    {useMine && mySetting && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                        <button type="button" className={btnGhost} onClick={() => void saveMine(mySetting.transpose - 1, mySetting.capo)}>-1</button>
                        <button type="button" className={btnGhost} onClick={() => void saveMine(mySetting.transpose + 1, mySetting.capo)}>+1</button>
                        <button type="button" className={btnGhost} onClick={() => void saveMine(mySetting.transpose, Math.max(0, (mySetting.capo || 0) - 1))}>capo−</button>
                        <button type="button" className={btnGhost} onClick={() => void saveMine(mySetting.transpose, Math.min(11, (mySetting.capo || 0) + 1))}>capo+</button>
                      </span>
                    )}
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
                    <button type="button" title="ChordPro dengan transpose/capo personal saya" className={btnGhost} onClick={() => download(`/api/events/${eventId}/songs/export?download=chordpro&itemId=${it.id}&asMe=1`)}>
                      <Download className="w-3 h-3" /> ChordPro saya
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
                  {!!parseSections(it.song?.lyricsChordPro || '').length && !it.song?.lyricsChordPro && it.song && (
                    <p className="text-[10px] text-amber-700">
                      Lagu ini baru metadata.{' '}
                      <button type="button" onClick={() => loadIntoForm(it.song as Song)} className="font-black underline">
                        Isi lirik + chord
                      </button>{' '}
                      agar bisa transpose, tampil di layar & ekspor.
                    </p>
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
