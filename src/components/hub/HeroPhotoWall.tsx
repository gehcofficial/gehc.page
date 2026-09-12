import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMediaSlots } from '../../hooks/useMediaSlots';

const TILE_COUNT = 4;
const ROTATE_MS = 5200;

/**
 * Dinding foto hero hub — collage tile yang berganti/berotasi dari galeri Drive,
 * dengan watermark wordmark "GEHC" + logo GMIM & Pemuda GMIM transparan.
 * Tampil hanya bila foto >= 4.
 */
const HeroPhotoWall: React.FC = () => {
  const { hub, brand } = useMediaSlots();
  const reduce = useReducedMotion();
  const photos = useMemo(() => Object.values(hub || {}).filter(Boolean), [hub]);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (photos.length < 2 || reduce) return;
    const id = window.setInterval(() => setOffset((o) => (o + 1) % photos.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [photos.length, reduce]);

  if (photos.length < 4) return null;

  const tiles = Array.from({ length: TILE_COUNT }, (_, i) => photos[(offset + i) % photos.length]);

  return (
    <div className="relative w-full h-[380px] sm:h-[460px] select-none">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-display font-black text-[110px] sm:text-[170px] leading-none text-[#1B1B1B] opacity-[0.05]"
      >
        GEHC
      </span>
      {brand?.logoGmim && (
        <img
          src={brand.logoGmim}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -left-2 bottom-0 w-24 sm:w-28 opacity-[0.08]"
        />
      )}
      {brand?.logoYouthGmim && (
        <img
          src={brand.logoYouthGmim}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 top-0 w-20 sm:w-24 opacity-[0.10]"
        />
      )}

      <div className="relative grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 h-full">
        {tiles.map((url, i) => (
          <figure
            key={i}
            className={`relative overflow-hidden rounded-[22px] bg-[#F3F1EC] shadow-lg ${
              i === 1 ? 'mt-6' : i === 3 ? '-mt-6' : ''
            }`}
          >
            <AnimatePresence mode="popLayout">
              <motion.img
                key={url}
                src={url}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
                loading="lazy"
                decoding="async"
              />
            </AnimatePresence>
          </figure>
        ))}
      </div>
    </div>
  );
};

export default HeroPhotoWall;
