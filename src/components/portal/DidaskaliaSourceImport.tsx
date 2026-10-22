import React, { useState } from 'react';
import { FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { BibleRefPicker } from './BibleRefPicker';
import {
  RHB_SECTIONS,
  defaultSermon,
  defaultStudio,
  ensurePaths,
  ensureRhbSections,
  SOURCE_CHECKLIST_NOTE,
  sourceChecklist,
  type DidaskaliaSourceSnapshot,
  type DidaskaliaStudio,
} from '../../lib/didaskalia';
import { blobToBase64 } from '../../lib/didaskaliaPdf';
import { MD_MENTORING_DAY_LABEL } from '../../lib/md-mentoring-day';

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
const STEPS = ['Empat sumber', 'Rapikan & cek', 'Parse'];

async function readJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

export const DidaskaliaSourceImport: React.FC<{
  canWrite: boolean;
  ym: string;
  weekIndex: number;
  studio: DidaskaliaStudio;
  busy: string | null;
  setBusy: (b: string | null) => void;
  onScripture: (patch: { teksUtama?: string; kitabFokus?: string }) => void;
  commitSumber: (sumber: Record<string, unknown>) => Promise<boolean>;
  onStudio: (studio: DidaskaliaStudio) => void;
  downloadPembekalan: (studio: DidaskaliaStudio) => Promise<void>;
  addToast: (t: Toast) => void;
}> = ({ canWrite, ym, weekIndex, studio, busy, setBusy, onScripture, commitSumber, onStudio, downloadPembekalan, addToast }) => {
  const [rhbText, setRhbText] = useState('');
  const [serviceText, setServiceText] = useState('');
  const [review, setReview] = useState<{ kind: 'rhb' | 'service'; normalized: string; changes: ChangeRow[]; missing: string[]; warnings: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signoff = studio.sourceSignoff?.status;
  const locked = busy === 'extract' || busy === 'norm-rhb' || busy === 'norm-service' || busy === 'parse-apply';

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
      else {
        setServiceText(text);
        void peekScripture(text);
      }
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
      setNotice(kind === 'rhb' ? 'Tempel atau unggah naskah RHB dulu.' : `Tempel atau unggah naskah ${MD_MENTORING_DAY_LABEL} dulu.`);
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

  const peekScripture = async (service: string) => {
    if (!service.trim()) return;
    try {
      const r = await fetch('/api/didaskalia/parse-md', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'service', content: service }),
      });
      const d = await readJson(r);
      if (!r.ok) return;
      const info = (d.info || {}) as { teksUtama?: string; kitabFokus?: string };
      const teksUtama = String(info.teksUtama || '').trim();
      const kitabFokus = String(info.kitabFokus || '').trim();
      if (teksUtama || kitabFokus) onScripture({ teksUtama: teksUtama || undefined, kitabFokus: kitabFokus || undefined });
    } catch {
      /* ayat tetap diisi manual */
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
      setNotice(`Tempel minimal satu naskah: RHB 7 Path atau ${MD_MENTORING_DAY_LABEL}.`);
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
        if (!r.ok) throw new Error(String(d.error || `Gagal parse ${MD_MENTORING_DAY_LABEL}.`));
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

      const snapshot: DidaskaliaSourceSnapshot = {
        kitabFundamental: String(studio.fundamentalFirman?.ref || '').trim(),
        kitabFokus: kitab || studio.kitabFokus || '',
        paths: paths.map((p) => ({
          pathIndex: p.pathIndex,
          title: p.title,
          scriptureRef: p.scriptureRef,
          summary: p.summary,
          bridge: p.bridge,
          sections: Object.fromEntries(ensureRhbSections(p.rhbSections).map((s) => [s.key, s.body])),
        })),
        sermon: {
          teksUtamaRef: sermon.teksUtama?.ref || '',
          outline: { ...sermon.outline },
        },
      };
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

      const ok = await commitSumber({
        paths,
        sermon,
        sourceMd,
        sourceSnapshot: snapshot,
        ...(kitab ? { kitabFokus: kitab } : {}),
        ...(teksRef ? { teksUtama: { ref: teksRef } } : {}),
        ...(chapterNo && chapterNo !== studio.chapterNo ? { chapterNo } : {}),
      });
      if (!ok) return;
      const saved: DidaskaliaStudio = {
        ...defaultStudio(),
        ...studio,
        paths,
        sermon,
        sourceMd,
        kitabFokus: kitab || studio.kitabFokus,
        chapterNo,
        sourceSnapshot: snapshot,
      };

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
      onStudio(sign.ok ? published : saved);
      if (!sign.ok) addToast({ type: 'warning', title: String(sd.error || 'Naskah tersimpan, pengajuan HOD gagal.') });

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

  const checks = sourceChecklist(studio);
  const missing = checks.filter((c) => !c.ok);

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
        Empat masukan ini saja. Teks Utama di MD mengisi teks utama khotbah. Kitab Bagian Fokus terisi sendiri dan tidak disalin ke kerangka fundamental. Rapikan lalu Parse. Perkaya tetap opsional di tab Diskusi.
      </p>
      <div className="flex flex-wrap gap-1">
        {STEPS.map((s) => (
          <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-sky-100 text-sky-900">{s}</span>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1">Teks Utama</p>
          <BibleRefPicker
            value={studio.sermon?.teksUtama?.ref || ''}
            disabled={!canWrite}
            onChange={(ref) => onScripture({ teksUtama: ref })}
          />
          <p className="text-[10px] text-[#8C8880] mt-1">Teks utama khotbah. Terisi otomatis bila {MD_MENTORING_DAY_LABEL} memuatnya.</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1">Kitab Bagian Fokus</p>
          <BibleRefPicker
            value={studio.kitabFokus || ''}
            disabled={!canWrite}
            onChange={(ref) => onScripture({ kitabFokus: ref })}
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">RHB 7 Path</p>
          <textarea value={rhbText} onChange={(e) => setRhbText(e.target.value)} rows={6} disabled={!canWrite} placeholder="Tempel teks PDF/MD. Label Nats Pembimbing, Nas Pembimbing, atau Ayat Renungan sama-sama terbaca. Judul boleh Bahasa Indonesia." className={`${inputCls} font-mono disabled:opacity-60`} />
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D9D7D0] bg-white text-[11px] font-bold cursor-pointer">
              {busy === 'extract' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Unggah PDF/MD
              <input type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain" className="hidden" disabled={!canWrite || locked} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void loadFile(f, 'rhb'); }} />
            </label>
            <button type="button" disabled={!canWrite || locked} onClick={() => void rapikan('rhb')} className="px-3 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 text-[11px] font-bold disabled:opacity-50">
              {busy === 'norm-rhb' ? 'Merapikan…' : 'Rapikan & cek'}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">{MD_MENTORING_DAY_LABEL}</p>
          <textarea value={serviceText} onChange={(e) => setServiceText(e.target.value)} onBlur={() => void peekScripture(serviceText)} rows={6} disabled={!canWrite} placeholder="Tempel teks PDF/MD. Teks Utama mengisi kolom teks utama. Kitab Bagian Fokus terisi sendiri. Fondasi Teologis = Pengantar." className={`${inputCls} font-mono disabled:opacity-60`} />
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D9D7D0] bg-white text-[11px] font-bold cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Unggah PDF/MD
              <input type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain" className="hidden" disabled={!canWrite || locked} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void loadFile(f, 'service'); }} />
            </label>
            <button type="button" disabled={!canWrite || locked} onClick={() => void rapikan('service')} className="px-3 py-1.5 rounded-xl bg-white border border-sky-300 text-sky-800 text-[11px] font-bold disabled:opacity-50">
              {busy === 'norm-service' ? 'Merapikan…' : 'Rapikan & cek'}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#8C8880]">Rapikan menyusun format, ejaan, dan usulan bahasa inklusif. Ayat tidak diubah. Boleh dilewati: Parse membaca teks yang ada di kotak.</p>
      {review && (
        <div className="rounded-xl bg-white border border-sky-200 p-3 space-y-2">
          <p className="text-[11px] font-black text-[#1B1B1B]">Usulan rapikan · {review.kind === 'rhb' ? 'RHB' : MD_MENTORING_DAY_LABEL}</p>
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
        <button type="button" disabled={!canWrite || locked} onClick={() => void parseAndApply()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
          {busy === 'parse-apply' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Parse &amp; terapkan
        </button>
        {signoff === 'APPROVED' && studio.sourceSignoff?.decidedByName && (
          <span className="text-[10px] text-emerald-800">Disetujui {studio.sourceSignoff.decidedByName}</span>
        )}
      </div>
      <p className="text-[10px] text-[#5C5850]">Yang kurang tetap masuk sebagai peringatan. Bagian yang terbaca ditulis ke 7 Path dan outline. PDF Pembekalan diunduh dari salinan yang sudah disimpan. Section RHB yang dikenali: {RHB_SECTIONS.map((s) => s.title).join(', ')}.</p>
      {notice && <p className="text-[11px] text-sky-950 bg-white border border-sky-100 rounded-xl px-3 py-2">{notice}</p>}
      <div className="rounded-xl bg-white border border-sky-100 p-2">
        <p className="text-[11px] font-black text-[#1B1B1B]">Terbaca {checks.length - missing.length}/{checks.length} bagian naskah</p>
        <p className="text-[10px] text-[#5C5850]">{SOURCE_CHECKLIST_NOTE}</p>
        {missing.length === 0 ? (
          <p className="text-[10px] text-emerald-700">Bagian naskah yang dicek sudah terisi. Kolom di luar hitungan ini boleh kosong.</p>
        ) : (
          <ul className="mt-1 max-h-28 overflow-y-auto text-[10px] text-amber-800 space-y-0.5">
            {missing.slice(0, 12).map((c) => <li key={c.id}>Kurang: {c.label}</li>)}
            {missing.length > 12 && <li>dan {missing.length - 12} bagian lain</li>}
          </ul>
        )}
      </div>
    </div>
  );
};
