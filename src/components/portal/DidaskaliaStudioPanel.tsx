import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Sparkles,
  Save,
  FileText,
  Download,
  Upload,
  Calendar,
  Link2,
  Plus,
  Copy,
  Wand2,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronRight,
  Presentation,
  BookOpen,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  HOMILETIC_METHODS,
  RITUAL_LABELS,
  RITUAL_TYPES,
  defaultStudio,
  ensurePaths,
  hashContent,
  needsRepublish,
  statusLabel,
  type DidaskaliaPath,
  type DidaskaliaStudio,
  type RitualType,
} from '../../lib/didaskalia';
import { blobToBase64, buildKhutbahPdf, buildPembekalanPdf, buildRhbPdfs } from '../../lib/didaskaliaPdf';

type WeekMeta = { index: number; date: string; theme?: string; mentoringTheme?: string; servingTheme?: string };
type RitualRow = { type: RitualType; date: string; timeStart: string; timeEnd: string; status: string; notes?: string; meetUrl?: string };

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthOptions() {
  const base = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(base.getFullYear(), base.getMonth() + i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { ym, label };
  });
}
function sundaysOfMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === m - 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}
function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]';
const labelCls = 'text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1 block';

export const DidaskaliaStudioPanel: React.FC = () => {
  const { addToast, currentRole, isKomisi, isBodTimkerja, isDidaskalia } = useApp();
  const canWrite = isKomisi || currentRole === 'SUPERADMIN' || isBodTimkerja || isDidaskalia;

  const [tab, setTab] = useState<'konten' | 'jadwal'>('konten');
  const [ym, setYm] = useState(currentYearMonth());
  const [weekIndex, setWeekIndex] = useState(1);
  const [coverage, setCoverage] = useState(4);

  const months = useMemo(() => monthOptions().slice(0, coverage), [coverage]);
  const weeksInMonth = useMemo(() => sundaysOfMonth(ym), [ym]);

  const [studio, setStudio] = useState<DidaskaliaStudio>(defaultStudio());
  const [weekMeta, setWeekMeta] = useState<WeekMeta | null>(null);
  const [event, setEvent] = useState<{ id: string; name: string; serviceType?: string | null } | null>(null);
  const [links, setLinks] = useState<Array<{ refId: string; label: string; url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState<number | null>(1);
  const [comment, setComment] = useState('');
  const paths = useMemo(() => ensurePaths(studio), [studio]);

  const [schedule, setSchedule] = useState<{ weeks: Array<WeekMeta & { rituals: RitualRow[] }>; theme: string } | null>(null);
  const [schedBusy, setSchedBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat studio.');
      setStudio({ ...defaultStudio(), ...(d.week?.studio || {}) });
      setWeekMeta({ index: d.week?.index, date: d.week?.date, theme: d.week?.theme, mentoringTheme: d.week?.mentoringTheme, servingTheme: d.week?.servingTheme });
      setEvent(d.event || null);
      setLinks(d.links || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat.');
    } finally {
      setLoading(false);
    }
  }, [ym, weekIndex]);

  useEffect(() => { void load(); }, [load]);

  const loadSchedule = useCallback(async () => {
    try {
      const r = await fetch(`/api/didaskalia/schedule/${ym}`, { credentials: 'include' });
      const d = await r.json();
      if (r.ok) {
        setSchedule({ weeks: d.weeks || [], theme: d.theme || '' });
        setLinks(d.links || []);
      }
    } catch { /* abaikan */ }
  }, [ym]);

  useEffect(() => { if (tab === 'jadwal') void loadSchedule(); }, [tab, loadSchedule]);

  const save = useCallback(async (patch?: Partial<DidaskaliaStudio>) => {
    if (!canWrite) return;
    const payload = { ...studio, ...(patch || {}) };
    setSaving(true);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio: payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal simpan.');
      setStudio({ ...defaultStudio(), ...(d.week?.studio || {}) });
      addToast({ type: 'success', title: 'Studio tersimpan' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal simpan.' });
    } finally {
      setSaving(false);
    }
  }, [addToast, canWrite, studio, weekIndex, ym]);

  const runAi = useCallback(async (kind: 'draft' | 'sermon') => {
    if (!canWrite) return;
    await save(); // jangan buang edit terakhir
    setBusy(kind);
    setError(null);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/${kind}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methods: studio.homileticMethods, notes: comment || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'AI gagal.');
      setStudio({ ...defaultStudio(), ...(d.week?.studio || {}) });
      addToast({ type: 'success', title: kind === 'draft' ? 'Draf 7 Path & ringkasan dibuat' : 'Ringkasan khotbah dibuat' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI gagal.');
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'AI gagal.' });
    } finally {
      setBusy(null);
    }
  }, [addToast, canWrite, comment, save, studio.homileticMethods, weekIndex, ym]);

  const aiRefine = useCallback(async (fieldLabel: string, current: string, apply: (text: string) => void) => {
    if (!canWrite || !current.trim()) return;
    setBusy(`refine-${fieldLabel}`);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel, current, instruction: comment || 'Buat lebih jelas, hangat, dan mudah dipahami pemuda.', context: weekMeta?.theme || '' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'AI gagal memperbaiki.');
      apply(d.text || current);
      addToast({ type: 'success', title: 'Diusulkan AI — periksa lalu Simpan' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'AI gagal.' });
    } finally {
      setBusy(null);
    }
  }, [addToast, canWrite, comment, weekIndex, weekMeta, ym]);

  const setPath = (i: number, patch: Partial<DidaskaliaPath>) => {
    setStudio((s) => {
      const next = ensurePaths(s).map((p, idx) => (idx === i ? { ...p, ...patch } : p));
      return { ...s, paths: next };
    });
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    const entry = { id: `c-${Date.now()}`, text: comment.trim(), at: new Date().toISOString(), resolved: false };
    const discussion = [...(studio.discussion || []), entry];
    setComment('');
    await save({ discussion });
  };

  const uploadToDrive = async (files: Array<{ filename: string; blob: Blob; pathIndex?: number }>, subfolder: string) => {
    if (!event?.id) throw new Error('Belum ada event ibadah untuk minggu ini. Buat dulu di Ibadah Mingguan.');
    const uploaded: Array<{ name: string; driveFileId: string; pathIndex?: number }> = [];
    for (const f of files) {
      const data = await blobToBase64(f.blob);
      const r = await fetch(`/api/events/${event.id}/divisions/DIDASKALIA/drive/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.filename, mimetype: 'application/pdf', data, subfolder }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal upload ke Drive.');
      uploaded.push({ name: f.filename, driveFileId: d.file?.id, pathIndex: f.pathIndex });
    }
    return uploaded;
  };

  const download = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateDoc = useCallback(async (doc: 'pembekalan' | 'khutbah' | 'rhb', mode: 'download' | 'upload') => {
    if (!weekMeta) return;
    const opts = { version: (studio.render?.[doc]?.version || 0) + 1 };
    const week = { index: weekMeta.index, date: weekMeta.date, mentoringTheme: weekMeta.mentoringTheme, servingTheme: weekMeta.servingTheme, theme: weekMeta.theme, studio };
    setBusy(`pdf-${doc}`);
    try {
      if (doc === 'pembekalan') {
        const { filename, blob } = buildPembekalanPdf(week, studio, opts);
        if (mode === 'download') download(filename, blob);
        else {
          const uploaded = await uploadToDrive([{ filename, blob }], '01 Pembekalan Mentor - Co mentor');
          await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/publish`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc, version: opts.version, files: uploaded, hash: hashContent({ chapterNo: studio.chapterNo, fundamentalFirman: studio.fundamentalFirman, kitabFokus: studio.kitabFokus, paths: studio.paths }), driveFolder: '01 Pembekalan Mentor - Co mentor' }) });
        }
      } else if (doc === 'khutbah') {
        const { filename, blob } = buildKhutbahPdf(week, studio, opts);
        if (mode === 'download') download(filename, blob);
        else {
          const uploaded = await uploadToDrive([{ filename, blob }], '02 Ringkasan Khotbah');
          await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/publish`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc, version: opts.version, files: uploaded, hash: hashContent({ fundamentalFirman: studio.fundamentalFirman, kitabFokus: studio.kitabFokus, sermon: studio.sermon }), driveFolder: '02 Ringkasan Khotbah' }) });
        }
      } else {
        const docs = buildRhbPdfs(week, studio, opts);
        if (!docs.length) throw new Error('7 Path belum ada.');
        if (mode === 'download') docs.forEach((d) => download(d.filename, d.blob));
        else {
          const uploaded = await uploadToDrive(docs, '03 RHB 7 Hari');
          await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/publish`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc, version: opts.version, files: uploaded, hash: hashContent({ chapterNo: studio.chapterNo, fundamentalFirman: studio.fundamentalFirman, kitabFokus: studio.kitabFokus, paths: studio.paths }), driveFolder: '03 RHB 7 Hari' }) });
        }
      }
      await load();
      addToast({ type: 'success', title: mode === 'download' ? 'PDF diunduh' : 'PDF terbit ke Drive' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal generate PDF.' });
    } finally {
      setBusy(null);
    }
  }, [addToast, load, studio, weekIndex, weekMeta, ym]);

  const generateSchedule = async () => {
    setSchedBusy(true);
    try {
      const r = await fetch(`/api/didaskalia/schedule/${ym}/generate`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal generate jadwal.');
      await loadSchedule();
      addToast({ type: 'success', title: 'Jadwal ritual dibuat' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal generate jadwal.' });
    } finally {
      setSchedBusy(false);
    }
  };

  const saveLinks = async () => {
    setSchedBusy(true);
    try {
      const r = await fetch('/api/didaskalia/ritual-links', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal simpan link.');
      setLinks(d.links || []);
      addToast({ type: 'success', title: 'Link Meet tersimpan' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal simpan link.' });
    } finally {
      setSchedBusy(false);
    }
  };

  const toggleMethod = (m: string) => {
    setStudio((s) => {
      const cur = s.homileticMethods || [];
      return { ...s, homileticMethods: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] };
    });
  };

  const pdfButton = (doc: 'pembekalan' | 'khutbah' | 'rhb', label: string, icon: React.ReactNode) => (
    <div className="flex items-stretch gap-1.5">
      <button type="button" disabled={!!busy} onClick={() => void generateDoc(doc, 'upload')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-bold disabled:opacity-50">
        {busy === `pdf-${doc}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}{label}
      </button>
      <button type="button" title="Unduh saja" disabled={!!busy} onClick={() => void generateDoc(doc, 'download')} className="px-2.5 rounded-xl border border-[#D9D7D0] text-[#8C8880] hover:text-[#1B1B1B] disabled:opacity-50"><Download className="w-3.5 h-3.5" /></button>
      {needsRepublish(studio, doc) && <span className="self-center text-[10px] font-bold text-amber-600">belum rilis ulang</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header kontrol */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#0EA5E9]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Studio Didaskalia</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold">{statusLabel(studio.status)}</span>
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => setTab('konten')} className={`text-[11px] px-3 py-1.5 rounded-full font-bold border ${tab === 'konten' ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>Konten & 7 Path</button>
            <button type="button" onClick={() => setTab('jadwal')} className={`text-[11px] px-3 py-1.5 rounded-full font-bold border ${tab === 'jadwal' ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>Jadwal & Meet</button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelCls}>Bulan</label>
            <select value={ym} onChange={(e) => { setYm(e.target.value); setWeekIndex(1); }} className={inputCls}>
              {months.map((m) => <option key={m.ym} value={m.ym}>{m.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setCoverage((c) => (c >= 6 ? 4 : c + 2))} className="text-[10px] px-2 py-2 rounded-xl border border-[#D9D7D0] font-bold text-[#8C8880]">+ bulan</button>
          <div>
            <label className={labelCls}>Minggu</label>
            <select value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))} className={inputCls}>
              {weeksInMonth.map((d, i) => <option key={d} value={i + 1}>W{i + 1} · {fmtDate(d)}</option>)}
            </select>
          </div>
          <div className="text-[11px] text-[#8C8880]">
            {event ? <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Event: {event.name}</span> : <span className="text-amber-600">Belum ada event ibadah minggu ini</span>}
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => void save()} disabled={!canWrite || saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
            </button>
          </div>
        </div>
        {!canWrite && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mode baca — hanya Komisi/Tim Kerja/Didaskalia yang dapat mengubah.</p>}
        {error && <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat studio…</p>
      ) : tab === 'konten' ? (
        <>
          {/* Input inti */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Chapter</label>
                <input value={studio.chapterNo} onChange={(e) => setStudio((s) => ({ ...s, chapterNo: e.target.value }))} placeholder="Chapter 0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fundamental Firman (ayat)</label>
                <input value={studio.fundamentalFirman?.ref || ''} onChange={(e) => setStudio((s) => ({ ...s, fundamentalFirman: { ...s.fundamentalFirman, ref: e.target.value } }))} placeholder="Matius 16:18" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kitab / Bagian Fokus</label>
                <input value={studio.kitabFokus} onChange={(e) => setStudio((s) => ({ ...s, kitabFokus: e.target.value }))} placeholder="Kisah Para Rasul 2:41-47" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Teks Fundamental Firman</label>
              <textarea value={studio.fundamentalFirman?.text || ''} onChange={(e) => setStudio((s) => ({ ...s, fundamentalFirman: { ...s.fundamentalFirman, text: e.target.value } }))} rows={2} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Metode Khotbah (pilih / biarkan AI memilih)</label>
              <div className="flex flex-wrap gap-1.5">
                {HOMILETIC_METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => toggleMethod(m)} className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${studio.homileticMethods?.includes(m) ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>{m}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" disabled={!canWrite || !!busy} onClick={() => void runAi('draft')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold disabled:opacity-50">
                {busy === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Susun draf 7 Path + khotbah
              </button>
              <button type="button" disabled={!canWrite || !!busy} onClick={() => void runAi('sermon')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
                {busy === 'sermon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />} Ringkasan Khotbah
              </button>
            </div>
          </div>

          {/* Editor 7 Path */}
          <div className="space-y-2">
            {paths.map((p, i) => {
              const open = expandedPath === p.pathIndex;
              return (
                <div key={p.pathIndex} className="bg-white rounded-2xl border border-[#D9D7D0]/60 overflow-hidden">
                  <button type="button" onClick={() => setExpandedPath(open ? null : p.pathIndex)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#FAF9F5]">
                    {open ? <ChevronDown className="w-4 h-4 text-[#8C8880]" /> : <ChevronRight className="w-4 h-4 text-[#8C8880]" />}
                    <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white text-[11px] font-black grid place-items-center">{p.pathIndex}</span>
                    <span className="text-sm font-bold text-[#1B1B1B] truncate">{p.title}</span>
                    <span className="ml-auto text-[10px] text-[#8C8880]">{p.dayLabel}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-2 border-t border-[#EFEDE8]">
                      <div className="grid sm:grid-cols-2 gap-2 pt-3">
                        <div><label className={labelCls}>Judul Path</label><input value={p.title} onChange={(e) => setPath(i, { title: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Label Hari</label><input value={p.dayLabel} onChange={(e) => setPath(i, { dayLabel: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Ayat</label><input value={p.scriptureRef} onChange={(e) => setPath(i, { scriptureRef: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Lensa Khotbah</label><input value={(p.homileticLens || []).join(', ')} onChange={(e) => setPath(i, { homileticLens: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className={inputCls} /></div>
                      </div>
                      <div><label className={labelCls}>Teks Nats</label><textarea value={p.scriptureText} onChange={(e) => setPath(i, { scriptureText: e.target.value })} rows={2} className={inputCls} /></div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <div><label className={labelCls}>Pertanyaan Pembuka</label><textarea value={p.hookQuestion} onChange={(e) => setPath(i, { hookQuestion: e.target.value })} rows={2} className={inputCls} /></div>
                        <div><label className={labelCls}>Ilustrasi</label><textarea value={p.illustration} onChange={(e) => setPath(i, { illustration: e.target.value })} rows={2} className={inputCls} /></div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={labelCls}>Perenungan</label>
                          <button type="button" disabled={!!busy} onClick={() => void aiRefine('Perenungan', p.reflection, (t) => setPath(i, { reflection: t }))} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"><Wand2 className="w-3 h-3" /> AI</button>
                        </div>
                        <textarea value={p.reflection} onChange={(e) => setPath(i, { reflection: e.target.value })} rows={4} className={inputCls} />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <div><label className={labelCls}>Amati</label><input value={p.observeQ} onChange={(e) => setPath(i, { observeQ: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Pahami</label><input value={p.interpretQ} onChange={(e) => setPath(i, { interpretQ: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Terapkan</label><input value={p.applyQ} onChange={(e) => setPath(i, { applyQ: e.target.value })} className={inputCls} /></div>
                      </div>
                      <div><label className={labelCls}>Pertanyaan FGD (pisahkan dengan enter)</label><textarea value={(p.fgdQuestions || []).join('\n')} onChange={(e) => setPath(i, { fgdQuestions: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} rows={3} className={inputCls} /></div>
                      <div><label className={labelCls}>Jembatan ke Path Berikutnya</label><textarea value={p.bridge} onChange={(e) => setPath(i, { bridge: e.target.value })} rows={2} className={inputCls} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Ringkasan Khotbah + slide */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Presentation className="w-4 h-4 text-[#FF416C]" />
              <h4 className="text-sm font-black text-[#1B1B1B]">Ringkasan Khotbah & Kerangka Slide</h4>
            </div>
            <div><label className={labelCls}>Metode</label><input value={(studio.sermon?.methods || []).join(', ')} onChange={(e) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, methods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } }))} className={inputCls} /></div>
            <div><label className={labelCls}>Alasan Pemilihan Metode</label><textarea value={studio.sermon?.rationale || ''} onChange={(e) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, rationale: e.target.value } }))} rows={2} className={inputCls} /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Ringkasan</label>
                <button type="button" disabled={!!busy} onClick={() => void aiRefine('Ringkasan Khotbah', studio.sermon?.summary || '', (t) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, summary: t } })))} className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"><Wand2 className="w-3 h-3" /> AI</button>
              </div>
              <textarea value={studio.sermon?.summary || ''} onChange={(e) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, summary: e.target.value } }))} rows={5} className={inputCls} />
            </div>
            <div className="space-y-2">
              {(studio.sermon?.slideOutline || []).map((sl, si) => (
                <div key={si} className="rounded-xl border border-[#EFEDE8] p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#8C8880]">SLIDE {si + 1}</span>
                    <input value={sl.title} onChange={(e) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, slideOutline: s.sermon.slideOutline.map((x, xi) => xi === si ? { ...x, title: e.target.value } : x) } }))} className={`${inputCls} flex-1`} />
                    <button type="button" onClick={() => setStudio((s) => ({ ...s, sermon: { ...s.sermon, slideOutline: s.sermon.slideOutline.filter((_, xi) => xi !== si) } }))} className="text-[10px] text-red-600 font-bold">Hapus</button>
                  </div>
                  <textarea value={(sl.bullets || []).join('\n')} onChange={(e) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, slideOutline: s.sermon.slideOutline.map((x, xi) => xi === si ? { ...x, bullets: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean) } : x) } }))} rows={2} placeholder="Poin-poin slide" className={inputCls} />
                  <input value={sl.visualNote} onChange={(e) => setStudio((s) => ({ ...s, sermon: { ...s.sermon, slideOutline: s.sermon.slideOutline.map((x, xi) => xi === si ? { ...x, visualNote: e.target.value } : x) } }))} placeholder="Arahan visual" className={inputCls} />
                </div>
              ))}
              <button type="button" onClick={() => setStudio((s) => ({ ...s, sermon: { ...s.sermon, slideOutline: [...(s.sermon?.slideOutline || []), { title: 'Slide baru', bullets: [], visualNote: '' }] } }))} className="text-[11px] font-bold text-sky-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah slide</button>
            </div>
          </div>

          {/* Diskusi */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-[#0EA5E9]" /><h4 className="text-sm font-black text-[#1B1B1B]">Diskusi Internal</h4></div>
            <div className="space-y-2">
              {(studio.discussion || []).map((c) => (
                <div key={c.id} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] px-3 py-2">
                  <p className="text-xs text-[#1B1B1B] whitespace-pre-wrap">{c.text}</p>
                  <p className="text-[10px] text-[#8C8880] mt-1">{new Date(c.at).toLocaleString('id-ID')}</p>
                </div>
              ))}
              {(studio.discussion || []).length === 0 && <p className="text-[11px] text-[#8C8880] italic">Belum ada catatan diskusi.</p>}
            </div>
            <div className="flex gap-2">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Tulis catatan/usulan untuk tim…" className={inputCls} />
              <button type="button" onClick={() => void addComment()} disabled={!canWrite || !comment.trim()} className="px-3 rounded-xl bg-[#1B1B1B] text-white disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Generate PDF */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#0EA5E9]" /><h4 className="text-sm font-black text-[#1B1B1B]">Terbitkan Dokumen</h4></div>
            <div className="flex flex-wrap gap-3">
              {pdfButton('pembekalan', 'Modul Pembekalan (01)', <Upload className="w-3.5 h-3.5" />)}
              {pdfButton('khutbah', 'Ringkasan Khotbah (02)', <Upload className="w-3.5 h-3.5" />)}
              {pdfButton('rhb', 'RHB 7 Hari (03)', <Upload className="w-3.5 h-3.5" />)}
            </div>
            <p className="text-[11px] text-[#8C8880]">Tombol biru mengunggah ke Drive event minggu ini. Ikon unduh menyimpan PDF saja. RHB menghasilkan 7 file terpisah (Senin–Sabtu, plus hari ke-7).</p>
            {(Object.entries(studio.render || {}) as Array<[string, import('../../lib/didaskalia').DidaskaliaRenderMeta | undefined]>).map(([doc, meta]) => meta && (
              <p key={doc} className="text-[11px] text-[#8C8880]">
                <span className="font-bold text-[#1B1B1B] uppercase">{doc}</span> v{meta.version} · {meta.files?.length || 0} file · {meta.renderedAt ? new Date(meta.renderedAt).toLocaleDateString('id-ID') : ''}
              </p>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Jadwal */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0EA5E9]" />
              <h4 className="text-sm font-black text-[#1B1B1B]">Jadwal Ritual Mingguan</h4>
              <button type="button" disabled={!canWrite || schedBusy} onClick={() => void generateSchedule()} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
                {schedBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Generate dari rencana bulan
              </button>
            </div>
            <p className="text-[11px] text-[#8C8880]">Pola: Internal Sync (Senin/Selasa), Serving Group Briefing (Rabu/Kamis, hanya minggu Serving), General Equipping (Jumat/Sabtu).</p>
            <div className="space-y-2">
              {(schedule?.weeks || []).map((wk) => (
                <div key={wk.index} className="rounded-xl border border-[#EFEDE8] p-3">
                  <p className="text-xs font-black text-[#1B1B1B]">W{wk.index} · {fmtDate(wk.date)} {wk.theme ? `· ${wk.theme}` : ''}</p>
                  <div className="mt-2 space-y-1.5">
                    {(wk.rituals || []).length === 0 && <p className="text-[11px] text-[#8C8880] italic">Belum di-generate.</p>}
                    {(wk.rituals || []).map((r) => (
                      <div key={r.type} className="flex flex-wrap items-center gap-2 text-[11px] bg-[#FAF9F5] rounded-lg px-2.5 py-1.5">
                        <span className="font-bold text-[#1B1B1B]">{RITUAL_LABELS[r.type as RitualType] || r.type}</span>
                        <span className="text-[#8C8880]">{fmtDate(r.date)} · {r.timeStart}–{r.timeEnd} WIB</span>
                        {r.meetUrl ? (
                          <>
                            <a href={r.meetUrl} target="_blank" rel="noreferrer" className="font-bold text-sky-700">Join Meet</a>
                            <button type="button" onClick={() => { navigator.clipboard?.writeText(r.meetUrl || ''); addToast({ type: 'success', title: 'Link Meet disalin' }); }} className="inline-flex items-center gap-1 text-[#8C8880]"><Copy className="w-3 h-3" /> Salin</button>
                          </>
                        ) : <span className="text-amber-600">Link Meet belum diatur</span>}
                        <a href={`/api/didaskalia/ritual/${ym}/${wk.index}/${r.type}/ics`} className="ml-auto font-bold text-[#8C8880] hover:text-[#1B1B1B]">.ics</a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!schedule?.weeks?.length && <p className="text-[11px] text-[#8C8880] italic">Belum ada jadwal. Klik Generate.</p>}
            </div>
          </div>

          {/* Link Meet tetap */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-[#0EA5E9]" /><h4 className="text-sm font-black text-[#1B1B1B]">Link Google Meet Tetap</h4></div>
            <div className="grid sm:grid-cols-3 gap-3">
              {RITUAL_TYPES.map((t) => {
                const refId = { INTERNAL_SYNC: 'SYNC', SERVING_BRIEFING: 'SERVING', GENERAL_EQUIPPING: 'EQUIP' }[t];
                const row = links.find((l) => l.refId === refId) || { refId, label: RITUAL_LABELS[t], url: '' };
                return (
                  <div key={refId}>
                    <label className={labelCls}>{RITUAL_LABELS[t]}</label>
                    <input value={row.url} onChange={(e) => setLinks((ls) => {
                      const others = ls.filter((l) => l.refId !== refId);
                      return [...others, { refId, label: RITUAL_LABELS[t], url: e.target.value }];
                    })} placeholder="https://meet.google.com/…" className={inputCls} />
                  </div>
                );
              })}
            </div>
            <button type="button" disabled={!canWrite || schedBusy} onClick={() => void saveLinks()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">Simpan link</button>
          </div>
        </>
      )}
    </div>
  );
};
