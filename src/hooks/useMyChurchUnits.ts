import { useEffect, useState } from 'react';
import { canSeeChurchTab } from '../lib/portal-nav-config';

export type MyChurchUnits = {
  /** Kode unit jemaat yang diikuti (PEMBANGUNAN/THL/TECHTEAM/PANJI). */
  units: string[];
  isBpmj: boolean;
  isBendahara: boolean;
  isSuperadmin: boolean;
  loading: boolean;
  /** True bila tab jemaat boleh dibuka. */
  canSee: (tabId: string) => boolean;
};

/** Unit jemaat pengguna untuk gating nav/panel jemaat. */
export function useMyChurchUnits(): MyChurchUnits {
  const [state, setState] = useState({ units: [] as string[], isBpmj: false, isBendahara: false, isSuperadmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/church-units', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const up = (arr: unknown) => (Array.isArray(arr) ? arr.map(String).map((x) => x.toUpperCase()) : []);
        setState({
          units: up(d?.units),
          isBpmj: Boolean(d?.isBpmj),
          isBendahara: Boolean(d?.isBendahara),
          isSuperadmin: Boolean(d?.isSuperadmin),
          loading: false,
        });
      })
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, []);

  return {
    ...state,
    canSee: (tabId: string) => canSeeChurchTab(
      { isSuperadmin: state.isSuperadmin, isBpmj: state.isBpmj, units: state.units },
      tabId,
    ),
  };
}
