import React, { useEffect, useState } from 'react';
import { BookOpen, FileText, Loader2 } from 'lucide-react';
import { useActiveAccess } from '../../hooks/useActiveAccess';

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
export const EventDidaskaliaMaterials: React.FC<{ eventId: string; eventName: string }> = ({ eventId, eventName }) => {
  const { canView01, canView03 } = useActiveAccess();
  const [busy, setBusy] = useState(true);
  const [files, setFiles] = useState<Record<string, DriveFile[]>>({ pembekalan: [], khutbah: [], rhb: [] });
  const [forbidden, setForbidden] = useState<Record<string, boolean>>({});

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
