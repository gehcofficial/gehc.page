import { useApp } from '../context/AppContext';

/**
 * Hak akses materi by event mengikuti KONTEKS PERAN AKTIF (topeng),
 * bukan semua role yang dimiliki akun — agar superadmin yang sedang
 * memakai topeng MENTEE benar-benar melihat sebagai mentee.
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

  const isPriv = isSuperAdmin || isBpmj || isKomisi || isCommittee;
  const isBeyonder = isGroupMentor || isMentee;
  // 01 Pembekalan: hanya mentor/co + staf (topeng aktif)
  const canView01 = isGroupMentor || isPriv;
  // 03 RHB: beyonders + staf (topeng aktif)
  const canView03 = isBeyonder || isPriv;
  const canViewInternal = isPriv;
  const canViewBonding = isBeyonder || isPriv;

  return {
    isPriv,
    isMentor: isGroupMentor,
    isBeyonder,
    canView01,
    canView03,
    canViewInternal,
    canViewBonding,
  };
}
