/** Anggota yang boleh tampil di landing / carousel tanpa login. */
export function toPublicMember(member) {
  if (!member) return member;
  const user = member.user
    ? { avatar: member.user.avatar || null, name: member.user.name || null }
    : undefined;
  return {
    id: member.id,
    groupId: member.groupId,
    batchPeriod: member.batchPeriod ?? null,
    name: member.name,
    familyRole: member.familyRole,
    status: member.status,
    alumniDate: member.alumniDate ?? null,
    ...(user ? { user } : {}),
  };
}

/** Batch publik: nama mentor tampil, id akun tidak. */
export function toPublicBatch(batch) {
  if (!batch || typeof batch !== 'object') return batch;
  const rest = { ...batch };
  delete rest.mentorUserId;
  delete rest.comentorUserId;
  return rest;
}

export function toPublicGroup(group) {
  if (!group) return group;
  return {
    ...group,
    batches: (group.batches || []).map(toPublicBatch),
    members: (group.members || []).map(toPublicMember),
  };
}

/** Pengurus publik: nama, jabatan, foto. Tanpa email, telepon, atau id akun. */
export function toPublicStrukturMember(member) {
  if (!member || typeof member !== 'object') return member;
  const rest = { ...member };
  delete rest.email;
  delete rest.phone;
  delete rest.userId;
  return rest;
}
