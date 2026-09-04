/**
 * Pusat media visual landing.
 * Default: placeholder Unsplash. Saat `public/visuals/manifest.json` ada,
 * `useMediaSlots()` pakai URL CDN statis; fallback Drive API bila belum di-pull.
 */
export type LandingMedia = {
  heroBanner: string;
  heroVideo?: string | null;
  collageWorship: string;
  collageCommunity: string;
  collageMusic: string;
  collageStudy: string;
  collageFriends: string;
  collagePortrait: string;
};

export const MEDIA: LandingMedia = {
  heroBanner:
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2000&auto=format&fit=crop',
  heroVideo: null,
  collageWorship:
    'https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1000&auto=format&fit=crop',
  collageCommunity:
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop',
  collageMusic:
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1000&auto=format&fit=crop',
  collageStudy:
    'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000&auto=format&fit=crop',
  collageFriends:
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1000&auto=format&fit=crop',
  collagePortrait:
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
};

export const MEDIA_EXTRAS = {
  wartaBanner:
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
  eventBanner:
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
  bakuTau:
    'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1200&auto=format&fit=crop',
  benzarHero:
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1600&auto=format&fit=crop',
  productPlaceholder:
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop',
  qris: '/Gopay QRIS.png',
} as const;

export type MediaSlots = {
  landing: LandingMedia;
  brand: { logoGehc?: string };
  warta: { bannerDefault: string };
  kegiatan: { bannerDefault: string; bakuTau: string };
  benzar: { hero: string; productPlaceholder: string; qris: string };
  kelompok: Record<string, string>;
  pengurus: Record<string, string>;
  testimoni: Record<string, string>;
  users: Record<string, string>;
  panca: Record<string, string>;
  source: 'drive' | 'fallback' | 'static';
};

export const DEFAULT_SLOTS: MediaSlots = {
  landing: { ...MEDIA },
  brand: {},
  warta: { bannerDefault: MEDIA_EXTRAS.wartaBanner },
  kegiatan: { bannerDefault: MEDIA_EXTRAS.eventBanner, bakuTau: MEDIA_EXTRAS.bakuTau },
  benzar: {
    hero: MEDIA_EXTRAS.benzarHero,
    productPlaceholder: MEDIA_EXTRAS.productPlaceholder,
    qris: MEDIA_EXTRAS.qris,
  },
  kelompok: {},
  pengurus: {},
  testimoni: {},
  users: {},
  panca: {},
  source: 'fallback',
};

export function slugifyPerson(name: string): string {
  return String(name || '')
    .replace(/^(pdt|pnt|dkn|ptr)\.?\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Atribut img standar: lazy + async decode untuk performa. */
export const IMG_PROPS = { loading: 'lazy' as const, decoding: 'async' as const };

/** Above-the-fold: logo, hero — unduh segera. */
export const EAGER_IMG_PROPS = {
  loading: 'eager' as const,
  decoding: 'async' as const,
  fetchPriority: 'high' as const,
};
