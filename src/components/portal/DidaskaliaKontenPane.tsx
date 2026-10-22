import React, { useState } from 'react';
import { BookOpen, Copy, Info, Loader2, Plus, Presentation, RefreshCw, ShieldCheck, Wand2 } from 'lucide-react';
import { HOMILETIC_METHODS_DATA } from '../../data/homiletic-methods';
import {
  RHB_SECTIONS,
  bacaanMatchesKitab,
  citationsOutsideWeek,
  defaultSermon,
  ensureRhbSections,
  fieldOrigin,
  type DidaskaliaMethodMix,
  type DidaskaliaPath,
  type DidaskaliaRhbSection,
  type DidaskaliaSermon,
  type DidaskaliaSourceSnapshot,
  type DidaskaliaStudio,
} from '../../lib/didaskalia';
import { delivererLabel, sermonWithLiteralOutline } from '../../lib/didaskalia-presentation';
import { isFlowStale, readFlowBaseline, writeFlowBaseline } from '../../lib/flow-stale';
import { copyText } from '../../lib/rhb-caption';

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]';
const labelCls = 'text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1 block';

type EnDraft = { titleEn: string; summaryEn: string; bigIdeaEn: string };
type BibleCheck = {
  loading: boolean;
  error?: string;
  checks?: Array<{
    ref: string;
    parsed?: { book?: string; chapter?: number; verseStart?: number; verseEnd?: number };
    results?: Array<{ version?: string; text?: string; ablated?: boolean; attribution?: string; error?: string }>;
  }>;
};

function OriginBadge({ snap, value }: { snap?: string | null; value: string }) {
  const kind = fieldOrigin(value, snap);
  if (!kind) return null;
  const md = kind === 'md';
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${md ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
      {md ? 'dari MD' : 'diubah'}
    </span>
  );
}

function snapPath(snapshot: DidaskaliaSourceSnapshot | null | undefined, pathIndex: number) {
  return (snapshot?.paths || []).find((p) => Number(p.pathIndex) === pathIndex);
}

export const DidaskaliaKontenPane: React.FC<{
  canWrite: boolean;
  busy: string | null;
  studio: DidaskaliaStudio;
  paths: DidaskaliaPath[];
  ym: string;
  weekIndex: number;
  patternCode: string;
  serviceType?: string | null;
  enDraft: Record<string, EnDraft>;
  setEnDraft: React.Dispatch<React.SetStateAction<Record<string, EnDraft>>>;
  bibleCheck: BibleCheck | null;
  suggest: Record<string, { label: string; before: string; text: string }>;
  setPath: (i: number, patch: Partial<DidaskaliaPath>) => void;
  setRhbSection: (i: number, key: string, patch: Partial<DidaskaliaRhbSection>) => void;
  patchSermon: (recipe: (sermon: DidaskaliaSermon) => DidaskaliaSermon) => void;
  patchMeta: (patch: { chapterNo?: string; homileticMethods?: string[]; methodMix?: DidaskaliaMethodMix[]; fundamentalFirman?: { ref?: string; text?: string } }) => void;
  onNote: (pathIndex: number) => void;
  proposeTranslate: (target: 'path' | 'sermon', pathIndex?: number) => void;
  savePathTranslation: (i: number, pathIndex: number) => void;
  saveSermonTranslation: () => void;
  aiSuggest: (key: string, fieldLabel: string, current: string, scope?: string) => void;
  applySuggestion: (key: string, apply: (t: string) => void) => void;
  dismissSuggestion: (key: string) => void;
  verifyBibleVerses: () => void;
  looseSame: (a?: string, b?: string) => boolean;
  refreshFlow: () => void;
  runSermon: () => void;
  addToast: (t: { type: 'success' | 'error'; title: string }) => void;
}> = (props) => {
  const {
    canWrite, busy, studio, paths, ym, weekIndex, patternCode, serviceType,
    enDraft, setEnDraft, bibleCheck, suggest, setPath, setRhbSection, patchSermon, patchMeta,
    onNote, proposeTranslate, savePathTranslation, saveSermonTranslation, aiSuggest,
    applySuggestion, dismissSuggestion, verifyBibleVerses, looseSame, refreshFlow, runSermon, addToast,
  } = props;
  const [sel, setSel] = useState<number | 'khotbah'>(1);
  const snap = studio.sourceSnapshot;
  const sermon = studio.sermon || defaultSermon();

  const suggestionBox = (key: string, apply: (t: string) => void) => {
    const s = suggest[key];
    if (!s) return null;
    return (
      <div className="mt-1 rounded-xl border border-sky-200 bg-sky-50 p-2 space-y-1">
        <p className="text-[10px] font-black text-sky-800">Usulan AI · {s.label}</p>
        <p className="text-[10px] text-[#8C8880] line-through max-h-20 overflow-y-auto whitespace-pre-line">{s.before}</p>
        <p className="text-[11px] text-[#1B1B1B] max-h-40 overflow-y-auto whitespace-pre-line">{s.text}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => applySuggestion(key, apply)} className="text-[10px] font-bold text-white bg-sky-600 px-3 py-1 rounded-full">Terapkan</button>
          <button type="button" onClick={() => dismissSuggestion(key)} className="text-[10px] font-bold text-[#8C8880]">Batal</button>
        </div>
      </div>
    );
  };

  const pathIndex = typeof sel === 'number' ? sel : 1;
  const i = Math.max(0, paths.findIndex((p) => p.pathIndex === pathIndex));
  const p = paths[i] || paths[0];
  const pSnap = p ? snapPath(snap, p.pathIndex) : undefined;

  return (
    <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-3">
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-2 space-y-1 h-fit">
        {paths.map((row) => (
          <button
            key={row.pathIndex}
            type="button"
            onClick={() => setSel(row.pathIndex)}
            className={`w-full text-left rounded-xl px-2.5 py-2 border ${sel === row.pathIndex ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#1B1B1B] border-transparent hover:bg-[#FAF9F5]'}`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Path {row.pathIndex} · {row.dayLabel}</span>
            <span className="block text-xs font-bold truncate">{row.title || 'Tanpa judul'}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSel('khotbah')}
          className={`w-full text-left rounded-xl px-2.5 py-2 border ${sel === 'khotbah' ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#1B1B1B] border-transparent hover:bg-[#FAF9F5]'}`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Serving Day</span>
          <span className="block text-xs font-bold">Khotbah</span>
        </button>
      </div>

      {sel !== 'khotbah' && p && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0EA5E9]" />
            <h4 className="text-sm font-black text-[#1B1B1B]">Path {p.pathIndex} · {p.dayLabel}</h4>
            <button type="button" onClick={() => onNote(p.pathIndex)} className="ml-auto text-[10px] font-bold text-sky-700 border border-sky-200 bg-sky-50 rounded-full px-2 py-0.5">+ Catatan</button>
          </div>
          <p className="text-[11px] text-sky-900 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
            Kitab fokus sepekan{studio.kitabFokus ? `: ${studio.kitabFokus}` : ''}. Bacaan = porsi hari itu. Nats Pembimbing = ayat pengaya hari itu. Gambar harian ada di tab Gambar.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className={labelCls}>Judul Path <OriginBadge snap={pSnap?.title} value={p.title} /></label>
                <button type="button" disabled={!!busy || !canWrite} onClick={() => void proposeTranslate('path', p.pathIndex)} className="text-[10px] font-bold text-sky-700">Terjemahkan ke English</button>
              </div>
              <input value={p.title} onChange={(e) => setPath(i, { title: e.target.value })} className={inputCls} />
              {enDraft[`path:${p.pathIndex}`] && (
                <div className="mt-1 rounded-xl border border-sky-200 bg-sky-50 p-2 space-y-1">
                  <label className={labelCls}>Usulan judul English</label>
                  <input value={enDraft[`path:${p.pathIndex}`].titleEn} onChange={(e) => setEnDraft((s) => ({ ...s, [`path:${p.pathIndex}`]: { ...s[`path:${p.pathIndex}`], titleEn: e.target.value } }))} className={inputCls} />
                  <label className={labelCls}>Usulan ringkasan English</label>
                  <textarea value={enDraft[`path:${p.pathIndex}`].summaryEn} onChange={(e) => setEnDraft((s) => ({ ...s, [`path:${p.pathIndex}`]: { ...s[`path:${p.pathIndex}`], summaryEn: e.target.value } }))} rows={2} className={inputCls} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void savePathTranslation(i, p.pathIndex)} className="text-[10px] font-bold text-white bg-sky-600 px-3 py-1 rounded-full">Simpan terjemahan</button>
                    <button type="button" onClick={() => setEnDraft((s) => { const c = { ...s }; delete c[`path:${p.pathIndex}`]; return c; })} className="text-[10px] font-bold text-[#8C8880]">Batal</button>
                  </div>
                </div>
              )}
              {(p.titleEn || p.summaryEn) && !enDraft[`path:${p.pathIndex}`] && <p className="text-[10px] text-[#8C8880] mt-1">English: {p.titleEn || '—'}{p.summaryEn ? ` · ${p.summaryEn}` : ''}</p>}
            </div>
            <div><label className={labelCls}>Label Hari</label><input value={p.dayLabel} onChange={(e) => setPath(i, { dayLabel: e.target.value })} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Nats Pembimbing <OriginBadge snap={pSnap?.scriptureRef} value={p.scriptureRef} /></label>
              <input value={p.scriptureRef} onChange={(e) => setPath(i, { scriptureRef: e.target.value })} className={inputCls} />
            </div>
          </div>
          {!bacaanMatchesKitab(p.bacaanRef || '', studio.kitabFokus || '') && (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">Bacaan ini tampak di luar Kitab Fokus ({studio.kitabFokus || '—'}).</p>
          )}
          {(() => {
            const legacyEmpty = ![p.summary, p.bacaanRef, p.scriptureText, p.hookQuestion, p.illustration, p.reflection, p.observeQ, p.interpretQ, p.applyQ].some((v) => String(v || '').trim()) && !(p.fgdQuestions || []).length;
            const sectionsFilled = ensureRhbSections(p.rhbSections).some((s) => String(s.body || '').trim());
            return (
              <details open={!(legacyEmpty && sectionsFilled)} className="rounded-xl border border-[#E7E5DE] px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-bold text-[#5C5850]">Kolom path lama (opsional, tidak masuk hitungan Terbaca)</summary>
                <div className="mt-2 space-y-2">
                  <div><label className={labelCls}>Ringkasan Hari <OriginBadge snap={pSnap?.summary} value={p.summary || ''} /></label><input value={p.summary || ''} onChange={(e) => setPath(i, { summary: e.target.value })} placeholder="Gambaran besar hari itu" className={inputCls} /></div>
                  <div><label className={labelCls}>Bacaan Alkitab</label><input value={p.bacaanRef || ''} onChange={(e) => setPath(i, { bacaanRef: e.target.value })} placeholder={studio.kitabFokus ? `Porsi hari ini dari ${studio.kitabFokus}` : 'Porsi hari ini dari Kitab Fokus'} className={inputCls} /></div>
                  <div><label className={labelCls}>Teks Nats Pembimbing</label><textarea value={p.scriptureText} onChange={(e) => setPath(i, { scriptureText: e.target.value })} rows={2} className={inputCls} /></div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div><label className={labelCls}>Pertanyaan Pembuka</label><textarea value={p.hookQuestion} onChange={(e) => setPath(i, { hookQuestion: e.target.value })} rows={2} className={inputCls} /></div>
                    <div><label className={labelCls}>Ilustrasi</label><textarea value={p.illustration} onChange={(e) => setPath(i, { illustration: e.target.value })} rows={2} className={inputCls} /></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>Perenungan</label>
                      <button type="button" disabled={!!busy} onClick={() => void aiSuggest(`path:${i}:reflection`, 'Perenungan', p.reflection, `PATH:${p.pathIndex}`)} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"><Wand2 className="w-3 h-3" /> Haluskan teks</button>
                    </div>
                    <textarea value={p.reflection} onChange={(e) => setPath(i, { reflection: e.target.value })} rows={4} className={inputCls} />
                    {suggestionBox(`path:${i}:reflection`, (t) => setPath(i, { reflection: t }))}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <div><label className={labelCls}>Amati</label><input value={p.observeQ} onChange={(e) => setPath(i, { observeQ: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Pahami</label><input value={p.interpretQ} onChange={(e) => setPath(i, { interpretQ: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Terapkan</label><input value={p.applyQ} onChange={(e) => setPath(i, { applyQ: e.target.value })} className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Pertanyaan FGD</label><textarea value={(p.fgdQuestions || []).join('\n')} onChange={(e) => setPath(i, { fgdQuestions: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} rows={3} className={inputCls} /></div>
                </div>
              </details>
            );
          })()}
          <div>
            <label className={labelCls}>Jembatan <OriginBadge snap={pSnap?.bridge} value={p.bridge} /></label>
            <textarea value={p.bridge} onChange={(e) => setPath(i, { bridge: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div className="rounded-xl bg-[#F5FBFF] border border-sky-100 p-3 space-y-2">
            <p className="text-[11px] font-black text-sky-800">RHB harian — 5 bagian</p>
            {ensureRhbSections(p.rhbSections).map((sec) => (
              <div key={sec.key} className="rounded-lg bg-white border border-[#EFEDE8] p-2 space-y-1.5">
                <p className="text-[11px] font-bold text-[#1B1B1B] flex items-center gap-2">
                  {sec.title}
                  <OriginBadge snap={pSnap?.sections?.[sec.key]} value={sec.body} />
                </p>
                <textarea value={sec.body} onChange={(e) => setRhbSection(i, sec.key, { body: e.target.value })} rows={3} className={inputCls} />
              </div>
            ))}
            <p className="text-[10px] text-[#8C8880]">{RHB_SECTIONS.map((s) => s.title).join(' · ')}</p>
          </div>
        </div>
      )}

      {sel === 'khotbah' && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Presentation className="w-4 h-4 text-brand" />
            <h4 className="text-sm font-black text-[#1B1B1B]">Khotbah</h4>
            <p className="w-full text-[11px] text-[#8C8880]">Halaman Ringkasan Khotbah memakai teks utama dan empat bagian outline. Bila naskah sumber jauh lebih panjang dari ringkasan di kolom ini, halaman memakai naskah sumber. Inti pesan, kutipan ayat, ringkasan singkat, dan metode boleh kosong.</p>
          {canWrite && studio.sourceMd?.service?.outline && (
            <button
              type="button"
              onClick={() => {
                const next = sermonWithLiteralOutline(sermon, studio.sourceMd);
                patchSermon(() => next);
                addToast({ type: 'success', title: 'Empat bagian diisi dari naskah sumber. Simpan mengikuti otomatis.' });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D9D7D0] text-[11px] font-bold text-[#1B1B1B]"
            >
              <BookOpen className="w-3.5 h-3.5" /> Pulihkan dari naskah sumber
            </button>
          )}
            <button type="button" disabled={!canWrite || busy === 'sermon'} onClick={() => void runSermon()} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-bold disabled:opacity-50">
              {busy === 'sermon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />} Segarkan metode &amp; inti pesan
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Chapter <span className="font-bold normal-case tracking-normal text-[#8C8880]">opsional, tidak masuk Terbaca</span></label>
              <select value={studio.chapterNo || '0'} onChange={(e) => patchMeta({ chapterNo: e.target.value })} className={inputCls}>
                {Array.from({ length: 53 }, (_, n) => <option key={n} value={String(n)}>Chapter {n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kerangka Fundamental Firman <span className="font-bold normal-case tracking-normal text-[#8C8880]">opsional, tidak masuk Terbaca</span></label>
              <textarea value={studio.fundamentalFirman?.text || ''} onChange={(e) => patchMeta({ fundamentalFirman: { text: e.target.value } })} rows={2} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Metode khotbah</label>
            <div className="flex flex-wrap gap-1.5">
              {HOMILETIC_METHODS_DATA.map((m) => {
                const on = studio.homileticMethods?.includes(m.name);
                return (
                  <button key={m.name} type="button" onClick={() => {
                    const cur = studio.homileticMethods || [];
                    patchMeta({ homileticMethods: cur.includes(m.name) ? cur.filter((x) => x !== m.name) : [...cur, m.name] });
                  }} title={`${m.name} — ${m.short}`} className={`text-[11px] px-2.5 py-1 rounded-full border font-bold inline-flex items-center gap-1 ${on ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>
                    {m.name} <Info className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Analisa metode (%) <span className="font-bold normal-case tracking-normal text-[#8C8880]">opsional, tidak masuk Terbaca</span></label>
            <div className="space-y-1.5">
              {(studio.methodMix || []).map((row, mi) => (
                <div key={mi} className="flex flex-wrap items-center gap-1.5">
                  <select value={row.method} onChange={(e) => patchMeta({ methodMix: (studio.methodMix || []).map((x, xi) => xi === mi ? { ...x, method: e.target.value } : x) })} className={`${inputCls} flex-1 min-w-[140px]`}>
                    <option value="">Pilih metode…</option>
                    {HOMILETIC_METHODS_DATA.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                  <input type="number" min={0} max={100} value={row.percent} onChange={(e) => patchMeta({ methodMix: (studio.methodMix || []).map((x, xi) => xi === mi ? { ...x, percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x) })} className={`${inputCls} w-20`} />
                  <button type="button" onClick={() => patchMeta({ methodMix: (studio.methodMix || []).filter((_, xi) => xi !== mi) })} className="text-[10px] text-red-600 font-bold">Hapus</button>
                </div>
              ))}
              <button type="button" onClick={() => patchMeta({ methodMix: [...(studio.methodMix || []), { method: '', percent: 0, note: '' }] })} className="text-[11px] font-bold text-sky-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah metode</button>
            </div>
          </div>
          <div><label className={labelCls}>Metode (ringkas)</label><input value={(sermon.methods || []).join(', ')} onChange={(e) => patchSermon((s) => ({ ...s, methods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} className={inputCls} /></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Inti pesan <OriginBadge snap={snap?.sermon?.bigIdea} value={sermon.bigIdea || ''} /></label>
              <button type="button" disabled={!!busy || !canWrite} onClick={() => void proposeTranslate('sermon')} className="text-[10px] font-bold text-sky-700">Terjemahkan ke English</button>
            </div>
            <input value={sermon.bigIdea || ''} onChange={(e) => patchSermon((s) => ({ ...s, bigIdea: e.target.value }))} className={inputCls} />
            {enDraft.sermon && (
              <div className="mt-1 rounded-xl border border-sky-200 bg-sky-50 p-2 space-y-1">
                <label className={labelCls}>Usulan inti pesan English</label>
                <input value={enDraft.sermon.bigIdeaEn} onChange={(e) => setEnDraft((s) => ({ ...s, sermon: { ...s.sermon, bigIdeaEn: e.target.value } }))} className={inputCls} />
                <label className={labelCls}>Usulan ringkasan English</label>
                <textarea value={enDraft.sermon.summaryEn} onChange={(e) => setEnDraft((s) => ({ ...s, sermon: { ...s.sermon, summaryEn: e.target.value } }))} rows={3} className={inputCls} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => void saveSermonTranslation()} className="text-[10px] font-bold text-white bg-sky-600 px-3 py-1 rounded-full">Simpan terjemahan</button>
                  <button type="button" onClick={() => setEnDraft((s) => { const c = { ...s }; delete c.sermon; return c; })} className="text-[10px] font-bold text-[#8C8880]">Batal</button>
                </div>
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teks utama <OriginBadge snap={snap?.sermon?.teksUtamaRef} value={sermon.teksUtama?.ref || ''} /></label>
              <input value={sermon.teksUtama?.ref || ''} onChange={(e) => patchSermon((s) => ({ ...s, teksUtama: { ...(s.teksUtama || { ref: '', text: '' }), ref: e.target.value } }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kutipan singkat</label>
              <input value={sermon.teksUtama?.text || ''} onChange={(e) => patchSermon((s) => ({ ...s, teksUtama: { ...(s.teksUtama || { ref: '', text: '' }), text: e.target.value } }))} className={inputCls} />
            </div>
          </div>
          <div className="rounded-xl bg-[#F5FBFF] border border-sky-100 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
              <p className="text-[11px] font-black text-sky-800">Verifikasi Alkitab · TB + KJV + ESV</p>
              <button type="button" disabled={!canWrite || bibleCheck?.loading} onClick={() => void verifyBibleVerses()} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-[10px] font-bold disabled:opacity-50">
                {bibleCheck?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Verifikasi ayat
              </button>
            </div>
            {bibleCheck?.error && <p className="text-[11px] text-red-600">{bibleCheck.error}</p>}
            {(bibleCheck?.checks || []).map((c, ci) => {
              const normRef = (s?: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
              const want = [
                { ref: String(sermon.teksUtama?.ref || ''), text: sermon.teksUtama?.text || '' },
                { ref: String(studio.fundamentalFirman?.ref || ''), text: studio.fundamentalFirman?.text || '' },
              ];
              const dbText = want.find((w) => w.ref && normRef(w.ref) === normRef(c.ref))?.text ?? '';
              const tb = (c.results || []).find((x) => x.version === 'TB' && !x.error);
              const same = tb && !tb.ablated ? looseSame(tb.text, dbText) : null;
              return (
                <div key={`${c.ref}-${ci}`} className="rounded-lg bg-white border border-[#EFEDE8] p-2 space-y-1.5">
                  <p className="text-[11px] font-bold text-[#1B1B1B]">{c.ref || '(ref kosong)'}
                    {same === true && <span className="ml-2 text-[10px] font-bold text-emerald-700">Sesuai TB</span>}
                    {same === false && <span className="ml-2 text-[10px] font-bold text-amber-700">Beda dari TB</span>}
                  </p>
                  {tb?.text && !tb.ablated && (
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-[11px] text-[#1B1B1B]">TB: “{tb.text}”</p>
                      <button type="button" onClick={() => { void copyText(tb.text || '').then((ok) => addToast(ok ? { type: 'success', title: 'Kutipan TB disalin.' } : { type: 'error', title: 'Gagal menyalin.' })); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9D7D0] text-[10px] font-bold text-sky-700">
                        <Copy className="w-3 h-3" /> Salin
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {(Object.entries({
            pengantar: 'Pengantar',
            bedahTeologis: 'Bedah Teologis',
            jembatan: 'Jembatan',
            kesimpulan: 'Kesimpulan',
          }) as Array<[keyof DidaskaliaSermon['outline'], string]>).map(([key, label]) => (
            <div key={key}>
              <label className={labelCls}>{label} <OriginBadge snap={snap?.sermon?.outline?.[key]} value={sermon.outline?.[key] || ''} /></label>
              <textarea value={sermon.outline?.[key] || ''} onChange={(e) => patchSermon((s) => ({ ...s, outline: { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '', ...(s.outline || {}), [key]: e.target.value } }))} rows={key === 'kesimpulan' ? 3 : 4} className={inputCls} />
            </div>
          ))}
          <div><label className={labelCls}>Alasan metode</label><textarea value={sermon.rationale || ''} onChange={(e) => patchSermon((s) => ({ ...s, rationale: e.target.value }))} rows={2} className={inputCls} /></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Ringkasan <OriginBadge snap={snap?.sermon?.summary} value={sermon.summary || ''} /></label>
              <button type="button" disabled={!!busy} onClick={() => void aiSuggest('sermon:summary', 'Ringkasan Khotbah', sermon.summary || '', 'SERMON')} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"><Wand2 className="w-3 h-3" /> Haluskan teks</button>
            </div>
            <textarea value={sermon.summary || ''} onChange={(e) => patchSermon((s) => ({ ...s, summary: e.target.value }))} rows={5} className={inputCls} />
            {suggestionBox('sermon:summary', (t) => patchSermon((s) => ({ ...s, summary: t })))}
          </div>
          <div className="rounded-xl bg-[#FFF7F9] border border-rose-100 p-3 space-y-2">
            <p className="text-[11px] font-black text-rose-800">Bagian A · Untuk {delivererLabel(serviceType)}</p>
            <div className="flex items-center justify-between">
              <label className={labelCls}>Panduan deliver</label>
              <button type="button" onClick={() => patchSermon((s) => ({ ...s, deliveryPlan: [...(s.deliveryPlan || []), { method: '', how: '' }] }))} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah</button>
            </div>
            {(sermon.deliveryPlan || []).map((row, di) => (
              <div key={di} className="flex flex-wrap items-center gap-1.5">
                <input value={row.method} onChange={(e) => patchSermon((s) => ({ ...s, deliveryPlan: (s.deliveryPlan || []).map((x, xi) => xi === di ? { ...x, method: e.target.value } : x) }))} placeholder="Metode" className={`${inputCls} w-36`} />
                <input value={row.how} onChange={(e) => patchSermon((s) => ({ ...s, deliveryPlan: (s.deliveryPlan || []).map((x, xi) => xi === di ? { ...x, how: e.target.value } : x) }))} placeholder="Cara menyampaikan" className={`${inputCls} flex-1 min-w-[160px]`} />
                <button type="button" onClick={() => patchSermon((s) => ({ ...s, deliveryPlan: (s.deliveryPlan || []).filter((_, xi) => xi !== di) }))} className="text-[10px] text-red-600 font-bold">Hapus</button>
              </div>
            ))}
            <label className={labelCls}>Checklist persiapan</label>
            <textarea value={(sermon.prepChecklist || []).join('\n')} onChange={(e) => patchSermon((s) => ({ ...s, prepChecklist: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }))} rows={3} className={inputCls} />
          </div>
          <div className="rounded-xl bg-[#F5FBFF] border border-sky-100 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-sky-800">Bagian B · Mentor &amp; Co-Mentor</p>
              <button type="button" disabled={!canWrite || !!busy} onClick={() => void refreshFlow()} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-bold disabled:opacity-50">
                {busy === 'extras-refresh' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Segarkan Bagian A/B
              </button>
            </div>
            {isFlowStale(readFlowBaseline(ym, weekIndex), patternCode, (sermon.discussionFlow || []).length) && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">Pola {patternCode} berbeda dari alur yang tersimpan. Segarkan Bagian A/B atau sunting manual.</p>
            )}
            {(() => {
              const outside = citationsOutsideWeek((sermon.discussionFlow || []).join('\n'), [
                sermon.teksUtama?.ref || '',
                studio.kitabFokus || '',
                studio.fundamentalFirman?.ref || '',
              ]);
              if (!outside.length) return null;
              return (
                <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                  Alur menyebut {outside.join(', ')}. Ayat pekan ini: {[sermon.teksUtama?.ref, studio.kitabFokus].filter(Boolean).join(' · ') || 'belum diisi'}. Sunting manual. Bukan salah baca parser.
                </p>
              );
            })()}
            <label className={labelCls}>Alur FGD hari Minggu</label>
            <textarea value={(sermon.discussionFlow || []).join('\n')} onChange={(e) => { patchSermon((s) => ({ ...s, discussionFlow: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })); writeFlowBaseline(ym, weekIndex, patternCode); }} rows={4} className={inputCls} />
          </div>
          <p className="text-[11px] text-[#8C8880]">Gambar bagian khotbah dibuat di tab Gambar.</p>
        </div>
      )}
    </div>
  );
};
