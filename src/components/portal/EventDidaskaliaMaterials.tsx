import React, { useEffect, useState } from 'react';
import { BookOpen, Copy, ExternalLink, FileText, Loader2, Presentation } from 'lucide-react';
import { useActiveAccess } from '../../hooks/useActiveAccess';
import { useApp } from '../../context/AppContext';
import { weekIndexForDateWib, yearMonthWib } from '../../lib/church-week';
import { materialHashPath } from '../../lib/didaskalia-presentation';
import { buildWeekCaption, copyText } from '../../lib/rhb-caption';
import { defaultStudio, ensurePaths, type DidaskaliaStudio } from '../../lib/didaskalia';

type DriveFile = { id: string; name: string; webViewLink?: string };

const SUBFOLDERS = {
  pembekalan: '01 Pembekalan Mentor - Co mentor',
  khutbah: '02 Ringkasan Khotbah',
  rhb: '03 RHB 7 Hari',
};

const CARD = {
  pembekalan: { title: 'Pembekalan Mentor - Co-Mentor', box: 'border-amber-200 bg-amber-50', title_cls: 'text-amber-800', desc_cls: 'text-amber-700' },
  khutbah: { title: 'Ringkasan Khotbah', box: 'border-sky-200 bg-sky-50', title_cls: 'text-sky-800', desc_cls: 'text-sky-700' },
  rhb: { title: 'RHB 7 Path Harian', box: 'border-emerald-200 bg-emerald-50', title_cls: 'text-emerald-800', desc_cls: 'text-emerald-700' },
} as const;

/**
 * Materi Didaskalia per event (01/02/03) — dipakai di Info Event agar RHB &
 * Ringkasan Khotbah sinkron dengan tanggal event. RBAC dijaga endpoint Drive.
 */
export const EventDidaskaliaMaterials: React.FC<{ eventId: string; eventName: string; eventDate?: string | null }> = ({ eventId, eventName, eventDate }) => {
  const { canView01, canView03 } = useActiveAccess();
  const { addToast } = useApp();
  const [busy, setBusy] = useState(true);
  const [files, setFiles] = useState<Record<string, DriveFile[]>>({ pembekalan: [], khutbah: [], rhb: [] });
  const [forbidden, setForbidden] = useState<Record<string, boolean>>({});

  const ym = yearMonthWib(eventDate);
  const weekIndex = eventDate ? weekIndexForDateWib(eventDate) : 1;

  const copyRhbCaption = async () => {
    if (!ym) { addToast({ type: 'error', title: 'Tanggal event belum tersedia.' }); return; }
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}`, { credentials: 'include' });
      const d = r.ok ? await r.json() : {};
      const studio = { ...defaultStudio(), ...(d.week?.studio || {}) } as DidaskaliaStudio;
      const content = {
        weekIndex,
        date: String(d.week?.date || eventDate || '').slice(0, 10),
        theme: d.week?.mentoringTheme || d.week?.servingTheme || d.week?.theme || '',
        chapterNo: studio.chapterNo || '',
        fundamentalFirman: studio.fundamentalFirman || { ref: '', text: '' },
        kitabFokus: studio.kitabFokus || '',
        paths: ensurePaths(studio),
        sermon: studio.sermon,
        images: studio.presentation || {},
      };
      const ok = await copyText(buildWeekCaption({ doc: 'rhb', yearMonth: ym, weekIndex, content }));
      addToast({ type: ok ? 'success' : 'error', title: ok ? 'Caption RHB disalin' : 'Gagal menyalin caption' });
    } catch {
      addToast({ type: 'error', title: 'Gagal menyiapkan caption.' });
    }
  };

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setBusy(true);
    const fetchSub = async (key: keyof typeof SUBFOLDERS) => {
      try {
        const r = await fetch(`/api/events/${eventId}/divisions/DIDASKALIA/drive?subfolder=${encodeURIComponent(SUBFOLDERS[key])}&fresh=1`, { credentials: 'include' });
        if (r.status === 403) return { forbidden: true, files: [] as DriveFile[] };
        if (!r.ok) return { forbidden: false, files: [] as DriveFile[] };
        const d = await r.json();
        return { forbidden: false, files: (d.files || []) as DriveFile[] };
      } catch {
        return { forbidden: false, files: [] as DriveFile[] };
      }
    };
    Promise.all([fetchSub('pembekalan'), fetchSub('khutbah'), fetchSub('rhb')])
      .then(([p, k, r]) => {
        if (cancelled) return;
        setFiles({ pembekalan: p.files, khutbah: k.files, rhb: r.files });
        setForbidden({ pembekalan: p.forbidden, khutbah: k.forbidden, rhb: r.forbidden });
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [eventId]);

  const visible = (['pembekalan', 'khutbah', 'rhb'] as const).filter((k) => {
    if (k === 'pembekalan') return canView01 && !forbidden.pembekalan;
    if (k === 'rhb') return canView03 && !forbidden.rhb;
    return true;
  });

  const total = visible.reduce((n, k) => n + (files[k]?.length || 0), 0);

  return (
    <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-[#0EA5E9]" />
        <h3 className="text-sm font-black text-[#1B1B1B]">Materi Didaskalia — {eventName}</h3>
      </div>
      {ym && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 space-y-2">
          <p className="text-xs font-black text-sky-800 flex items-center gap-1.5">
            <Presentation className="w-3.5 h-3.5" /> Presentasi Web
          </p>
          <div className="flex flex-wrap gap-1.5">
            {canView01 && (
              <a href={materialHashPath({ doc: 'pembekalan', yearMonth: ym, weekIndex })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[11px] font-bold text-sky-800">
                <ExternalLink className="w-3 h-3" /> Pembekalan
              </a>
            )}
            <a href={materialHashPath({ doc: 'khutbah', yearMonth: ym, weekIndex })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[11px] font-bold text-sky-800">
              <ExternalLink className="w-3 h-3" /> Ringkasan Khotbah
            </a>
            {canView03 && (
              <a href={materialHashPath({ doc: 'rhb', yearMonth: ym, weekIndex })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                <ExternalLink className="w-3 h-3" /> RHB 7 Hari
              </a>
            )}
            {canView03 && (
              <button type="button" onClick={() => void copyRhbCaption()} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white">
                <Copy className="w-3 h-3" /> Caption RHB
              </button>
            )}
          </div>
        </div>
      )}
      {busy ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat materi…</p>
      ) : total === 0 ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada materi untuk event ini. Didaskalia mengunggah via Panel Divisi → Didaskalia → Studio.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((k) => {
            const c = CARD[k];
            const list = files[k] || [];
            if (!list.length) return null;
            return (
              <div key={k} className={`rounded-2xl border ${c.box} p-4 space-y-2`}>
                <p className={`text-xs font-black ${c.title_cls}`}>{c.title} <span className="font-normal">· {list.length} file</span></p>
                <ul className="space-y-1.5">
                  {list.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#EFEDE8]">
                      <FileText className={`w-4 h-4 shrink-0 ${c.title_cls}`} />
                      <p className="text-xs font-bold text-[#1B1B1B] truncate flex-1" title={f.name}>{f.name}</p>
                      {f.webViewLink && (
                        <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-sky-700 hover:underline shrink-0">Buka</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
