import React, { useState } from 'react';
import { FileText, Loader2, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import {
  RHB_SECTIONS,
  defaultSermon,
  defaultStudio,
  ensurePaths,
  ensureRhbSections,
  type DidaskaliaStudio,
} from '../../lib/didaskalia';
import { blobToBase64 } from '../../lib/didaskaliaPdf';

type Toast = { type: 'success' | 'error' | 'warning'; title: string; description?: string };
type ChangeRow = { kind?: string; location?: string; before?: string; after?: string; note?: string };
type NormalizeOut = {
  normalized?: string;
  changes?: ChangeRow[];
  missing?: string[];
  warnings?: string[];
  ok?: boolean;
};
type RhbPath = {
  pathIndex: number;
  title?: string;
  scriptureRef?: string;
  bridge?: string;
  sections?: Record<string, string>;
};
type ServiceInfo = { teksUtama?: string; kitabFokus?: string; chapterNo?: string; tema?: string };

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]';
const STEPS = ['Impor', 'Rapikan & cek', 'Parse', 'Perkaya (opsional)', 'Setujui HOD', 'Terbitkan'];

async function readJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

export const DidaskaliaSourceImport: React.FC<{
  canWrite: boolean;
  canApprove: boolean;
  ym: string;
  weekIndex: number;
  studio: DidaskaliaStudio;
  busy: string | null;
  setBusy: (b: string | null) => void;
  save: (patch?: Partial<DidaskaliaStudio>, opts?: { silent?: boolean }) => Promise<DidaskaliaStudio | null>;
  onStudio: (studio: DidaskaliaStudio) => void;
  downloadPembekalan: (studio: DidaskaliaStudio) => Promise<void>;
  addToast: (t: Toast) => void;
}> = ({ canWrite, canApprove, ym, weekIndex, studio, busy, setBusy, save, onStudio, downloadPembekalan, addToast }) => {
  const [rhbText, setRhbText] = useState('');
  const [serviceText, setServiceText] = useState('');
  const [review, setReview] = useState<{ kind: 'rhb' | 'service'; normalized: string; changes: ChangeRow[]; missing: string[]; warnings: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signoff = studio.sourceSignoff?.status;

  const loadFile = async (file: File | undefined, kind: 'rhb' | 'service') => {
    if (!file || !canWrite) return;
    setBusy('extract');
    setNotice(null);
    try {
      const data = await blobToBase64(file);
      const r = await fetch('/api/didaskalia/extract-text', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(String(d.error || 'Gagal membaca berkas.'));
      const text = String(d.text || '');
      if (kind === 'rhb') setRhbText(text);
      else setServiceText(text);
      addToast({ type: 'success', title: `${file.name} terbaca — rapikan atau langsung parse` });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal membaca berkas.' });
    } finally {
      setBusy(null);
    }
  };

  const rapikan = async (kind: 'rhb' | 'service') => {
    const content = kind === 'rhb' ? rhbText : serviceText;
    if (!content.trim()) {
      setNotice(kind === 'rhb' ? 'Tempel atau unggah naskah RHB dulu.' : 'Tempel atau unggah naskah Serving Day dulu.');
      return;
    }
    setBusy(`norm-${kind}`);
    setNotice(null);
    try {
      const r = await fetch('/api/didaskalia/normalize-md', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: kind === 'rhb' ? 'rhb' : 'service', content }),
      });
      const d = await readJson(r) as NormalizeOut & { error?: string };
      if (!r.ok) throw new Error(String(d.error || 'Gagal merapikan.'));
      setReview({
        kind,
        normalized: String(d.normalized || content),
        changes: Array.isArray(d.changes) ? d.changes : [],
        missing: Array.isArray(d.missing) ? d.missing.map(String) : [],
        warnings: Array.isArray(d.warnings) ? d.warnings.map(String) : [],
      });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal merapikan.' });
    } finally {
      setBusy(null);
    }
  };

  const acceptReview = () => {
    if (!review) return;
    if (review.kind === 'rhb') setRhbText(review.normalized);
    else setServiceText(review.normalized);
    setNotice('Teks rapikan dipakai di kotak. Lanjut Parse bila sudah cocok.');
    setReview(null);
  };

  const parseAndApply = async () => {
    if (!canWrite) return;
    if (!rhbText.trim() && !serviceText.trim()) {
      setNotice('Tempel minimal satu naskah: RHB 7 Path atau Serving Day.');
      return;
    }
    if (studio.pendingRegen && String(studio.pendingRegen.status || '').toUpperCase() === 'PENDING') {
      if (!window.confirm('Ada pengajuan draf/perkaya yang belum diputuskan. Terapkan naskah sumber? Pengajuan itu tidak dihapus.')) return;
    }
    setBusy('parse-apply');
    setNotice(null);
    try {
      let rhb: { paths?: RhbPath[]; missing?: string[]; warnings?: string[] } | null = null;
      let svc: { info?: ServiceInfo; outline?: Record<string, string>; missing?: string[] } | null = null;
      const warnings: string[] = [];
      if (rhbText.trim()) {
        const r = await fetch('/api/didaskalia/parse-md', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'rhb-full', content: rhbText }),
        });
        const d = await readJson(r);
        if (!r.ok) throw new Error(String(d.error || 'Gagal parse RHB.'));
        rhb = d as typeof rhb;
        warnings.push(...(Array.isArray(d.missing) ? d.missing.map((x) => `RHB: ${x}`) : []));
        warnings.push(...(Array.isArray(d.warnings) ? d.warnings.map(String) : []));
      }
      if (serviceText.trim()) {
        const r = await fetch('/api/didaskalia/parse-md', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'service', content: serviceText }),
        });
        const d = await readJson(r);
        if (!r.ok) throw new Error(String(d.error || 'Gagal parse Serving Day.'));
        svc = d as typeof svc;
        warnings.push(...(Array.isArray(d.missing) ? d.missing.map((x) => `Service: ${x}`) : []));
      }

      const byIndex = new Map<number, RhbPath>((rhb?.paths || []).map((p) => [Number(p.pathIndex), p]));
      const paths = ensurePaths(studio).map((p) => {
        const src = byIndex.get(Number(p.pathIndex));
        if (!src) return p;
        const secs = ensureRhbSections(p.rhbSections).map((s) => {
          const v = String(src.sections?.[s.key] || '').trim();
          return v ? { ...s, body: v } : s;
        });
        return {
          ...p,
          title: String(src.title || '').trim() || p.title,
          scriptureRef: String(src.scriptureRef || '').trim() || p.scriptureRef,
          bridge: String(src.bridge || '').trim() || p.bridge,
          rhbSections: secs,
        };
      });

      const sm = studio.sermon || defaultSermon();
      const outline = { ...sm.outline };
      for (const key of ['pengantar', 'bedahTeologis', 'jembatan', 'kesimpulan'] as const) {
        const v = String(svc?.outline?.[key] || '').trim();
        if (v) outline[key] = v;
      }
      const teksRef = String(svc?.info?.teksUtama || '').trim();
      const sermon = {
        ...sm,
        teksUtama: { ...sm.teksUtama, ref: teksRef || sm.teksUtama?.ref || '' },
        outline,
      };
      const kitab = String(svc?.info?.kitabFokus || '').trim();
      let chapterNo = studio.chapterNo;
      const chapterMatch = String(svc?.info?.chapterNo || '').match(/(\d+)/);
      if (chapterMatch && (!chapterNo || chapterNo === '0')) chapterNo = chapterMatch[1];

      const prevMd = studio.sourceMd || { service: null, rhb: null };
      const sourceMd = {
        ...prevMd,
        ...(svc ? { service: { info: svc.info || {}, outline: svc.outline || {}, rawLength: serviceText.length } } : {}),
        ...(rhb?.paths?.length
          ? {
            rhb: {
              paths: rhb.paths.map((p) => ({
                pathIndex: Number(p.pathIndex),
                title: String(p.title || ''),
                scriptureRef: String(p.scriptureRef || ''),
                summary: '',
                bridge: String(p.bridge || ''),
              })),
            },
          }
          : {}),
      };

      const saved = await save({
        paths,
        sermon,
        sourceMd,
        ...(kitab ? { kitabFokus: kitab } : {}),
        ...(chapterNo && chapterNo !== studio.chapterNo ? { chapterNo } : {}),
      }, { silent: true });
      if (!saved) return;

      const sign = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/source-signoff`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });
      const sd = await readJson(sign);
      const published = sd.week && typeof sd.week === 'object'
        ? { ...defaultStudio(), ...((sd.week as { studio?: DidaskaliaStudio }).studio || {}) }
        : saved;
      if (sign.ok) onStudio(published);
      else addToast({ type: 'warning', title: String(sd.error || 'Naskah tersimpan, pengajuan HOD gagal.') });

      setNotice(warnings.length
        ? `Yang terbaca diterapkan. Periksa: ${warnings.slice(0, 8).join(' · ')}${warnings.length > 8 ? ' …' : ''}`
        : 'Naskah sumber diterapkan. Bisa disetujui HOD dan diterbitkan tanpa Perkaya.');
      addToast({
        type: warnings.length ? 'warning' : 'success',
        title: warnings.length ? 'Parse sebagian — yang terbaca sudah masuk studio' : 'Naskah sumber diterapkan',
        description: 'PDF Pembekalan diunduh dari naskah yang tersimpan.',
      });
      await downloadPembekalan(sign.ok ? published : saved);
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal parse.' });
    } finally {
      setBusy(null);
    }
  };

  const approveSource = async () => {
    if (!canApprove) return;
    setBusy('source-approve');
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/source-signoff`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(String(d.error || 'Gagal menyetujui.'));
      const week = d.week as { studio?: DidaskaliaStudio } | undefined;
      if (week?.studio) onStudio({ ...defaultStudio(), ...week.studio });
      addToast({ type: 'success', title: 'Naskah sumber disetujui — siap terbit tanpa Perkaya' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyetujui.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="w-4 h-4 text-sky-700" />
        <p className="text-[11px] font-black text-[#1B1B1B]">Naskah sumber</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${signoff === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : signoff === 'PENDING' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>
          {signoff === 'APPROVED' ? 'HOD setujui' : signoff === 'PENDING' ? 'Menunggu HOD' : 'Belum diajukan'}
        </span>
      </div>
      <p className="text-[11px] text-sky-950">
        Impor → Rapikan &amp; cek → Parse sudah cukup untuk PDF dan terbit. <b>Perkaya dengan diskusi</b> opsional dan bisa dijalankan kapan saja, bukan syarat setujui atau terbit.
      </p>
      <div className="flex flex-wrap gap-1">
        {STEPS.map((s) => (
          <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-sky-100 text-sky-900">{s}</span>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">RHB 7 Path</p>
          <textarea value={rhbText} onChange={(e) => setRhbText(e.target.value)} rows={6} disabled={!canWrite} placeholder="Tempel teks PDF/MD. Label Nats Pembimbing, Nas Pembimbing, atau Ayat Renungan sama-sama terbaca. Judul boleh Bahasa Indonesia." className={`${inputCls} font-mono disabled:opacity-60`} />
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D9D7D0] bg-white text-[11px] font-bold cursor-pointer">
              {busy === 'extract' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Unggah PDF/MD
              <input type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain" className="hidden" disabled={!canWrite || !!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void loadFile(f, 'rhb'); }} />
            </label>
            <button type="button" disabled={!canWrite || !!busy} onClick={() => void rapikan('rhb')} className="px-3 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 text-[11px] font-bold disabled:opacity-50">
              {busy === 'norm-rhb' ? 'Merapikan…' : 'Rapikan & cek'}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Serving Day</p>
          <textarea value={serviceText} onChange={(e) => setServiceText(e.target.value)} rows={6} disabled={!canWrite} placeholder="Tempel teks PDF/MD. Kitab Fundamental = Teks Utama. Kitab Bagian Fokus = kitab fokus. Fondasi Teologis = Pengantar." className={`${inputCls} font-mono disabled:opacity-60`} />
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D9D7D0] bg-white text-[11px] font-bold cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Unggah PDF/MD
              <input type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain" className="hidden" disabled={!canWrite || !!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void loadFile(f, 'service'); }} />
            </label>
            <button type="button" disabled={!canWrite || !!busy} onClick={() => void rapikan('service')} className="px-3 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 text-[11px] font-bold disabled:opacity-50">
              {busy === 'norm-service' ? 'Merapikan…' : 'Rapikan & cek'}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#8C8880]">Rapikan menyusun format, ejaan, dan usulan bahasa inklusif. Ayat tidak diubah. Boleh dilewati: Parse membaca teks yang ada di kotak.</p>
      {review && (
        <div className="rounded-xl bg-white border border-sky-200 p-3 space-y-2">
          <p className="text-[11px] font-black text-[#1B1B1B]">Usulan rapikan · {review.kind === 'rhb' ? 'RHB' : 'Serving Day'}</p>
          {review.changes.length === 0 && <p className="text-[11px] text-[#8C8880]">Tidak ada butir perubahan tercatat. Tetap tinjau teks di bawah.</p>}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {review.changes.map((c, i) => (
              <div key={i} className={`rounded-lg px-2 py-1 text-[10px] ${c.kind === 'inklusi' ? 'bg-amber-50 border border-amber-200' : 'bg-[#FAF9F5]'}`}>
                <b>{c.kind || 'ubah'}</b>{c.location ? ` · ${c.location}` : ''} {c.note || ''}
                {c.before ? <span className="block text-[#8C8880] line-through">{c.before}</span> : null}
                {c.after ? <span className="block">{c.after}</span> : null}
              </div>
            ))}
          </div>
          {(review.missing.length > 0 || review.warnings.length > 0) && (
            <p className="text-[10px] text-amber-800">{[...review.warnings, ...review.missing].slice(0, 6).join(' · ')}</p>
          )}
          <textarea value={review.normalized} onChange={(e) => setReview({ ...review, normalized: e.target.value })} rows={8} className={`${inputCls} font-mono`} />
          <div className="flex gap-2">
            <button type="button" onClick={acceptReview} className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-bold">Pakai teks ini</button>
            <button type="button" onClick={() => setReview(null)} className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880]">Buang usulan</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!canWrite || !!busy} onClick={() => void parseAndApply()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
          {busy === 'parse-apply' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Parse &amp; terapkan
        </button>
        {canApprove && signoff !== 'APPROVED' && (
          <button type="button" disabled={!!busy} onClick={() => void approveSource()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
            {busy === 'source-approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Setujui HOD
          </button>
        )}
        {signoff === 'APPROVED' && studio.sourceSignoff?.decidedByName && (
          <span className="text-[10px] text-emerald-800">Disetujui {studio.sourceSignoff.decidedByName}</span>
        )}
      </div>
      <p className="text-[10px] text-[#5C5850]">Yang kurang tetap masuk sebagai peringatan. Bagian yang terbaca ditulis ke 7 Path dan outline. PDF Pembekalan diunduh dari salinan yang sudah disimpan. Section RHB yang dikenali: {RHB_SECTIONS.map((s) => s.title).join(', ')}.</p>
      {notice && <p className="text-[11px] text-sky-950 bg-white border border-sky-100 rounded-xl px-3 py-2">{notice}</p>}
    </div>
  );
};
