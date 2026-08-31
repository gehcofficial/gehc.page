import { UserRole } from '../types';

/** Derive role flags from effective portal role */
export function useRoleFlags(currentRole: UserRole) {
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const isBpmj = currentRole === 'BPMJ';
  const isKomisi = currentRole === 'KOMISI';
  const isCommittee = currentRole === 'COMMITTEE';
  const isMentor = currentRole === 'MENTOR';
  const isCoMentor = currentRole === 'CO_MENTOR';
  const isGroupMentor = isMentor || isCoMentor;
  const isMentee = currentRole === 'MENTEE';
  const isAlumni = currentRole === 'ALUMNI';

  return {
    currentRole,
    isSuperAdmin,
    isBpmj,
    isKomisi,
    isCommittee,
    isMentor,
    isCoMentor,
    isGroupMentor,
    isMentee,
    isAlumni,
  };
}
