import React, { useMemo, useState } from 'react';
import { ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { DAY_LABELS, defaultStudio, ensurePaths, type DidaskaliaStudio } from '../../lib/didaskalia';

type Toast = { type: 'success' | 'error' | 'warning'; title: string };

const KHUTBAH = [
  { key: 'pengantar', label: 'Pengantar' },
  { key: 'bedahTeologis', label: 'Bedah Teologis' },
  { key: 'jembatan', label: 'Jembatan' },
  { key: 'kesimpulan', label: 'Kesimpulan' },
] as const;

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]';

async function readJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

type Slot = { id: string; label: string; fileId: string; kind: 'cover' | 'sermon' | 'rhb'; key?: string; day?: number };

export const DidaskaliaGambarPanel: React.FC<{
  canWrite: boolean;
  ym: string;
  weekIndex: number;
  studio: DidaskaliaStudio;
  driveChecked: boolean;
  driveOk: boolean;
  onStudio: (studio: DidaskaliaStudio) => void;
  onDriveFail: () => void;
  uploadCover: (file: File) => Promise<void>;
  clearCover: () => void;
  addToast: (t: Toast) => void;
}> = ({ canWrite, ym, weekIndex, studio, driveChecked, driveOk, onStudio, onDriveFail, uploadCover, clearCover, addToast }) => {
  const [skipExisting, setSkipExisting] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number; label: string } | null>(null);

  const slots = useMemo<Slot[]>(() => {
    const pres = studio.presentation || {};
    const paths = ensurePaths(studio);
    const sermonSlots: Slot[] = KHUTBAH.map((s) => ({
      id: `sermon:${s.key}`,
      label: `Khotbah · ${s.label}`,
      fileId: String(pres.khutbahLiteral?.[s.key] || ''),
      kind: 'sermon',
      key: s.key,
    }));
    const daySlots: Slot[] = paths.map((p) => ({
      id: `rhb:${p.pathIndex}`,
      label: `RHB · Path ${p.pathIndex} ${DAY_LABELS[p.pathIndex - 1] || p.dayLabel}`,
      fileId: String(pres.rhbAi?.[String(p.pathIndex)] || ''),
      kind: 'rhb',
      day: p.pathIndex,
    }));
    return [
      { id: 'cover', label: 'Cover', fileId: String(pres.cover || ''), kind: 'cover' },
      ...sermonSlots,
      ...daySlots,
    ];
  }, [studio]);

  const filled = slots.filter((s) => s.fileId).length;

  const applyWeek = (d: Record<string, unknown>) => {
    const week = d.week as { studio?: DidaskaliaStudio } | undefined;
    if (week?.studio) onStudio({ ...defaultStudio(), ...week.studio });
  };

  const runSlot = async (slot: Slot, replaceCover: boolean): Promise<boolean> => {
    if (driveChecked && !driveOk) {
      addToast({ type: 'error', title: 'Drive terputus — sambungkan ulang sebelum membuat gambar.' });
      return false;
    }
    const url = slot.kind === 'cover'
      ? `/api/didaskalia/studio/${ym}/${weekIndex}/generate-image`
      : slot.kind === 'sermon'
        ? `/api/didaskalia/studio/${ym}/${weekIndex}/sermon-image`
        : `/api/didaskalia/studio/${ym}/${weekIndex}/rhb-image`;
    const body = slot.kind === 'cover'
      ? { prompt, style, coverStyle: 'AI', replace: replaceCover && Boolean(slot.fileId) }
      : slot.kind === 'sermon'
        ? { section: slot.key }
        : { day: slot.day };
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await readJson(r);
    if (!r.ok) {
      const msg = String(d.error || `Gagal membuat ${slot.label}.`);
      if (/Drive terputus|DRIVE_AUTH_EXPIRED/i.test(msg)) onDriveFail();
      addToast({ type: 'error', title: msg });
      return false;
    }
    applyWeek(d);
    return true;
  };

  const regenerate = async (slot: Slot) => {
    if (!canWrite || running) return;
    setRunning(slot.id);
    setProgress({ index: 1, total: 1, label: slot.label });
    try {
      const ok = await runSlot(slot, true);
      if (ok) addToast({ type: 'success', title: `${slot.label} diperbarui` });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal membuat gambar.' });
    } finally {
      setRunning(null);
      setProgress(null);
    }
  };

  const runAll = async () => {
    if (!canWrite || running) return;
    const queue = slots.filter((s) => !(skipExisting && s.fileId));
    if (!queue.length) {
      addToast({ type: 'success', title: '12 gambar sudah ada — tidak ada yang dibuat ulang.' });
      return;
    }
    setRunning('all');
    let made = 0;
    try {
      for (let i = 0; i < queue.length; i += 1) {
        const slot = queue[i];
        setProgress({ index: i + 1, total: queue.length, label: slot.label });
        // eslint-disable-next-line no-await-in-loop
        const ok = await runSlot(slot, Boolean(slot.fileId));
        if (!ok) break;
        made += 1;
      }
      if (made) addToast({ type: 'success', title: `${made} gambar selesai` });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal membuat gambar.' });
    } finally {
      setRunning(null);
      setProgress(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ImagePlus className="w-4 h-4 text-[#0EA5E9]" />
        <h4 className="text-sm font-black text-[#1B1B1B]">Gambar</h4>
        <span className="text-[10px] font-bold text-[#8C8880]">{filled}/12 slot · kuota pekan 12</span>
      </div>
      <p className="text-[11px] text-[#8C8880]">Satu tindakan membuat 1 cover, 4 gambar bagian khotbah, dan 7 gambar hari RHB. Gambar yang sudah ada bisa dilewati. Satu baris tetap bisa dibuat ulang.</p>
      {driveChecked && !driveOk && (
        <p className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          Koneksi Drive terputus. Generate dan unggah gambar akan gagal sampai token Drive diperbarui.
        </p>
      )}
      {progress && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-[#EFEDE8] overflow-hidden">
            <div className="h-full bg-sky-600" style={{ width: `${Math.round((progress.index / progress.total) * 100)}%` }} />
          </div>
          <p className="text-[11px] font-bold text-sky-800">{progress.index}/{progress.total} · {progress.label}</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1 block">Arahan cover (opsional)</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Suasana, objek, cahaya — tanpa teks di dalam gambar" className={inputCls} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1 block">Gaya cover</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
            <option value="cinematic">Sinematik hangat</option>
            <option value="community">Komunitas hangat Indonesia</option>
            <option value="minimal">Minimal simbolik</option>
          </select>
          <label className="inline-flex items-center gap-2 text-[11px] font-bold text-[#8C8880]">
            <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} className="w-3.5 h-3.5" />
            Lewati yang sudah ada
          </label>
        </div>
      </div>
      <button type="button" disabled={!canWrite || !!running} onClick={() => void runAll()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
        {running === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Buat semua gambar
      </button>
      <div className="space-y-1.5">
        {slots.map((slot) => (
          <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-[#EFEDE8] px-2 py-1.5">
            <span className="text-[11px] font-bold text-[#1B1B1B] w-44 shrink-0">{slot.label}</span>
            {slot.fileId ? (
              <img src={`/api/didaskalia/asset/${encodeURIComponent(slot.fileId)}`} alt="" className="w-10 h-10 rounded-lg object-cover border border-[#EFEDE8]" />
            ) : (
              <span className="text-[10px] italic text-[#8C8880]">belum ada</span>
            )}
            {slot.kind === 'cover' && (
              <label className="text-[10px] font-bold text-sky-700 cursor-pointer">
                Unggah
                <input type="file" accept="image/*" className="hidden" disabled={!canWrite || !!running} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCover(f); }} />
              </label>
            )}
            {slot.kind === 'cover' && slot.fileId && (
              <button type="button" onClick={clearCover} className="text-[10px] font-bold text-red-600">Hapus</button>
            )}
            <button type="button" disabled={!canWrite || !!running} onClick={() => void regenerate(slot)} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-bold disabled:opacity-50">
              {running === slot.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />} {slot.fileId ? 'Buat ulang' : 'Buat'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
