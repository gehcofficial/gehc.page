/**
 * RBAC materi Didaskalia (01 pembekalan, 02 khutbah, 03 rhb) — satu sumber
 * untuk klien (topeng peran + flag penugasan) dan server (peran efektif).
 */

export function normalizeMaterialRoles(roles) {
  return (Array.isArray(roles) ? roles : []).map((r) => String(r || '').toUpperCase());
}

/** Alias dokumen / label lama (tetap terbaca, tidak menulis DB). */
export function normalizeMaterialDoc(doc) {
  const d = String(doc || '').toLowerCase();
  if (d === '01' || d === 'modul-01' || d === 'modul pembekalan') return 'pembekalan';
  if (d === '02' || d === 'ringkasan' || d === 'khotbah') return 'khutbah';
  if (d === '03' || d === 'rhb') return 'rhb';
  return d;
}

/**
 * @param {'pembekalan'|'khutbah'|'rhb'|string} doc
 * @param {{ roles?: string[], didaskaliaOfficer?: boolean, didaskaliaTeam?: boolean }} access
 * @returns {{ visible: boolean, reason?: string }}
 */
export function materialVisibility(doc, access = {}) {
  const d = normalizeMaterialDoc(doc);
  const roles = normalizeMaterialRoles(access.roles);
  const isPriv = ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'].some((r) => roles.includes(r));
  const isMentor = roles.includes('MENTOR') || roles.includes('CO_MENTOR');
  const isBeyonder = isMentor || roles.includes('MENTEE');
  const officer = Boolean(access.didaskaliaOfficer);
  const team = Boolean(access.didaskaliaTeam);

  if (d === 'khutbah' || d === 'rhb') {
    if (isBeyonder || isPriv || team) return { visible: true };
    return {
      visible: false,
      reason: d === 'rhb'
        ? 'RHB hanya untuk Beyonders (mentor/mentee), staf, atau tim Didaskalia.'
        : 'Ringkasan khotbah hanya untuk Beyonders (mentor/mentee), staf, atau tim Didaskalia.',
    };
  }
  if (d === 'pembekalan') {
    if (isMentor || isPriv || officer || team) return { visible: true };
    return {
      visible: false,
      reason: 'Modul Pembekalan hanya untuk mentor/co-mentor, komisi/BPMJ/komite/superadmin, petugas Didaskalia yang ditugaskan, atau tim Didaskalia (HoD/anggota).',
    };
  }
  return { visible: false, reason: 'Jenis materi tidak dikenal.' };
}

/** Ringkas untuk pengecekan boolean (server & test). */
export function canViewMaterialDoc(roles, doc, access = {}) {
  return materialVisibility(doc, { ...access, roles }).visible;
}
