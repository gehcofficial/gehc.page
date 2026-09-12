import React, { useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { Images } from 'lucide-react';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { useSteerableMarquee } from '../../hooks/useSteerableMarquee';

const CONTAINER = 'max-w-[1200px] mx-auto px-4 sm:px-8';

/**
 * Carousel foto jemaat untuk hub gehc.page.
 * Sumber: folder Drive `Website Visual [PUBLIK]/hub/` (semua file gambar).
 * Hanya tampil bila ada >= 4 foto. Geser/hover untuk mengatur kecepatan.
 */
const HubGalleryCarousel: React.FC = () => {
  const { hub } = useMediaSlots();
  const reduce = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const photos = useMemo(() => Object.values(hub || {}).filter(Boolean), [hub]);
  const loop = useMemo(
    () => (photos.length >= 4 ? [...photos, ...photos] : photos),
    [photos],
  );
  const enabled = photos.length >= 4 && !reduce;

  useSteerableMarquee(viewportRef, trackRef, enabled);

  if (photos.length < 4) return null;

  return (
    <section className={`${CONTAINER} pb-16`}>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880] flex items-center gap-1.5">
            <Images className="w-3.5 h-3.5" />
            Galeri
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">Sekilas Jemaat GEHC</h2>
        </div>
        <p className="hidden sm:block text-xs text-[#8C8880] max-w-xs leading-relaxed">
          Momen pelayanan dan persekutuan jemaat.
        </p>
      </div>

      <div ref={viewportRef} className="relative overflow-hidden py-2">
        <div ref={trackRef} className="flex gap-4 will-change-transform">
          {loop.map((url, i) => (
            <figure
              key={`${url}-${i}`}
              data-card
              className="shrink-0 w-[180px] sm:w-[230px] aspect-[4/5] rounded-[24px] overflow-hidden bg-[#F3F1EC] shadow-sm"
            >
              <img
                src={url}
                alt={`Jemaat GEHC ${(i % photos.length) + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-[#8C8880] mt-3">
        Geser atau dekatkan kursor untuk mengatur kecepatan · foto publik pelayanan.
      </p>
    </section>
  );
};

export default HubGalleryCarousel;
