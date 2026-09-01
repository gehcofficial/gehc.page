import { useEffect, useState } from 'react';
import { DEFAULT_SLOTS, MEDIA, type LandingMedia, type MediaSlots } from '../config/media';

type SlotsResponse = {
  source?: 'drive' | 'fallback';
  slots?: {
    landing?: Partial<LandingMedia>;
    warta?: { bannerDefault?: string };
    kegiatan?: { bannerDefault?: string; bakuTau?: string };
    benzar?: { hero?: string; productPlaceholder?: string; qris?: string };
    kelompok?: Record<string, string>;
    pengurus?: Record<string, string>;
    testimoni?: Record<string, string>;
  };
};

let inflight: Promise<MediaSlots> | null = null;

function mergeSlots(d: SlotsResponse): MediaSlots {
  const s = d.slots || {};
  return {
    landing: { ...MEDIA, ...s.landing },
    warta: { bannerDefault: s.warta?.bannerDefault || DEFAULT_SLOTS.warta.bannerDefault },
    kegiatan: {
      bannerDefault: s.kegiatan?.bannerDefault || DEFAULT_SLOTS.kegiatan.bannerDefault,
      bakuTau: s.kegiatan?.bakuTau || DEFAULT_SLOTS.kegiatan.bakuTau,
    },
    benzar: {
      hero: s.benzar?.hero || DEFAULT_SLOTS.benzar.hero,
      productPlaceholder: s.benzar?.productPlaceholder || DEFAULT_SLOTS.benzar.productPlaceholder,
      qris: s.benzar?.qris || DEFAULT_SLOTS.benzar.qris,
    },
    kelompok: s.kelompok || {},
    pengurus: s.pengurus || {},
    testimoni: s.testimoni || {},
    source: d.source === 'drive' ? 'drive' : 'fallback',
  };
}

function loadSlots(): Promise<MediaSlots> {
  if (!inflight) {
    inflight = fetch('/api/media/slots')
      .then((r) => r.json())
      .then((d: SlotsResponse) => mergeSlots(d))
      .catch(() => DEFAULT_SLOTS);
  }
  return inflight;
}

export function useMediaSlots(): MediaSlots {
  const [slots, setSlots] = useState<MediaSlots>(DEFAULT_SLOTS);

  useEffect(() => {
    let cancelled = false;
    loadSlots().then((next) => {
      if (!cancelled) setSlots(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return slots;
}
