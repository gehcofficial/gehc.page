import React, { useEffect, useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { useLang } from '../../context/LangContext';

export type ArsipEvent = {
  id: string;
  name: string;
  period: string;
  date: string;
  previews: { id: string; thumbnailUrl: string }[];
  hasArchive: boolean;
  ringkasan: { ym: string; week: number; published: boolean } | null;
};

const PAGE = 4;

export function fmtArsipDate(day: string) {
  const raw = (day || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—';
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/** Daftar tanggal arsip: ringkas, klik-untuk-buka halaman detail (#/arsip/:id). */
export const ArsipIbadah: React.FC = () => {
  const { t } = useLang();
  const [events, setEvents] = useState<ArsipEvent[]>([]);
  const [visible, setVisible] = useState(PAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events/public-archive')
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-[#8C8880] py-8 text-center">{t.arsip.loading}</p>;
  if (!events.length) return null;

  return (
    <div className="mt-4">
      <div className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">{t.arsip.eyebrow}</span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B] font-display mt-1">
          {t.arsip.title}
        </h2>
        <p className="text-xs text-[#8C8880] mt-1 max-w-2xl">{t.arsip.sub}</p>
      </div>
      <div className="space-y-2.5">
        {events.slice(0, visible).map((e) => (
          <a
            key={e.id}
            href={`#/arsip/${e.id}`}
            className="flex items-center gap-3 bg-white rounded-2xl border border-[#D9D7D0]/40 px-4 py-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            {e.previews?.[0] ? (
              <img src={e.previews[0].thumbnailUrl} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : (
              <span className="w-12 h-12 rounded-xl bg-[#F0EFEB] flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-[#8C8880]" />
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] text-[#8C8880] font-medium">{fmtArsipDate(e.date)}</span>
              <span className="block text-sm font-bold text-[#1B1B1B] truncate">{e.name}</span>
            </span>
            {e.ringkasan && !e.ringkasan.published ? (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                {t.arsip.draftLive}
              </span>
            ) : null}
            <ChevronRight className="w-4 h-4 text-[#8C8880] shrink-0" />
          </a>
        ))}
      </div>
      {visible < events.length ? (
        <div className="text-center mt-8">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="px-6 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold text-[#1B1B1B] hover:bg-[#F0EFEB]"
          >
            {t.arsip.seeMore} ({events.length - visible} {t.arsip.moreLeft})
          </button>
        </div>
      ) : null}
    </div>
  );
};
