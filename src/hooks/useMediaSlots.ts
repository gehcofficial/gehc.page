import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { DEFAULT_SLOTS, MEDIA, type LandingMedia, type MediaSlots } from '../config/media';

type SlotsResponse = {
  source?: 'drive' | 'fallback';
  slots?: {
    landing?: Partial<LandingMedia>;
    brand?: { logoGehc?: string };
    warta?: { bannerDefault?: string };
    kegiatan?: { bannerDefault?: string; bakuTau?: string };
    benzar?: { hero?: string; productPlaceholder?: string; qris?: string };
    kelompok?: Record<string, string>;
    pengurus?: Record<string, string>;
    testimoni?: Record<string, string>;
  };
};

export const MEDIA_SLOTS_QUERY_KEY = ['media-slots'] as const;
const STALE_MS = 60_000;

function mergeSlots(d: SlotsResponse): MediaSlots {
  const s = d.slots || {};
  return {
    landing: { ...MEDIA, ...s.landing },
    brand: { logoGehc: s.brand?.logoGehc },
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

async function fetchSlots(): Promise<MediaSlots> {
  const r = await fetch('/api/media/slots', { cache: 'no-store' });
  const d = (await r.json()) as SlotsResponse;
  return mergeSlots(d);
}

const preloaded = new Set<string>();

function preloadImage(href: string) {
  if (!href || preloaded.has(href)) return;
  preloaded.add(href);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = href;
  document.head.appendChild(link);
}

export function preloadCriticalMedia(slots: MediaSlots) {
  preloadImage(slots.brand.logoGehc || '');
  preloadImage(slots.landing.heroBanner);
  Object.values(slots.kelompok)
    .slice(0, 4)
    .forEach((url) => preloadImage(url));
}

export function prefetchMediaSlots(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: MEDIA_SLOTS_QUERY_KEY,
    queryFn: fetchSlots,
    staleTime: STALE_MS,
  });
}

export function useMediaSlots(): MediaSlots {
  const { data } = useQuery({
    queryKey: MEDIA_SLOTS_QUERY_KEY,
    queryFn: fetchSlots,
    staleTime: STALE_MS,
    gcTime: 5 * STALE_MS,
    refetchInterval: STALE_MS,
    placeholderData: DEFAULT_SLOTS,
  });
  return data ?? DEFAULT_SLOTS;
}

export function MediaSlotsWarmup() {
  const slots = useMediaSlots();
  useEffect(() => {
    if (slots.source !== 'drive') return;
    preloadCriticalMedia(slots);
  }, [slots]);
  return null;
}
