import { useEffect, useState } from 'react';
import { canSeeDivisionTab } from '../lib/portal-nav-config';

export type MyDivisions = {
  /** Divisi tempat user menjadi anggota (struktur / RoleAssignment / Tim Kerja event). */
  divisions: string[];
  /** Divisi tempat user menjadi kepala (LEAD/CO_LEAD). */
  headDivisions: string[];
  isSuperadmin: boolean;
  isKomisi: boolean;
  isBodCommittee: boolean;
  loading: boolean;
  /** True bila tab panel divisi boleh dibuka user ini. */
  canSee: (tabId: string) => boolean;
};

/** Divisi pengguna untuk gating nav/panel per-divisi. */
export function useMyDivisions(): MyDivisions {
  const [state, setState] = useState({
    divisions: [] as string[],
    headDivisions: [] as string[],
    isSuperadmin: false,
    isKomisi: false,
    isBodCommittee: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/divisions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const up = (arr: unknown) => (Array.isArray(arr) ? arr.map(String).map((x) => x.toUpperCase()) : []);
        setState({
          divisions: up(d?.divisions),
          headDivisions: up(d?.headDivisions),
          isSuperadmin: Boolean(d?.isSuperadmin),
          isKomisi: Boolean(d?.isKomisi),
          isBodCommittee: Boolean(d?.isBodCommittee),
          loading: false,
        });
      })
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, []);

  return {
    ...state,
    canSee: (tabId: string) => canSeeDivisionTab(
      {
        isSuperadmin: state.isSuperadmin,
        isKomisi: state.isKomisi,
        isBodCommittee: state.isBodCommittee,
        divisions: state.divisions,
        headDivisions: state.headDivisions,
      },
      tabId,
    ),
  };
}
