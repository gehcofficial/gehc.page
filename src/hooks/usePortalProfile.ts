import { useEffect, useMemo, useState } from 'react';
import {
  isJemaatPortal,
  portalIdForHost,
  portalOverrideFromSearch,
  portalProfile,
  portalScopeLabel,
  portalScopeOf,
  type PortalId,
  type PortalProfile,
  type PortalScope,
} from '../lib/portal-profiles';

export type PortalProfileState = {
  id: PortalId;
  profile: PortalProfile;
  scope: PortalScope;
  scopeLabel: string;
  isJemaat: boolean;
  /** True bila id berasal dari override `?portal=` (non-produksi saja). */
  isOverride: boolean;
};

/**
 * Portal aktif untuk host saat ini (+ override `?portal=` di non-produksi).
 * SSR/hydration-safe: host dibaca setelah mount; sebelum itu memakai default Pemuda.
 */
export function usePortalProfile(): PortalProfileState {
  const [loc, setLoc] = useState({ host: '', search: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setLoc({ host: window.location.hostname, search: window.location.search });
  }, []);

  return useMemo(() => {
    const override = loc.host ? portalOverrideFromSearch(loc.search, loc.host) : null;
    const id = override || portalIdForHost(loc.host);
    const profile = portalProfile(id);
    return {
      id,
      profile,
      scope: portalScopeOf(id),
      scopeLabel: portalScopeLabel(id),
      isJemaat: isJemaatPortal(id),
      isOverride: Boolean(override),
    };
  }, [loc.host, loc.search]);
}
