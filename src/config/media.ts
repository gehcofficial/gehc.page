/**
 * Pusat media visual landing.
 * Foto saat ini masih stock (Unsplash) sebagai placeholder.
 * Saat foto asli GEHC siap (G-Drive / file lokal), cukup ganti URL di sini.
 */
export const MEDIA = {
  heroBanner:
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2000&auto=format&fit=crop',

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
} as const;

/** Atribut img standar: lazy + async decode untuk performa. */
export const IMG_PROPS = { loading: 'lazy', decoding: 'async' } as const;
