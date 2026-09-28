import { useEffect, useState } from 'react';
import {
  brandingToOverride,
  getBrandingOnce,
  resolvePortalTheme,
  type PortalTheme,
} from '../lib/portal-themes';
import { usePortalProfile } from './usePortalProfile';

/**
 * Tema portal aktif (default kode + override branding DB).
 * Dipakai komponen yang butuh nilai tema (mis. logo), bukan sekadar CSS var.
 */
export function usePortalTheme(): PortalTheme {
  const portal = usePortalProfile();
  const [theme, setTheme] = useState<PortalTheme>(() => resolvePortalTheme('', ''));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const search = window.location.search;
    setTheme(resolvePortalTheme(host, search));
    let cancelled = false;
    getBrandingOnce().then((b) => {
      if (!cancelled) setTheme(resolvePortalTheme(host, search, brandingToOverride(b)));
    });
    return () => {
      cancelled = true;
    };
  }, [portal.id]);

  return theme;
}
