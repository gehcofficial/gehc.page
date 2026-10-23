import type { PortalId } from './portal-profiles';
import { portalProfile } from './portal-profiles';

export type DocumentMeta = {
  title: string;
  description: string;
  themeColor: string;
  appleWebAppTitle: string;
};

const HUB_META: DocumentMeta = {
  title: 'GMIM Eben Haezer Cikarang — GEHC.page',
  description:
    'Portal jemaat GMIM Eben Haezer Cikarang — direktori unit BIPRA & Kolom, warta, dan pelayanan gereja.',
  themeColor: '#1B1B1B',
  appleWebAppTitle: 'GEHC',
};

const YOUTH_META: DocumentMeta = {
  title: 'BEYONDERS — Beyond the Sunday Walk | GEHC Youth',
  description:
    'Beyonders — sistem mentoring pemuda GMIM Eben Haezer Cikarang. 10 kelompok, mentor & comentor, iman yang berjalan beyond the Sunday walk.',
  themeColor: '#F6AE4A',
  appleWebAppTitle: 'GEHC Youth',
};

const UNIT_META: Partial<Record<PortalId, DocumentMeta>> = {
  men: {
    title: 'Kaum Bapa — GEHC.page',
    description: 'Portal Kaum Bapa GMIM Eben Haezer Cikarang — persekutuan, kegiatan, dan pelayanan P/KB.',
    themeColor: '#0EA5E9',
    appleWebAppTitle: 'GEHC Bapa',
  },
  women: {
    title: 'Kaum Ibu — GEHC.page',
    description: 'Portal Kaum Ibu GMIM Eben Haezer Cikarang — persekutuan, kegiatan, dan pelayanan W/KI.',
    themeColor: '#EC4899',
    appleWebAppTitle: 'GEHC Ibu',
  },
  teen: {
    title: 'Remaja — GEHC.page',
    description: 'Portal Remaja GMIM Eben Haezer Cikarang — pembinaan remaja SMP & SMA.',
    themeColor: '#7C3AED',
    appleWebAppTitle: 'GEHC Remaja',
  },
  kids: {
    title: 'Anak & Sekolah Minggu — GEHC.page',
    description: 'Portal Anak GMIM Eben Haezer Cikarang — Sekolah Minggu dan kegiatan anak.',
    themeColor: '#F59E0B',
    appleWebAppTitle: 'GEHC Anak',
  },
  kolom: {
    title: 'Kolom & Wilayah — GEHC.page',
    description: 'Portal teritorial Kolom GMIM Eben Haezer Cikarang — pemetaan wilayah dan anggota jemaat.',
    themeColor: '#10B981',
    appleWebAppTitle: 'GEHC Kolom',
  },
  community: {
    title: 'Komunitas — GEHC.page',
    description: 'Komunitas minat, bakat, dan rekreasional GMIM Eben Haezer Cikarang.',
    themeColor: '#6366F1',
    appleWebAppTitle: 'GEHC Komunitas',
  },
};

export function documentMetaForPortal(portalId: PortalId): DocumentMeta {
  if (portalId === 'jemaat') return HUB_META;
  if (portalId === 'youth') return YOUTH_META;
  const unit = UNIT_META[portalId];
  if (unit) return unit;
  const p = portalProfile(portalId);
  return {
    title: `${p.label} — GEHC.page`,
    description: p.label,
    themeColor: '#F6AE4A',
    appleWebAppTitle: p.shortLabel,
  };
}

export function applyDocumentMeta(meta: DocumentMeta) {
  if (typeof document === 'undefined') return;
  document.title = meta.title;
  const setMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.content = content;
  };
  setMeta('description', meta.description);
  setMeta('theme-color', meta.themeColor);
  setMeta('apple-mobile-web-app-title', meta.appleWebAppTitle);
}
