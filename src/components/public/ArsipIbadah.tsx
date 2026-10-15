import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Images } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';

type RingkasanRef = { ym: string; week: number } | null;

type ArsipEvent = {
  id: string;
  name: string;
  period: string;
  date: string;
  previews: { id: string; thumbnailUrl: string }[];
  hasArchive: boolean;
  ringkasan: RingkasanRef;
};

type Ringkasan = {
  theme: string;
  date: string;
  bigIdea: string;
  teksUtama: { ref: string; text: string };
  coverUrl: string | null;
};

const PAGE = 4;

function fmtDate(day: string, fallback: string) {
  const raw = (day || fallback || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—';
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

const ArsipCard: React.FC<{ event: ArsipEvent; dateLabel: string }> = ({ event, dateLabel }) => {
  const { authUser, setPublicTab } = useApp();
  const { t } = useLang();
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (!event.ringkasan) return;
    let alive = true;
    fetch(`/api/ibadah/ringkasan/${event.ringkasan.ym}/${event.ringkasan.week}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setRingkasan(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [event.ringkasan]);

  const openDrive = async () => {
    if (!authUser) {
      setPublicTab('login');
      return;
    }
    const r = await fetch(`/api/events/${event.id}/archive-link`, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (d.driveUrl) window.open(d.driveUrl, '_blank');
  };

  return (
    <article className="bg-white rounded-[28px] overflow-hidden border border-[#D9D7D0]/40 shadow-sm flex flex-col">
      {ringkasan?.coverUrl && imgOk ? (
        <div className="w-full aspect-[16/9] overflow-hidden bg-[#F0EFEB]">
          <img
            src={ringkasan.coverUrl}
            alt={event.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
      <div className="p-6 sm:p-7 flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[11px] text-[#8C8880] font-medium">
          <Calendar className="w-3.5 h-3.5" />
          <span>{dateLabel || event.period || '—'}</span>
        </div>
        <h3 className="text-lg font-bold tracking-tight text-[#1B1B1B]">{event.name}</h3>
        {ringkasan ? (
          <>
            {ringkasan.teksUtama?.ref ? (
              <p className="text-xs font-bold text-brand">{ringkasan.teksUtama.ref}</p>
            ) : null}
            {ringkasan.bigIdea ? (
              <p className="text-xs text-[#1B1B1B] leading-relaxed line-clamp-3">{ringkasan.bigIdea}</p>
            ) : null}
            {event.ringkasan ? (
              <a
                href={`#/ringkasan/${event.ringkasan.ym}/${event.ringkasan.week}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B1B1B] hover:text-brand w-fit"
              >
                <BookOpen className="w-3.5 h-3.5" /> {t.arsip.readSummary}
              </a>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-[#8C8880]">{t.arsip.unpublished}</p>
        )}
        {(event.previews || []).length > 0 ? (
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[#8C8880] mb-2 inline-flex items-center gap-1.5">
              <Images className="w-3.5 h-3.5" /> {t.arsip.galleryDay}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {event.previews.slice(0, 4).map((p) => (
                <img key={p.id} src={p.thumbnailUrl} alt="" loading="lazy" className="aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </div>
        ) : null}
        {event.hasArchive ? (
          <button
            type="button"
            onClick={openDrive}
            className="mt-1 w-fit px-4 py-2 rounded-full bg-[#181818] text-white text-xs font-bold"
          >
            {authUser ? t.arsip.driveAll : t.arsip.driveLogin}
          </button>
        ) : null}
      </div>
    </article>
  );
};

/** Grid arsip ibadah: 4 event terbaru terbuka + see more (+4). */
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.slice(0, visible).map((e) => (
          <ArsipCard key={e.id} event={e} dateLabel={fmtDate(e.date, e.period)} />
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
