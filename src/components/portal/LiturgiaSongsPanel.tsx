import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Loader2, Music, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SongMasterEditor, type MasterSavePayload } from './SongMasterEditor';
import {
  PICKER_KEYS,
  arrangementSourceLabel,
  buildQuickLyrics,
  effectiveArrangement,
  namedArrangementsOf,
  normalizeArrangement,
  parseSections,
  renderChordOverLyrics,
  renderSelectedSections,
  stripChords,
  transposeKey,
  transposeSteps,
  variantEntries,
  variantNames,
  type ArrangementEntry,
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
  arrangement?: Array<string | { section: string; key?: string | null; transpose?: number | null }> | null;
  arrangements?: { master?: string[] | null; variants?: Array<{ name: string; entries?: unknown }> } | null;
  story?: string | null;
  meaning?: string | null;
  sections: string[];
};

type SetItem = {
  id: string;
  songId: string;
  sortOrder: number;
  sections?: Array<string | { section: string; key?: string | null; transpose?: number | null }> | null;
  baseKey?: string | null;
  transpose: number;
  capo?: number | null;
  moment?: string | null;
  note?: string | null;
  song?: Song | null;
};

/** Susunan efektif: pemakaian per event → default master → full master. */
function effectiveEntries(item: SetItem): ArrangementEntry[] {
  const eff = effectiveArrangement(item.song, item.sections);
  if (eff && eff.length) return eff;
  return (item.song?.sections || []).map((name) => ({ section: name, key: null, transpose: null }));
}

/** Ringkasan susunan untuk baris info (V1·C·V2·C, panah = modulasi). */
function arrangementSummary(item: SetItem): string | null {
  const eff = effectiveArrangement(item.song, item.sections);
  if (!eff) return null;
  const short = (s: string) => s.replace(/^verse\s*/i, 'V').replace(/^chorus/i, 'C').replace(/^pre-chorus/i, 'Pre').replace(/^bridge/i, 'B').replace(/^intro/i, 'I').replace(/^outro/i, 'O').replace(/^interlude/i, 'Inter').replace(/^ending/i, 'End').replace(/^tag/i, 'Tag').replace(/^coda/i, 'Coda');
  const body = eff.map((e) => (e.key ? `${short(e.section)}→${e.key}` : short(e.section))).join('·');
  const src = arrangementSourceLabel(item.song, item.sections);
  if (src) return `${body} (dari: ${src})`;
  if (!normalizeArrangement(item.sections)?.length) {
    const first = variantNames(item.song)?.[0];
    return first ? `master [${first}]: ${body}` : `master: ${body}`;
  }
  return body;
}

const ARR_PRESETS: Array<{ label: string; pick: RegExp[] }> = [
  { label: 'V1 + Chorus', pick: [/^verse\s*1$/i, /^chorus$/i] },
  { label: 'V1 C V2 C', pick: [/^verse\s*1$/i, /^chorus$/i, /^verse\s*2$/i, /^chorus$/i] },
  { label: 'V1 C V2 C B C', pick: [/^verse\s*1$/i, /^chorus$/i, /^verse\s*2$/i, /^chorus$/i, /^bridge$/i, /^chorus$/i] },
];

function matchMaster(master: string[], re: RegExp): string | null {
  return master.find((m) => re.test(m)) || null;
}

/**
 * Editor susunan ala ProPresenter: urutan + pengulangan + modulasi per baris.
 * STAGED: semua aksi hanya mengubah draft lokal; satu tombol Simpan
 * mengirim satu PATCH. Disimpan per setlist item (per event); kosong = default.
 */
function ArrangementEditor({ master, item, song, onSave, disabled }: {
  master: string[];
  item: SetItem;
  song?: Song | null;
  onSave: (sections: Array<{ section: string; key?: string | null }> | null) => void;
  disabled?: boolean;
}) {
  const [addName, setAddName] = useState(master[0] || '');
  const [draft, setDraft] = useState<ArrangementEntry[]>(() => effectiveEntries(item));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(effectiveEntries(item)));
  useEffect(() => {
    const cur = effectiveEntries(item);
    setDraft(cur);
    setSavedJson(JSON.stringify(cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, JSON.stringify(item.sections), JSON.stringify(song?.arrangements ?? song?.arrangement ?? null)]);
  const dirty = JSON.stringify(draft) !== savedJson;
  const save = (list: ArrangementEntry[]) => {
    if (!list.length) {
      onSave(null);
      return;
    }
    const allMaster = master.map((m) => m.toLowerCase());
    const sameOrderNoMod = list.length === master.length
      && list.every((e, i) => e.section.toLowerCase() === allMaster[i] && !e.key);
    onSave(sameOrderNoMod ? null : list.map((e) => (e.key ? { section: e.section, key: e.key } : { section: e.section })));
  };
  const names = variantNames(song);
  const src = arrangementSourceLabel(song, item.sections);
  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };
  return (
    <div className="rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/60 p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Susunan main</span>
        {src ? (
          <span className="text-[10px] font-black text-sky-700">dari: {src}</span>
        ) : !item.sections?.length ? (
          <span className="text-[10px] text-[#8C8880]">default master</span>
        ) : (
          <span className="text-[10px] font-black text-amber-700">kustom</span>
        )}
        <span className="flex-1" />
        {names.length > 0 && (
          <select
            className="text-[10px] border border-[#D9D7D0] rounded-lg px-1 py-0.5 bg-white"
            title="Pakai susunan bernama dari master (salinan beku)"
            value=""
            disabled={disabled}
            onChange={(e) => {
              const entries = variantEntries(song, e.target.value);
              if (entries) save(entries);
              e.target.value = '';
            }}
          >
            <option value="">Pakai susunan…</option>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <button type="button" disabled={disabled} title="Kembali ke default" onClick={() => setDraft(effectiveEntries({ ...item, sections: null }))} className={btnGhost}>Full</button>
        {ARR_PRESETS.map((p) => {
          const names2 = p.pick.map((re) => matchMaster(master, re));
          if (names2.some((n) => !n)) return null;
          return (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              title={`Preset: ${names2.join(' → ')}`}
              onClick={() => setDraft(names2.map((n) => ({ section: n as string, key: null, transpose: null })))}
              className={btnGhost}
            >
              {p.label}
            </button>
          );
        })}
        {dirty && <span className="text-[10px] font-black text-amber-700">belum tersimpan</span>}
        <button
          type="button"
          disabled={disabled || !dirty}
          title="Simpan susunan (satu kali tersimpan)"
          onClick={() => save(draft)}
          className="px-2 py-1 rounded-lg bg-[#1B1B1B] text-white text-[10px] font-black disabled:opacity-50"
        >
          Simpan susunan
        </button>
        <button
          type="button"
          disabled={disabled || !dirty}
          title="Batalkan perubahan"
          onClick={() => setDraft(JSON.parse(savedJson) as ArrangementEntry[])}
          className={btnGhost}
        >
          Batal
        </button>
      </div>
      {draft.map((e, i) => (
        <div key={`${e.section}-${i}`} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white border border-[#D9D7D0]/60 px-2 py-1">
          <span className="text-[10px] font-black text-[#8C8880] w-5">{i + 1}</span>
          <span className="text-[11px] font-bold text-[#1B1B1B]">[{e.section}]{e.key ? <span className="ml-1 text-[10px] font-black text-white bg-[#1B1B1B] rounded-full px-1.5 py-px">→ {e.key}</span> : null}</span>
          <span className="flex-1" />
          <select
            className="text-[10px] border border-[#D9D7D0] rounded-lg px-1 py-0.5 bg-white"
            title="Modulasi mulai baris ini (berlaku ke bawah)"
            value={e.key || ''}
            disabled={disabled}
            onChange={(ev) => {
              const next = draft.map((x, xi) => (xi === i ? { ...x, key: ev.target.value || null } : x));
              setDraft(next);
            }}
          >
            <option value="">Ikut nada</option>
            {PICKER_KEYS.map((k) => <option key={k} value={k}>Mod → {k}</option>)}
          </select>
          <button type="button" disabled={disabled} title="Naik" onClick={() => move(i, -1)} className={btnGhost}>↑</button>
          <button type="button" disabled={disabled} title="Turun" onClick={() => move(i, 1)} className={btnGhost}>↓</button>
          <button
            type="button"
            disabled={disabled}
            title="Duplikat baris (mis. Chorus 2x)"
            onClick={() => setDraft([...draft.slice(0, i + 1), { ...draft[i] }, ...draft.slice(i + 1)])}
            className={btnGhost}
          >
            ⧉
          </button>
          <button
            type="button"
            disabled={disabled}
            title="Hapus baris"
            onClick={() => setDraft(draft.filter((_, xi) => xi !== i))}
            className={btnGhost}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={addName} disabled={disabled} onChange={(e) => setAddName(e.target.value)} className="text-[11px] border border-[#D9D7D0] rounded-lg px-2 py-1 bg-white">
          {master.map((m) => <option key={m} value={m}>[{m}]</option>)}
        </select>
        <button
          type="button"
          disabled={disabled || !addName}
          onClick={() => { if (addName) setDraft([...draft, { section: addName, key: null, transpose: null }]); }}
          className={btnGhost}
        >
          + Tambah
        </button>
        {!item.sections?.length && <span className="text-[10px] text-[#8C8880]">— default master sesuai urutan lagu</span>}
      </div>
    </div>
  );
}

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
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [mySetting, setMySetting] = useState<{ transpose: number; capo: number | null } | null>(null);
  const [useMine, setUseMine] = useState(false);

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
    const key = openItem.baseKey || openItem.song.defaultKey || 'C';
    const body = renderSelectedSections(
      openItem.song.lyricsChordPro || '',
      effectiveArrangement(openItem.song, openItem.sections ?? null),
      effTranspose,
      key,
      view === 'chord',
    );
    return view === 'lirik' ? stripChords(body).trim() : renderChordOverLyrics(body);
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

  /** Simpan batch dari SongMasterEditor: satu POST (baru) / PUT (edit). */
  const saveMaster = async (payload: MasterSavePayload) => {
    if (!payload.title.trim()) {
      addToast({ type: 'error', title: 'Judul lagu wajib' });
      return;
    }
    setSaving(true);
    try {
      if (editingSong) {
        const d = await api<{ song: Song }>(`/api/songs/${editingSong.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        addToast({ type: 'success', title: `Lirik "${d.song?.title || ''}" diperbarui` });
        setEditingSong(null);
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
        await searchLib();
        if (d.song?.id) await addSong(d.song.id);
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal simpan lagu', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  /** Muat lagu pustaka/setlist ke editor batch. */
  const loadIntoForm = (s: Song) => {
    setEditingSong(s);
    setShowCreate(true);
    setShowLib(false);
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
        <button
          type="button"
          onClick={() => {
            setEditingSong(null);
            setShowCreate(true);
          }}
          className={btnGhost}
        >
          <Plus className="w-3 h-3" /> Lagu baru
        </button>
        <a href={`/api/events/${eventId}/songs/export`} target="_blank" rel="noreferrer" className={btnGhost} title="Payload FreeShow API-ready (JSON)">
          <Download className="w-3 h-3" /> Ekspor JSON
        </a>
      </div>

      {showCreate && (
        <SongMasterEditor
          key={editingSong?.id || 'baru'}
          initial={editingSong}
          saving={saving}
          submitLabel={editingSong ? 'Simpan perubahan' : 'Simpan & masukkan ke setlist'}
          onCancel={() => {
            setEditingSong(null);
            setShowCreate(false);
          }}
          onSave={(payload) => void saveMaster(payload)}
        />
      )}
      {null}
      {showCreate && (
        <SongMasterEditor
          key={editingSong?.id || 'baru'}
          initial={editingSong}
          saving={saving}
          submitLabel={editingSong ? 'Simpan perubahan' : 'Simpan & masukkan ke setlist'}
          onCancel={() => {
            setEditingSong(null);
            setShowCreate(false);
          }}
          onSave={(payload) => void saveMaster(payload)}
        />
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
                    {[it.song?.sourceRef || it.song?.source, it.baseKey || it.song?.defaultKey, it.transpose ? `${it.transpose > 0 ? '+' : ''}${it.transpose}` : null, it.capo ? `capo ${it.capo}` : null, arrangementSummary(it), it.moment].filter(Boolean).join(' · ')}
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
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold" title="Geser nada (semitone) — satu-satunya kontrol transpose">
                      Nada
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
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold" title="Capo hanya anotasi untuk gitaris — tidak menggeser chord">
                      {it.capo ? (
                        <>
                          Capo {it.capo}
                          <button type="button" className={btnGhost} title="Hapus anotasi capo" onClick={() => void patchItem(it.id, { capo: null }, 'Capo dihapus')}>✕</button>
                        </>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      title={mySetting ? `Nada saya ${mySetting.transpose > 0 ? `+${mySetting.transpose}` : mySetting.transpose}${mySetting.capo ? ` · capo ${mySetting.capo} (anotasi)` : ''} — klik untuk ${useMine ? 'lihat default tim' : 'lihat chord saya'}` : 'Atur nada personal (tersimpan per akun)'}
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
                          {mySetting.capo ? (
                            <button type="button" className={btnGhost} title="Hapus anotasi capo saya" onClick={() => void saveMine(mySetting.transpose, null)}>capo {mySetting.capo} ✕</button>
                          ) : null}
                        </span>
                      )}
                    <span className="flex-1" />
                    <button type="button" className={btnGhost} onClick={() => setView(view === 'chord' ? 'lirik' : 'chord')}>
                      Lihat: {view === 'chord' ? 'Chord' : 'Lirik'}
                    </button>
                  </div>

                  {!!it.song?.sections?.length && (
                    <ArrangementEditor
                      master={namedArrangementsOf(it.song)?.master?.length ? namedArrangementsOf(it.song)?.master as string[] : it.song.sections}
                      item={it}
                      song={it.song}
                      onSave={(sections) => void patchItem(it.id, { sections: sections ?? [] }, 'Susunan diperbarui')}
                    />
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
                    <button type="button" title="ChordPro dengan nada personal saya" className={btnGhost} onClick={() => download(`/api/events/${eventId}/songs/export?download=chordpro&itemId=${it.id}&asMe=1`)}>
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
