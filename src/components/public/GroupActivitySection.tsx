import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Calendar, Images, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SectionHeader } from './ui/SectionHeader';

type PublicAlbum = {
  id: string;
  groupId: string;
  groupName?: string | null;
  title: string;
  occurredOn?: string | null;
  location?: string | null;
  coverUrl?: string | null;
  previews?: { id: string; thumbnailUrl: string }[];
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * Seksi publik "Kegiatan Kelompok" — hanya album yang ditandai tampil oleh
 * mentor/Komisi (album privat tidak pernah tampil di sini).
 */
export const GroupActivitySection: React.FC = () => {
  const { openGroupDetail, setPublicTab } = useApp();
  const reduce = useReducedMotion();
  const [albums, setAlbums] = useState<PublicAlbum[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/db/group-albums?limit=9')
      .then((r) => (r.ok ? r.json() : { albums: [] }))
      .then((d) => { if (!cancelled) setAlbums((d.albums || []) as PublicAlbum[]); })
      .catch(() => { if (!cancelled) setAlbums([]); });
    return () => { cancelled = true; };
  }, []);

  if (!albums.length) return null;

  const open = (album: PublicAlbum) => {
    setPublicTab('group-detail');
    openGroupDetail(album.groupId);
  };

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      <div className="mb-10">
        <SectionHeader
          eyebrow="Kegiatan Kelompok"
          title="Cerita dari rumah-rumah Beyonders"
          subtitle="Momen yang dibagikan para kelompok — dipublikasikan dengan izin mentor dan Komisi."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {albums.map((album, i) => (
          <motion.button
            key={album.id}
            type="button"
            onClick={() => open(album)}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="text-left rounded-3xl overflow-hidden border border-[#D9D7D0]/60 bg-white hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <div className="aspect-[4/3] bg-[#F3F1EC]">
              {album.coverUrl ? (
                <img
                  src={album.coverUrl}
                  alt={album.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#B8B4AC]">
                  <Images className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="p-4 space-y-1.5">
              {album.groupName && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
                  {album.groupName}
                </span>
              )}
              <p className="text-sm font-black text-[#1B1B1B] leading-snug">{album.title}</p>
              <p className="text-[11px] text-[#8C8880] flex items-center gap-2 flex-wrap">
                {album.occurredOn && (
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(album.occurredOn)}</span>
                )}
                {album.location && (
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {album.location}</span>
                )}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
};
