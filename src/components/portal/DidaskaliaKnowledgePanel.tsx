import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Upload, FileText, BookOpen } from 'lucide-react';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  type DidaskaliaKnowledge,
} from '../../lib/didaskalia';
import { useApp } from '../../context/AppContext';

type Props = { canWrite: boolean };

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1';
const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#FF416C]';

/** Pengelolaan knowledge base + instruksi khusus tim untuk AI Didaskalia (Gems-like). */
export const DidaskaliaKnowledgePanel: React.FC<Props> = ({ canWrite }) => {
  const { addToast } = useApp();
  const [docs, setDocs] = useState<DidaskaliaKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [maxChars, setMaxChars] = useState(12000);
  const [draft, setDraft] = useState({ title: '', category: 'FORMAT', content: '' });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([
        fetch('/api/didaskalia/knowledge?all=1', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { knowledge: [] })),
        fetch('/api/didaskalia/ai-config', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { config: {} })),
      ]);
      setDocs(k.knowledge || []);
      setInstruction(c.config?.instruction || '');
      setMaxChars(c.config?.maxKnowledgeChars || 12000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addDoc = async () => {
    if (!draft.title.trim() || !draft.content.trim()) return;
    setBusy('new');
    try {
      const r = await fetch('/api/didaskalia/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...draft, source: 'MANUAL' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menambah dokumen.');
      setDraft({ title: '', category: 'FORMAT', content: '' });
      await load();
      addToast({ type: 'success', title: 'Dokumen pengetahuan ditambahkan' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menambah dokumen.' });
    } finally {
      setBusy(null);
    }
  };

  const uploadFile = async (file: File | null | undefined) => {
    if (!file) return;
    const ok = /\.(md|markdown|txt)$/i.test(file.name);
    if (!ok) { addToast({ type: 'error', title: 'Hanya berkas .md atau .txt' }); return; }
    setBusy('upload');
    try {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '').slice(0, 200) || 'Dokumen';
      const r = await fetch('/api/didaskalia/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, content, category: 'REFERENSI', source: 'UPLOAD', fileName: file.name }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengunggah.');
      await load();
      addToast({ type: 'success', title: `Berkas "${file.name}" ditambahkan` });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal mengunggah.' });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleActive = async (d: DidaskaliaKnowledge) => {
    setBusy(d.id);
    try {
      await fetch(`/api/didaskalia/knowledge/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !d.isActive }),
      });
      await load();
    } finally { setBusy(null); }
  };

  const removeDoc = async (d: DidaskaliaKnowledge) => {
    setBusy(d.id);
    try {
      await fetch(`/api/didaskalia/knowledge/${d.id}`, { method: 'DELETE', credentials: 'include' });
      await load();
      addToast({ type: 'success', title: 'Dokumen dihapus' });
    } finally { setBusy(null); }
  };

  const saveConfig = async () => {
    setBusy('config');
    try {
      const r = await fetch('/api/didaskalia/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instruction, maxKnowledgeChars: maxChars }),
      });
      if (!r.ok) throw new Error('Gagal menyimpan instruksi.');
      addToast({ type: 'success', title: 'Instruksi tim disimpan' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally { setBusy(null); }
  };

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat pengetahuan…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Instruksi khusus tim */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#0EA5E9]" />
          <h4 className="text-sm font-black text-[#1B1B1B]">Instruksi Khusus Tim</h4>
          <span className="text-[10px] text-[#8C8880]">dibaca AI di atas gaya bawaan</span>
        </div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={4}
          disabled={!canWrite}
          placeholder="mis. Selalu mulai eksposisi dari konteks historis; hindari istilah teknis tanpa penjelasan; dahulukan ilustrasi dunia kerja…"
          className={inputCls}
        />
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelCls}>Batas karakter pengetahuan</label>
            <input type="number" min={1000} max={60000} step={1000} value={maxChars} onChange={(e) => setMaxChars(Number(e.target.value) || 12000)} disabled={!canWrite} className={`${inputCls} w-32`} />
          </div>
          <button type="button" onClick={() => void saveConfig()} disabled={!canWrite || busy === 'config'} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
            {busy === 'config' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan instruksi
          </button>
        </div>
      </div>

      {/* Daftar dokumen */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0EA5E9]" />
          <h4 className="text-sm font-black text-[#1B1B1B]">Pengetahuan Tim</h4>
          <span className="text-[10px] text-[#8C8880]">{docs.filter((d) => d.isActive).length} aktif / {docs.length}</span>
          {canWrite && (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
                {busy === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Unggah .md/.txt
              </button>
              <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => void uploadFile(e.target.files?.[0])} />
            </>
          )}
        </div>

        {docs.length === 0 && <p className="text-xs text-[#8C8880] italic">Belum ada dokumen pengetahuan.</p>}
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#FAF9F5] ${d.isActive ? '' : 'opacity-50'}`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">{KNOWLEDGE_CATEGORY_LABELS[d.category] || d.category}</span>
              <span className="text-sm font-bold text-[#1B1B1B] flex-1 min-w-[160px] truncate">{d.title}</span>
              <span className="text-[10px] text-[#8C8880]">{d.content.length.toLocaleString('id-ID')} char{d.fileName ? ` · ${d.fileName}` : ''}</span>
              {canWrite && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void toggleActive(d)} disabled={busy === d.id} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-[#D9D7D0] text-[#8C8880] disabled:opacity-40">{d.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button type="button" onClick={() => void removeDoc(d)} disabled={busy === d.id} className="p-1.5 rounded-lg hover:bg-white text-red-500 disabled:opacity-40" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {canWrite && (
          <div className="rounded-2xl border border-dashed border-[#D9D7D0] p-3 space-y-2">
            <p className="text-[11px] font-bold text-[#5C5850]">Tambah dokumen (tempel teks)</p>
            <div className="grid sm:grid-cols-[1fr_180px] gap-2">
              <input value={draft.title} onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))} placeholder="Judul dokumen" className={inputCls} />
              <select value={draft.category} onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))} className={inputCls}>
                {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{KNOWLEDGE_CATEGORY_LABELS[c] || c}</option>)}
              </select>
            </div>
            <textarea value={draft.content} onChange={(e) => setDraft((s) => ({ ...s, content: e.target.value }))} rows={5} placeholder="Isi markdown/teks…" className={inputCls} />
            <button type="button" onClick={() => void addDoc()} disabled={busy === 'new' || !draft.title.trim() || !draft.content.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-bold disabled:opacity-40">
              {busy === 'new' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah dokumen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DidaskaliaKnowledgePanel;
