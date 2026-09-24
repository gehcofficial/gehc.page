import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

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
    isSuperAdmin,
    isBpmj,
    isKomisi,
    isCommittee,
    isGroupMentor,
    isMentee,
  } = useApp();

  const [didaskaliaOfficer, setDidaskaliaOfficer] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/penatalayan-access', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setDidaskaliaOfficer(Boolean(d?.didaskaliaOfficer)); })
      .catch(() => { /* abaikan */ });
    return () => { cancelled = true; };
  }, []);

  const isPriv = isSuperAdmin || isBpmj || isKomisi || isCommittee;
  const isBeyonder = isGroupMentor || isMentee;
  // 01 Pembekalan: mentor/co + staf (topeng aktif) + petugas Didaskalia terjadwal.
  const canView01 = isGroupMentor || isPriv || didaskaliaOfficer;
  // 03 RHB: beyonders + staf (topeng aktif)
  const canView03 = isBeyonder || isPriv;
  const canViewInternal = isPriv;
  // Bonding privat: hanya beyonder grup + SUPERADMIN/KOMISI/BOD COMMITTEE (BPMJ tidak).
  const canViewBonding = isBeyonder || isSuperAdmin || isKomisi || isCommittee;

  return {
    isPriv,
    isMentor: isGroupMentor,
    isBeyonder,
    canView01,
    canView03,
    canViewInternal,
    canViewBonding,
    didaskaliaOfficer,
  };
}
