import React, { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import {
  PICKER_KEYS,
  SECTION_TEMPLATES,
  applyChordLine,
  chordLyricPairs,
  compileChordOverLyrics,
  findSuspectChords,
  namedArrangementsOf,
  normalizeArrangement,
  parseSections,
  transposeChordPro,
  transposeSteps,
  type ArrangementEntry,
} from '../../lib/song-chords';

export type MasterSong = {
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
  arrangements?: { master?: string[] | null; variants?: Array<{ name: string; entries?: unknown }> } | null;
  arrangement?: Array<string | { section: string; key?: string | null; transpose?: number | null }> | null;
  story?: string | null;
  meaning?: string | null;
};

export type MasterSavePayload = {
  title: string;
  source: string;
  sourceRef: string | null;
  sourceUrl: string | null;
  authors: string;
  copyright: string;
  ccli: string;
  defaultKey: string | null;
  lyricsChordPro: string;
  arrangements: { master: string[] | null; variants: Array<{ name: string; entries: ArrangementEntry[] }> } | null;
  story: string;
  meaning: string;
};

type VariantDraft = { name: string; entries: ArrangementEntry[] };

type Tab = 'lirik' | 'susunan' | 'chord' | 'nada';

const ARR_PRESETS: Array<{ label: string; pick: RegExp[] }> = [
  { label: 'V1 + Chorus', pick: [/^verse\s*1$/i, /^chorus$/i] },
  { label: 'V1 C V2 C', pick: [/^verse\s*1$/i, /^chorus$/i, /^verse\s*2$/i, /^chorus$/i] },
  { label: 'V1 C V2 C B C', pick: [/^verse\s*1$/i, /^chorus$/i, /^verse\s*2$/i, /^chorus$/i, /^bridge$/i, /^chorus$/i] },
];

const inputCls =
  'w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-xs text-[#1B1B1B] focus:outline-none focus:border-black';
const btnDark =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50';
const btnGhost =
  'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B] disabled:opacity-50';

function blankMeta() {
  return {
    title: '', source: 'LOKAL', sourceRef: '', sourceUrl: '',
    authors: '', copyright: '', ccli: '', defaultKey: '', story: '', meaning: '',
  };
}

/**
 * Editor master lagu — batch: semua tab mengedit DRAFT lokal, satu tombol
 * Simpan mengirim satu PUT/POST. Setlist tetap live (di luar editor ini).
 */
export const SongMasterEditor: React.FC<{
  initial: MasterSong | null;
  saving: boolean;
  submitLabel?: string;
  onSave: (payload: MasterSavePayload) => void;
  onCancel: () => void;
}> = ({ initial, saving, submitLabel, onSave, onCancel }) => {
  const [tab, setTab] = useState<Tab>('lirik');
  const [meta, setMeta] = useState(() => (initial
    ? {
      title: initial.title || '', source: initial.source || 'LOKAL', sourceRef: initial.sourceRef || '',
      sourceUrl: initial.sourceUrl || '', authors: initial.authors || '', copyright: initial.copyright || '',
      ccli: initial.ccli || '', defaultKey: initial.defaultKey || '',
      story: initial.story || '', meaning: initial.meaning || '',
    }
    : blankMeta()));
  const [lyrics, setLyrics] = useState(() => initial?.lyricsChordPro || '');
  const [pool, setPool] = useState<string[] | null>(() => {
    const named = namedArrangementsOf(initial ?? null);
    return named?.master && named.master.length ? [...named.master] : null;
  });
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    const named = namedArrangementsOf(initial ?? null);
    if (named && named.variants.length) {
      return named.variants.map((v) => ({ name: v.name, entries: [...v.entries] }));
    }
    const legacy = normalizeArrangement(initial?.arrangement ?? null);
    return legacy && legacy.length ? [{ name: 'Susunan', entries: legacy }] : [];
  });
  const [activeVariant, setActiveVariant] = useState(0);
  const [newVariantName, setNewVariantName] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const [snapshot] = useState(() => {
    const named = namedArrangementsOf(initial ?? null);
    return JSON.stringify({
      meta: initial ? {
        title: initial.title || '', source: initial.source || 'LOKAL', sourceRef: initial.sourceRef || '',
        sourceUrl: initial.sourceUrl || '', authors: initial.authors || '', copyright: initial.copyright || '',
        ccli: initial.ccli || '', defaultKey: initial.defaultKey || '',
        story: initial.story || '', meaning: initial.meaning || '',
      } : blankMeta(),
      lyrics: initial?.lyricsChordPro || '',
      pool: named?.master && named.master.length ? [...named.master] : null,
      variants: named && named.variants.length
        ? named.variants.map((v) => ({ name: v.name, entries: [...v.entries] }))
        : (normalizeArrangement(initial?.arrangement ?? null) || []).length
          ? [{ name: 'Susunan', entries: normalizeArrangement(initial?.arrangement ?? null) || [] }]
          : [],
      baseKey: initial?.defaultKey || '',
    });
  });

  const masterNames = useMemo(() => parseSections(lyrics).map((s) => s.name), [lyrics]);
  const baseKey = (meta.defaultKey || '').trim();
  const steps = targetKey && baseKey ? transposeSteps(baseKey, targetKey) : 0;
  const rewritten = steps ? transposeChordPro(lyrics, steps) : lyrics;

  const snap = useMemo(() => JSON.parse(snapshot) as {
    meta: typeof meta; lyrics: string;
    pool: string[] | null; variants: VariantDraft[]; baseKey: string;
  }, [snapshot]);
  const keyChange = targetKey !== '' && targetKey !== baseKey;
  const dirty = JSON.stringify({ meta, lyrics, pool, variants }) !== JSON.stringify({
    meta: snap.meta, lyrics: snap.lyrics, pool: snap.pool, variants: snap.variants,
  }) || keyChange;

  // Pool resmi susunan: null = ikut teks lirik apa adanya.
  const poolNames = useMemo(
    () => (pool && pool.length ? pool : masterNames),
    [pool, masterNames],
  );

  const unknownPool = useMemo(() => {
    if (!pool) return [];
    const known = new Set<string>(masterNames.map((s) => s.toLowerCase()));
    return [...new Set<string>(pool)].filter((s: string) => !known.has(s.toLowerCase()));
  }, [pool, masterNames]);

  const unknownSections = useMemo(() => {
    const allowed = new Set<string>(poolNames.map((s) => s.toLowerCase()));
    const names: string[] = variants.flatMap((v) => v.entries.map((e) => e.section));
    return [...new Set<string>(names)].filter((s: string) => !allowed.has(s.toLowerCase()));
  }, [variants, poolNames]);

  const dupNames = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const v of variants) {
      const k = v.name.toLowerCase();
      if (seen.has(k)) dups.add(v.name);
      seen.add(k);
    }
    return [...dups];
  }, [variants]);

  const suspects = useMemo(() => findSuspectChords(lyrics), [lyrics]);
  const isSecular = meta.source === 'SEKULER';
  const errors: string[] = [];
  if (!meta.title.trim()) errors.push('Judul lagu wajib.');
  if (isSecular && lyrics.trim()) errors.push('Lirik lagu sekuler tidak disimpan — kosongkan lirik.');
  if (unknownPool.length) errors.push(`Setlist master memuat bagian tak dikenal di lirik: ${unknownPool.join(', ')}.`);
  if (unknownSections.length) errors.push(`Susunan memuat bagian di luar setlist master: ${unknownSections.join(', ')}.`);
  if (dupNames.length) errors.push(`Nama varian ganda: ${dupNames.join(', ')}.`);
  if (variants.some((v) => !v.name.trim())) errors.push('Tiap varian wajib bernama.');

  const commitChordRow = (li: number, chordText: string) => {
    const lines = lyrics.split('\n');
    if (li < 0 || li >= lines.length) return;
    lines[li] = applyChordLine(lines[li], chordText);
    setLyrics(lines.join('\n'));
  };

  const setActiveEntries = (entries: ArrangementEntry[]) => {
    setVariants(variants.map((v, vi) => (vi === activeVariant ? { ...v, entries } : v)));
  };

  const moveEntry = (i: number, dir: -1 | 1) => {
    const list = variants[activeVariant]?.entries || [];
    const next = [...list];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setActiveEntries(next);
  };

  const applyPreset = (pick: RegExp[]) => {
    const names = pick.map((re) => poolNames.find((m) => re.test(m)));
    if (names.some((n) => !n)) return;
    const built = (names as string[]).map((section) => ({ section, key: null, transpose: null }));
    if (!variants.length) {
      setVariants([{ name: 'Susunan', entries: built }]);
      setActiveVariant(0);
      return;
    }
    setActiveEntries(built);
  };

  const addVariant = () => {
    const name = newVariantName.trim().slice(0, 40);
    if (!name) return;
    setVariants([...variants, { name, entries: [] }]);
    setNewVariantName('');
    setActiveVariant(variants.length);
  };

  const doSave = () => {
    if (errors.length || saving) return;
    const finalLyrics = steps && targetKey ? transposeChordPro(lyrics, steps) : lyrics;
    const cleanVariants = variants
      .map((v) => ({ name: v.name.trim(), entries: v.entries }))
      .filter((v) => v.name);
    onSave({
      title: meta.title.trim(),
      source: meta.source,
      sourceRef: meta.sourceRef.trim() || null,
      sourceUrl: meta.sourceUrl.trim() || null,
      authors: meta.authors.trim(),
      copyright: meta.copyright.trim(),
      ccli: meta.ccli.trim(),
      defaultKey: (steps && targetKey ? targetKey : baseKey) || null,
      lyricsChordPro: finalLyrics,
      arrangements: pool || cleanVariants.length ? { master: pool, variants: cleanVariants } : null,
      story: meta.story.trim(),
      meaning: meta.meaning.trim(),
    });
  };

  const chordRows = useMemo(() => chordLyricPairs(lyrics), [lyrics]);
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'lirik', label: '1 · Lirik' },
    { id: 'susunan', label: '2 · Susunan' },
    { id: 'chord', label: '3 · Chord' },
    { id: 'nada', label: '4 · Nada' },
  ];

  return (
    <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-[#1B1B1B]">
          {initial ? `Edit master: ${initial.title}` : 'Lagu baru'}
        </span>
        {dirty && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">belum tersimpan</span>}
        <span className="flex-1" />
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${tab === t.id ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input className={inputCls} placeholder="Judul lagu *" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <div className="flex gap-2">
          <select className={inputCls} value={meta.source} onChange={(e) => setMeta({ ...meta, source: e.target.value })}>
            <option value="HIMNE_KJ">Himne KJ</option>
            <option value="HIMNE_NKB">Himne NKB</option>
            <option value="HIMNE_NNBT">Himne NNBT (GMIM)</option>
            <option value="HIMNE_PKJ">Himne PKJ</option>
            <option value="KLIK">KLIK (GMIM)</option>
            <option value="KONTEMPORER">Kontemporer</option>
            <option value="LOKAL">Lokal / tim sendiri</option>
            <option value="SEKULER">Sekuler (momen bebas saja)</option>
          </select>
          <input className={inputCls} placeholder="Ref: KJ 478" value={meta.sourceRef} onChange={(e) => setMeta({ ...meta, sourceRef: e.target.value })} />
        </div>
        <input className={inputCls} placeholder="Link SABDA / SongSelect / Spotify" value={meta.sourceUrl} onChange={(e) => setMeta({ ...meta, sourceUrl: e.target.value })} />
        <input className={inputCls} placeholder="Pencipta" value={meta.authors} onChange={(e) => setMeta({ ...meta, authors: e.target.value })} />
        <input className={inputCls} placeholder="Copyright / label" value={meta.copyright} onChange={(e) => setMeta({ ...meta, copyright: e.target.value })} />
        <div className="flex gap-2">
          <input className={inputCls} placeholder="CCLI no." value={meta.ccli} onChange={(e) => setMeta({ ...meta, ccli: e.target.value })} />
          <select className={inputCls} title="Nada dasar partitur" value={meta.defaultKey} onChange={(e) => setMeta({ ...meta, defaultKey: e.target.value })}>
            <option value="">Nada dasar…</option>
            {PICKER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className={tab === 'lirik' ? '' : 'hidden'}>
        <div className="flex flex-wrap gap-1.5 items-center mb-1.5">
          <span className="text-[10px] font-bold text-[#8C8880]">Sisipkan:</span>
          {SECTION_TEMPLATES.slice(0, 8).map((t) => (
            <button
              key={t}
              type="button"
              className={btnGhost}
              onClick={() => setLyrics((prev) => `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}\n[${t}]\n`)}
            >
              [{t}]
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            className={btnGhost}
            title="Gabungkan baris chord di atas lirik menjadi inline [C]"
            onClick={() => setLyrics((prev) => compileChordOverLyrics(prev || ''))}
          >
            Gabungkan chord di atas
          </button>
        </div>
        <textarea
          className={`${inputCls} font-mono`}
          rows={10}
          placeholder={'[Verse 1]\n[C]Tulis lirik di sini [G]...\n\n[Chorus]\n...'}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
        />
        <p className="mt-1 text-[10px] text-[#8C8880]">Susun bait seenaknya (ver1, chorus, ver2…) — urutan main diatur di tab Susunan.</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <textarea
            className={`${inputCls} font-sans`}
            rows={3}
            placeholder="Kisah di balik lagu (terkurasi — untuk bedah lagu)"
            value={meta.story}
            onChange={(e) => setMeta({ ...meta, story: e.target.value })}
          />
          <textarea
            className={`${inputCls} font-sans`}
            rows={3}
            placeholder="Makna singkat (1-2 kalimat)"
            value={meta.meaning}
            onChange={(e) => setMeta({ ...meta, meaning: e.target.value })}
          />
        </div>
      </div>

      <div className={tab === 'susunan' ? 'space-y-2' : 'hidden'}>
        <div className="rounded-xl bg-white border border-[#D9D7D0]/60 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Setlist master</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setPool(null)} className={btnGhost} title="Kosong = ikut teks lirik apa adanya">Ikut teks</button>
            <button type="button" onClick={() => setPool([...masterNames])} className={btnGhost} title="Ambil semua bagian dari teks">Ambil semua</button>
          </div>
          {!pool && (
            <p className="text-[11px] text-[#8C8880] italic">Mengikuti teks ({masterNames.join(' → ') || '—'}). Kunci pool untuk susunan resmi.</p>
          )}
          {(pool || []).map((name, i) => (
            <div key={`${name}-${i}`} className="flex items-center gap-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0]/60 px-2 py-1">
              <span className="text-[10px] font-black text-[#8C8880] w-5">{i + 1}</span>
              <span className="text-[11px] font-bold text-[#1B1B1B]">[{name}]</span>
              <span className="flex-1" />
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  const next = [...(pool || [])];
                  const j = i - 1;
                  if (j < 0) return;
                  [next[i], next[j]] = [next[j], next[i]];
                  setPool(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  const next = [...(pool || [])];
                  const j = i + 1;
                  if (j >= next.length) return;
                  [next[i], next[j]] = [next[j], next[i]];
                  setPool(next);
                }}
              >
                ↓
              </button>
              <button type="button" className={btnGhost} onClick={() => setPool((pool || []).filter((_, xi) => xi !== i))}>✕</button>
            </div>
          ))}
          <PoolAdder
            masterNames={masterNames}
            pool={pool || []}
            onAdd={(section) => setPool([...(pool || []), section])}
          />
        </div>

        <div className="rounded-xl bg-white border border-[#D9D7D0]/60 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Varian susunan</span>
            <span className="flex-1" />
            <input
              className="text-[11px] border border-[#D9D7D0] rounded-lg px-2 py-1 bg-white"
              style={{ maxWidth: 130 }}
              placeholder="Nama varian…"
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addVariant(); }}
            />
            <button type="button" onClick={addVariant} disabled={!newVariantName.trim()} className={btnGhost}>+ Varian</button>
          </div>
          {!variants.length && (
            <p className="text-[11px] text-[#8C8880] italic">Belum ada varian — tambah mis. <em>full</em> (V1-C-V2-C…) dan <em>v1only</em> (V1-C).</p>
          )}
          {variants.map((v, vi) => (
            <div key={`${v.name}-${vi}`} className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 ${vi === activeVariant ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-[#FAF9F5] border-[#D9D7D0]/60'}`}>
              <button
                type="button"
                onClick={() => setActiveVariant(vi)}
                className={`text-[11px] font-black flex-1 text-left ${vi === activeVariant ? '' : 'text-[#1B1B1B]'}`}
                title="Edit varian ini"
              >
                {v.name} <span className={`font-bold ${vi === activeVariant ? 'text-white/60' : 'text-[#8C8880]'}`}>({v.entries.length} baris)</span>
              </button>
              {vi === activeVariant && (
                <input
                  className="text-[11px] border border-white/30 rounded-lg px-2 py-0.5 bg-white/10 text-white"
                  style={{ maxWidth: 110 }}
                  title="Ganti nama varian"
                  value={v.name}
                  onChange={(e) => setVariants(variants.map((x, xi) => (xi === vi ? { ...x, name: e.target.value.slice(0, 40) } : x)))}
                />
              )}
              <button
                type="button"
                className={vi === activeVariant ? 'text-[10px] font-bold text-white/70 hover:text-white' : btnGhost}
                title="Duplikat varian"
                onClick={() => {
                  const base = `${v.name} (2)`.slice(0, 40);
                  let name = base;
                  let n = 2;
                  const taken = new Set(variants.map((x) => x.name.toLowerCase()));
                  while (taken.has(name.toLowerCase())) { n += 1; name = `${v.name} (${n})`.slice(0, 40); }
                  const next = [...variants.slice(0, vi + 1), { name, entries: v.entries.map((e) => ({ ...e })) }, ...variants.slice(vi + 1)];
                  setVariants(next);
                  setActiveVariant(vi + 1);
                }}
              >
                ⧉
              </button>
              <button
                type="button"
                className={vi === activeVariant ? 'text-[10px] font-bold text-white/70 hover:text-white' : btnGhost}
                title="Hapus varian"
                onClick={() => {
                  if (!window.confirm(`Hapus varian "${v.name}"?`)) return;
                  setVariants(variants.filter((_, xi) => xi !== vi));
                  setActiveVariant(Math.max(0, vi - 1));
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-bold text-[#8C8880]">
            Baris varian: {variants[activeVariant]?.name || '—'}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={() => setActiveEntries([])} className={btnGhost} title="Kosongkan = full (ikut pool/teks)">Full</button>
          {ARR_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p.pick)} className={btnGhost}>{p.label}</button>
          ))}
        </div>
        {(variants[activeVariant]?.entries || []).map((e, i) => (
          <div key={`${e.section}-${i}`} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white border border-[#D9D7D0]/60 px-2 py-1">
            <span className="text-[10px] font-black text-[#8C8880] w-5">{i + 1}</span>
            <span className="text-[11px] font-bold text-[#1B1B1B]">[{e.section}]</span>
            <select
              className="text-[10px] border border-[#D9D7D0] rounded-lg px-1 py-0.5 bg-white"
              title="Modulasi mulai baris ini"
              value={e.key || ''}
              onChange={(ev) => setActiveEntries((variants[activeVariant]?.entries || []).map((x, xi) => (xi === i ? { ...x, key: ev.target.value || null } : x)))}
            >
            <option value="">Ikut nada</option>
            {PICKER_KEYS.map((k) => <option key={k} value={k}>Mod → {k}</option>)}
            </select>
            <span className="flex-1" />
            <button type="button" onClick={() => moveEntry(i, -1)} className={btnGhost}>↑</button>
            <button type="button" onClick={() => moveEntry(i, 1)} className={btnGhost}>↓</button>
            <button
              type="button"
              onClick={() => {
                const list = variants[activeVariant]?.entries || [];
                setActiveEntries([...list.slice(0, i + 1), { ...list[i] }, ...list.slice(i + 1)]);
              }}
              className={btnGhost}
              title="Duplikat baris (pengulangan)"
            >
              ⧉
            </button>
            <button
              type="button"
              onClick={() => setActiveEntries((variants[activeVariant]?.entries || []).filter((_, xi) => xi !== i))}
              className={btnGhost}
            >
              ✕
            </button>
          </div>
        ))}
        {!(variants[activeVariant]?.entries || []).length && (
          <p className="text-[11px] text-[#8C8880] italic">
            {variants[activeVariant] ? 'Varian kosong = full (mengikuti pool/teks). Tambah baris untuk urutan main sendiri.' : 'Pilih atau buat varian di atas.'}
          </p>
        )}
        <div className="flex gap-1.5 items-center">
          <ArrangementAdder
            poolNames={poolNames}
            onAdd={(section) => {
              if (!variants.length) {
                setVariants([{ name: 'Susunan', entries: [{ section, key: null, transpose: null }] }]);
                setActiveVariant(0);
                return;
              }
              setActiveEntries([...(variants[activeVariant]?.entries || []), { section, key: null, transpose: null }]);
            }}
          />
        </div>
      </div>

      <div className={tab === 'chord' ? 'space-y-1 font-mono' : 'hidden'}>
        <p className="text-[10px] text-[#8C8880] font-sans">Ketik chord di baris kosong di atas tiap lirik — tersimpan saat tombol Simpan ditekan, bukan per ketikan.</p>
        {chordRows.map((r) => {
          if (r.kind === 'header') {
            return <p key={r.key} className="text-[11px] font-black text-[#1B1B1B] pt-1">[{r.section}]</p>;
          }
          if (r.kind === 'blank') return <div key={r.key} className="h-2" />;
          return (
            <div key={r.key}>
              <input
                className="w-full px-2 py-0.5 text-[12px] font-bold text-sky-700 bg-sky-50/60 border border-dashed border-sky-200 rounded focus:outline-none focus:border-sky-500"
                placeholder="C   G   Am …"
                defaultValue={r.chord}
                onChange={(e) => commitChordRow(r.li, e.target.value)}
              />
              <p className="px-2 py-0.5 text-[12px] text-[#1B1B1B] whitespace-pre-wrap">{r.lyric}</p>
            </div>
          );
        })}
      </div>

      <div className={tab === 'nada' ? 'space-y-2' : 'hidden'}>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-[11px] font-bold text-[#8C8880]">Nada dasar tersimpan: <strong className="text-[#1B1B1B]">{baseKey || '—'}</strong></label>
          <select className={inputCls} style={{ maxWidth: 160 }} value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
            <option value="">Pratinjau kunci…</option>
            {PICKER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          {targetKey && baseKey && targetKey !== baseKey && (
            <span className="text-[11px] font-bold text-sky-700">+{steps} → {targetKey} (ditulis ulang saat Simpan)</span>
          )}
        </div>
        {!!steps && (
          <pre className="p-2.5 rounded-xl bg-[#1B1B1B] text-[#F5F3EE] text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-auto">
            {rewritten.split('\n').slice(0, 14).join('\n')}{rewritten.split('\n').length > 14 ? '\n…' : ''}
          </pre>
        )}
        {!steps && <p className="text-[11px] text-[#8C8880] italic">Pilih kunci tampil untuk pratinjau transpose seluruh lagu. Personal per pemusik tetap via <em>Chord saya</em> di setlist.</p>}
      </div>

      {!!errors.length && (
        <ul className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-0.5">
          {errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}
      {!!suspects.length && (
        <p className="text-[10px] text-amber-700">Periksa token: {suspects.join(', ')} (bukan chord dikenal — disimpan apa adanya).</p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={doSave} disabled={saving || !dirty || !!errors.length} className={btnDark}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {submitLabel || (initial ? 'Simpan perubahan' : 'Simpan lagu')}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={btnGhost}>Batal</button>
        {!dirty && <span className="text-[11px] text-[#8C8880] self-center">Tidak ada perubahan.</span>}
      </div>
    </div>
  );
};

const PoolAdder: React.FC<{ masterNames: string[]; pool: string[]; onAdd: (section: string) => void }> = ({ masterNames, pool, onAdd }) => {
  const rest = masterNames.filter((m) => !pool.some((p) => p.toLowerCase() === m.toLowerCase()));
  const [name, setName] = useState(rest[0] || '');
  const current = rest.includes(name) ? name : rest[0] || '';
  if (!rest.length) return <span className="text-[10px] text-[#8C8880]">Semua bagian teks sudah di pool.</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <select className="text-[11px] border border-[#D9D7D0] rounded-lg px-2 py-1 bg-white" value={current} onChange={(e) => setName(e.target.value)}>
        {rest.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <button type="button" onClick={() => current && onAdd(current)} className={btnGhost}>+ Tambah ke pool</button>
    </span>
  );
};

const ArrangementAdder: React.FC<{ poolNames: string[]; onAdd: (section: string) => void }> = ({ poolNames, onAdd }) => {
  const [name, setName] = useState(poolNames[0] || '');
  const current = poolNames.includes(name) ? name : poolNames[0] || '';
  return (
    <span className="inline-flex items-center gap-1.5">
      <select className="text-[11px] border border-[#D9D7D0] rounded-lg px-2 py-1 bg-white" value={current} onChange={(e) => setName(e.target.value)}>
        {poolNames.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <button type="button" onClick={() => current && onAdd(current)} className={btnGhost}>+ Tambah baris</button>
    </span>
  );
};

export default SongMasterEditor;
