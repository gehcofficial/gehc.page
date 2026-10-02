import React, { useEffect, useState } from 'react';
import { ArrowRight, Presentation } from 'lucide-react';

type WorshipLink = {
  slug: string;
  title: string;
  status: string;
  sessionDate?: string | null;
  patternCode?: string | null;
  patternName?: string | null;
};

export const WORSHIP_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Segera',
  LIKERT_OPEN: 'Pendaftaran dibuka',
  RUNNING: 'Berlangsung',
  WRAPUP: 'Penutup',
  CLOSED: 'Selesai',
};

export function worshipStatusLabel(status: string | null | undefined): string {
  return WORSHIP_STATUS_LABEL[String(status || '').toUpperCase()] || String(status || 'Sesi');
}

/**
 * Kartu "Pola Ibadah" untuk Info Event: nama pola + tautan sesi mentoring
 * minggu itu. Tanpa sesi → tidak render. Tanpa instruksi kontrol
 * (kontrol tetap di panel Didaskalia).
 */
export const EventWorshipCard: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [session, setSession] = useState<WorshipLink | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(eventId)}/worship`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { session: null }))
      .then((d) => { if (!cancelled) { setSession((d.session || null) as WorshipLink | null); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setSession(null); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!loaded || !session) return null;

  const isDraft = String(session.status || '').toUpperCase() === 'DRAFT';
  const href = `#/mentoring/${encodeURIComponent(session.slug)}`;

  return (
    <div className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Presentation className="w-4 h-4 text-sky-700" />
        <h3 className="text-sm font-black text-[#1B1B1B]">Pola Ibadah</h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white border border-sky-200 font-bold text-sky-800">
          {worshipStatusLabel(session.status)}
        </span>
      </div>
      <div>
        <p className="text-xs font-black text-sky-900">{session.patternName || session.patternCode || 'Sesi mentoring'}</p>
        <p className="text-[11px] text-[#5C5850] mt-0.5">{session.title}</p>
        {isDraft && <p className="text-[11px] text-[#8C8880] mt-1">Panduan menyusul dari Didaskalia.</p>}
      </div>
      <a
        href={href}
        onClick={(e) => { e.preventDefault(); window.location.hash = `#/mentoring/${encodeURIComponent(session.slug)}`; }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-700 hover:bg-sky-800 text-white text-xs font-black uppercase"
      >
        Buka Sesi Mentoring <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
};
