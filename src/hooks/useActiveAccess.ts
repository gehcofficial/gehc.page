import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { materialVisibility } from '../lib/material-visibility.mjs';

/**
 * Hak akses materi by event mengikuti KONTEKS PERAN AKTIF (topeng),
 * bukan semua role yang dimiliki akun — agar superadmin yang sedang
 * memakai topeng MENTEE benar-benar melihat sebagai mentee.
 *
 * Tambahan: petugas yang ditugaskan sebagai penatalayan Didaskalia
 * (mis. Pembaca Firman) juga berhak melihat pembekalan pekan itu.
 */
export function useActiveAccess() {
  const {
    currentRole,
    authUser,
    isSuperAdmin,
    isBpmj,
    isKomisi,
    isCommittee,
    isGroupMentor,
    isMentee,
    isBodTimkerja,
  } = useApp();

  const [didaskaliaOfficer, setDidaskaliaOfficer] = useState(false);
  const [didaskaliaTeam, setDidaskaliaTeam] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/me/penatalayan-access', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/me/divisions', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([pen, div]) => {
        if (cancelled) return;
        const up = (arr: unknown) => (Array.isArray(arr) ? arr.map(String).map((x) => x.toUpperCase()) : []);
        const codes = [...up(div?.divisions), ...up(div?.headDivisions)];
        setDidaskaliaOfficer(Boolean(pen?.didaskaliaOfficer));
        setDidaskaliaTeam(codes.includes('DIDASKALIA'));
      })
      .catch(() => { /* abaikan */ });
    return () => { cancelled = true; };
  }, []);

  const roles = useMemo(() => [currentRole], [currentRole]);

  const access = useMemo(
    () => ({ roles, didaskaliaOfficer, didaskaliaTeam }),
    [roles, didaskaliaOfficer, didaskaliaTeam],
  );

  const isBod = Boolean(isBodTimkerja);
  const isPriv = isSuperAdmin || isBpmj || isKomisi || isCommittee;
  const isBeyonder = isGroupMentor || isMentee;
  const pembekalanVis = materialVisibility('pembekalan', access);
  const rhbVis = materialVisibility('rhb', access);
  const canView01 = pembekalanVis.visible;
  const canView03 = rhbVis.visible;
  const canViewInternal = isPriv;
  const canViewBonding = isBeyonder || isSuperAdmin || isKomisi || isCommittee;

  return {
    isPriv,
    isBod,
    isMentor: isGroupMentor,
    isBeyonder,
    canView01,
    canView01Reason: pembekalanVis.visible ? undefined : pembekalanVis.reason,
    canView03,
    canView03Reason: rhbVis.visible ? undefined : rhbVis.reason,
    canViewInternal,
    canViewBonding,
    didaskaliaOfficer,
    didaskaliaTeam,
    materialAccess: access,
  };
}
