import React, { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext';
import { SectionHeader } from '../public/ui/SectionHeader';
import { useApp } from '../../context/AppContext';
import { Images } from 'lucide-react';

type ArchiveEvent = {
  id: string;
  name: string;
  period: string;
  previews: { id: string; thumbnailUrl: string }[];
  hasArchive: boolean;
};

export const EventArchiveGallery: React.FC = () => {
  const { t } = useLang();
  const { authUser, setPublicTab } = useApp();
  const [events, setEvents] = useState<ArchiveEvent[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/events/public-archive')
      .then((r) => r.json())
      .then((d) => {
        const list = d.events || [];
        setEvents(list);
        setActive(list[0]?.id || null);
      })
      .catch(() => setEvents([]));
  }, []);

  const current = events.find((e) => e.id === active) || events[0];

  const openDrive = async () => {
    if (!authUser) {
      setPublicTab('login');
      return;
    }
    if (!current) return;
    const r = await fetch(`/api/events/${current.id}/archive-link`, { credentials: 'include' });
    const d = await r.json();
    if (d.driveUrl) window.open(d.driveUrl, '_blank');
  };

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      <SectionHeader eyebrow={t.gallery.eyebrow} title={t.gallery.title} subtitle={t.gallery.sub} />
      {events.length === 0 ? (
        <p className="text-xs text-[#8C8880] py-8">{t.gallery.highlights} — arsip acara akan tampil di sini.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mt-8 mb-6">
            {events.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setActive(e.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  current?.id === e.id ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#1B1B1B]'
                }`}
              >
                {e.name} · {e.period || '—'}
              </button>
            ))}
          </div>
          {current && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {(current.previews || []).length === 0 ? (
                  <div className="col-span-full py-10 text-center text-xs text-[#8C8880] flex flex-col items-center gap-2">
                    <Images className="w-8 h-8" />
                    Belum ada preview tersemat.
                  </div>
                ) : (
                  current.previews.map((p) => (
                    <img key={p.id} src={p.thumbnailUrl} alt="" className="aspect-square object-cover rounded-2xl" />
                  ))
                )}
              </div>
              {current.hasArchive && (
                <button
                  type="button"
                  onClick={openDrive}
                  className="mt-6 px-4 py-2 rounded-full bg-[#181818] text-white text-xs font-bold"
                >
                  {authUser ? 'Lihat semua di Drive' : 'Masuk untuk unduh di Drive'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
