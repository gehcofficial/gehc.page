/**
 * Direktori unit pelayanan untuk hub gehc.page.
 * Metadata tampilan diselaraskan dengan `PORTAL_PROFILES` (tenant/host kanonik).
 */

import { isStagingHost } from '../lib/host-context';
import {
  ALL_PORTAL_IDS,
  PORTAL_PROFILES,
  type PortalId,
} from '../lib/portal-profiles';

export type ChurchUnitStatus = 'active' | 'soon';
export type ChurchUnitGroup = 'bipra' | 'teritorial' | 'lainnya';

export type ChurchUnit = {
  id: 'youth' | 'teen' | 'kids' | 'men' | 'women' | 'districts' | 'community';
  name: string;
  nameEn: string;
  desc: string;
  status: ChurchUnitStatus;
  group: ChurchUnitGroup;
  host?: string;
  tenantId?: string | null;
  portalId?: PortalId;
  accent: string;
};

export const CHURCH_GROUP_LABELS: Record<ChurchUnitGroup, { title: string; subtitle: string }> = {
  bipra: { title: 'Kategorial · BIPRA', subtitle: 'Anak, Remaja, Pemuda, Kaum Bapa & Ibu' },
  teritorial: { title: 'Teritorial', subtitle: 'Wilayah & Kolom' },
  lainnya: { title: 'Lainnya', subtitle: 'Komunitas & rekreasional' },
};

const PORTAL_TO_UNIT_ID: Record<PortalId, ChurchUnit['id'] | null> = {
  jemaat: null,
  youth: 'youth',
  teen: 'teen',
  kids: 'kids',
  men: 'men',
  women: 'women',
  kolom: 'districts',
  community: 'community',
};

const UNIT_COPY: Record<
  ChurchUnit['id'],
  { name: string; nameEn: string; desc: string; group: ChurchUnitGroup; accent: string }
> = {
  men: {
    name: 'Pria / Kaum Bapa',
    nameEn: 'Men',
    desc: 'Persekutuan dan pelayanan kaum bapa (P/KB).',
    group: 'bipra',
    accent: 'from-[#0EA5E9] to-[#1D4ED8]',
  },
  women: {
    name: 'Wanita / Kaum Ibu',
    nameEn: 'Women',
    desc: 'Persekutuan dan pelayanan kaum ibu (W/KI).',
    group: 'bipra',
    accent: 'from-[#EC4899] to-[#8B5CF6]',
  },
  youth: {
    name: 'Pemuda',
    nameEn: 'Youth',
    desc: 'Komunitas Beyonders — pemuridan, retreat, dan pelayanan pemuda.',
    group: 'bipra',
    accent: 'from-[#FF416C] to-[#FF4B2B]',
  },
  teen: {
    name: 'Pra Remaja',
    nameEn: 'Teen',
    desc: 'Pembinaan remaja SMP & SMA di lingkungan gereja.',
    group: 'bipra',
    accent: 'from-[#7C3AED] to-[#DB2777]',
  },
  kids: {
    name: 'Anak',
    nameEn: 'Kids',
    desc: 'Sekolah Minggu dan kegiatan anak penuh sukacita.',
    group: 'bipra',
    accent: 'from-[#F59E0B] to-[#EF4444]',
  },
  districts: {
    name: 'Wilayah & Kolom',
    nameEn: 'Districts',
    desc: 'Pemetaan jemaat per wilayah/Kolom teritorial.',
    group: 'teritorial',
    accent: 'from-[#10B981] to-[#047857]',
  },
  community: {
    name: 'Komunitas & Rekreasional',
    nameEn: 'Community',
    desc: 'Minat, bakat, musik, olahraga, dan kegiatan rekreasional.',
    group: 'lainnya',
    accent: 'from-[#6366F1] to-[#0EA5E9]',
  },
};

const HUB_ORDER: ChurchUnit['id'][] = ['men', 'women', 'youth', 'teen', 'kids', 'districts', 'community'];

function buildChurchUnits(): ChurchUnit[] {
  const byId = new Map<ChurchUnit['id'], ChurchUnit>();
  for (const portalId of ALL_PORTAL_IDS) {
    const unitId = PORTAL_TO_UNIT_ID[portalId];
    if (!unitId) continue;
    const profile = PORTAL_PROFILES[portalId];
    const copy = UNIT_COPY[unitId];
    byId.set(unitId, {
      id: unitId,
      ...copy,
      status: 'active',
      host: profile.host,
      tenantId: profile.tenantId,
      portalId,
    });
  }
  return HUB_ORDER.map((id) => byId.get(id)).filter(Boolean) as ChurchUnit[];
}

export const CHURCH_UNITS: ChurchUnit[] = buildChurchUnits();

export const ACTIVE_UNIT_HOST: Partial<Record<ChurchUnit['id'], string>> = Object.fromEntries(
  CHURCH_UNITS.filter((u) => u.status === 'active' && u.host).map((u) => [u.id, u.host as string]),
) as Partial<Record<ChurchUnit['id'], string>>;

export function unitPortalUrl(id: ChurchUnit['id']): string | null {
  const unit = CHURCH_UNITS.find((u) => u.id === id);
  if (!unit?.host) return null;
  const staging = typeof window !== 'undefined' && isStagingHost(window.location.hostname);
  const host = staging ? unit.host.replace(/^([a-z]+)\./, 'staging-$1.') : unit.host;
  return `https://${host}`;
}

export const DEFAULT_MAP_URL = 'https://share.google/Ro2jBSuGfrzfg49nP';
export const CHURCH_ADDRESS =
  'Gereja GMIM Eben Haezer, Jl. Kasuari No. 12, Cikarang Baru, Kab. Bekasi, Jawa Barat, Indonesia';
