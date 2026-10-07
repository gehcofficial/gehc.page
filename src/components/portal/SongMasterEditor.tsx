import React, { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import {
  PICKER_KEYS,
  SECTION_TEMPLATES,
  applyChordLine,
  chordLyricPairs,
  compileChordOverLyrics,
  findSuspectChords,
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
  arrangement: ArrangementEntry[] | null;
  story: string;
  meaning: string;
};

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
  const [arrangement, setArrangement] = useState<ArrangementEntry[]>(() =>
    normalizeArrangement(initial?.arrangement ?? null) || []);
  const [targetKey, setTargetKey] = useState('');
  const [snapshot] = useState(() => JSON.stringify({
    meta: initial ? {
      title: initial.title || '', source: initial.source || 'LOKAL', sourceRef: initial.sourceRef || '',
      sourceUrl: initial.sourceUrl || '', authors: initial.authors || '', copyright: initial.copyright || '',
      ccli: initial.ccli || '', defaultKey: initial.defaultKey || '',
      story: initial.story || '', meaning: initial.meaning || '',
    } : blankMeta(),
    lyrics: initial?.lyricsChordPro || '',
    arrangement: normalizeArrangement(initial?.arrangement ?? null) || [],
    baseKey: initial?.defaultKey || '',
  }));

  const masterNames = useMemo(() => parseSections(lyrics).map((s) => s.name), [lyrics]);
  const baseKey = (meta.defaultKey || '').trim();
  const steps = targetKey && baseKey ? transposeSteps(baseKey, targetKey) : 0;
  const rewritten = steps ? transposeChordPro(lyrics, steps) : lyrics;

  const snap = useMemo(() => JSON.parse(snapshot) as {
    meta: typeof meta; lyrics: string; arrangement: ArrangementEntry[]; baseKey: string;
  }, [snapshot]);
  const keyChange = targetKey !== '' && targetKey !== baseKey;
  const dirty = JSON.stringify({ meta, lyrics, arrangement }) !== JSON.stringify({
    meta: snap.meta, lyrics: snap.lyrics, arrangement: snap.arrangement,
  }) || keyChange;

  const unknownSections = useMemo(() => {
    const known = new Set<string>(masterNames.map((s) => s.toLowerCase()));
    const names: string[] = arrangement.map((e) => e.section);
    return [...new Set<string>(names)].filter((s: string) => !known.has(s.toLowerCase()));
  }, [arrangement, masterNames]);

  const suspects = useMemo(() => findSuspectChords(lyrics), [lyrics]);
  const isSecular = meta.source === 'SEKULER';
  const errors: string[] = [];
  if (!meta.title.trim()) errors.push('Judul lagu wajib.');
  if (isSecular && lyrics.trim()) errors.push('Lirik lagu sekuler tidak disimpan — kosongkan lirik.');
  if (unknownSections.length) errors.push(`Susunan memuat bagian tak dikenal: ${unknownSections.join(', ')}.`);

  const commitChordRow = (li: number, chordText: string) => {
    const lines = lyrics.split('\n');
    if (li < 0 || li >= lines.length) return;
    lines[li] = applyChordLine(lines[li], chordText);
    setLyrics(lines.join('\n'));
  };

  const moveEntry = (i: number, dir: -1 | 1) => {
    const next = [...arrangement];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setArrangement(next);
  };

  const applyPreset = (pick: RegExp[]) => {
    const names = pick.map((re) => masterNames.find((m) => re.test(m)));
    if (names.some((n) => !n)) return;
    setArrangement((names as string[]).map((section) => ({ section, key: null, transpose: null })));
  };

  const doSave = () => {
    if (errors.length || saving) return;
    const finalLyrics = steps && targetKey ? transposeChordPro(lyrics, steps) : lyrics;
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
      arrangement: arrangement.length ? arrangement : null,
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

      <div className={tab === 'susunan' ? 'space-y-1.5' : 'hidden'}>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-bold text-[#8C8880]">Preset:</span>
          <button type="button" onClick={() => setArrangement([])} className={btnGhost} title="Kosong = full master berurutan">Full master</button>
          {ARR_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p.pick)} className={btnGhost}>{p.label}</button>
          ))}
        </div>
        {!arrangement.length && (
          <p className="text-[11px] text-[#8C8880] italic">Mengikuti full master ({masterNames.join(' → ') || '—'}). Tambah baris untuk urutan main sendiri.</p>
        )}
        {arrangement.map((e, i) => (
          <div key={`${e.section}-${i}`} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white border border-[#D9D7D0]/60 px-2 py-1">
            <span className="text-[10px] font-black text-[#8C8880] w-5">{i + 1}</span>
            <span className="text-[11px] font-bold text-[#1B1B1B]">[{e.section}]</span>
            <select
              className="text-[10px] border border-[#D9D7D0] rounded-lg px-1 py-0.5 bg-white"
              title="Modulasi mulai baris ini"
              value={e.key || ''}
              onChange={(ev) => setArrangement(arrangement.map((x, xi) => (xi === i ? { ...x, key: ev.target.value || null } : x)))}
            >
            <option value="">Ikut nada</option>
            {PICKER_KEYS.map((k) => <option key={k} value={k}>Mod → {k}</option>)}
            </select>
            <span className="flex-1" />
            <button type="button" onClick={() => moveEntry(i, -1)} className={btnGhost}>↑</button>
            <button type="button" onClick={() => moveEntry(i, 1)} className={btnGhost}>↓</button>
            <button
              type="button"
              onClick={() => setArrangement([...arrangement.slice(0, i + 1), { ...arrangement[i] }, ...arrangement.slice(i + 1)])}
              className={btnGhost}
              title="Duplikat baris (pengulangan)"
            >
              ⧉
            </button>
            <button type="button" onClick={() => setArrangement(arrangement.filter((_, xi) => xi !== i))} className={btnGhost}>✕</button>
          </div>
        ))}
        <div className="flex gap-1.5 items-center">
          <ArrangementAdder masterNames={masterNames} onAdd={(section) => setArrangement([...arrangement, { section, key: null, transpose: null }])} />
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

const ArrangementAdder: React.FC<{ masterNames: string[]; onAdd: (section: string) => void }> = ({ masterNames, onAdd }) => {
  const [name, setName] = useState(masterNames[0] || '');
  const current = masterNames.includes(name) ? name : masterNames[0] || '';
  return (
    <span className="inline-flex items-center gap-1.5">
      <select className="text-[11px] border border-[#D9D7D0] rounded-lg px-2 py-1 bg-white" value={current} onChange={(e) => setName(e.target.value)}>
        {masterNames.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <button type="button" onClick={() => current && onAdd(current)} className={btnGhost}>+ Tambah baris</button>
    </span>
  );
};

export default SongMasterEditor;
