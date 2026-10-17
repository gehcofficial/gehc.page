/**
 * Grup penatalayan per event (mentoring day / bedah film dsb).
 *
 * Disimpan di EventProgram.metadata.penatalayanGroups = { responsibleGroupId, hostGroupId }
 * (tanpa migrasi skema). Dipakai untuk:
 * - kartu "Tuan Rumah & Penanggungjawab" di panel event (C1/C3),
 * - routing manual ke mentor/co-mentor kedua grup (C2),
 * - fallback kartu Info Event /api/db/service-schedule (C4).
 */

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Baca penatalayanGroups dari metadata event → { responsibleGroupId, hostGroupId } | null. */
export function parsePenatalayanGroups(metadata) {
  const raw = metadata && typeof metadata === 'object' ? metadata.penatalayanGroups : null;
  if (!raw || typeof raw !== 'object') return null;
  const responsibleGroupId = raw.responsibleGroupId ? String(raw.responsibleGroupId) : null;
  const hostGroupId = raw.hostGroupId ? String(raw.hostGroupId) : null;
  if (!responsibleGroupId && !hostGroupId) return null;
  return { responsibleGroupId, hostGroupId };
}

/**
 * Validasi input dari klien.
 * - undefined → { ok: true, value: undefined } (tidak diubah)
 * - null / kosong → { ok: true, value: null } (hapus)
 * - { responsibleGroupId, hostGroupId } → { ok: true, value } (keduanya wajib)
 */
export function normalizePenatalayanGroupsInput(input) {
  if (input === undefined) return { ok: true, value: undefined };
  if (input === null) return { ok: true, value: null };
  if (typeof input !== 'object') {
    return { ok: false, error: 'penatalayanGroups harus objek { responsibleGroupId, hostGroupId } atau null.' };
  }
  const responsibleGroupId = input.responsibleGroupId ? String(input.responsibleGroupId).trim() : '';
  const hostGroupId = input.hostGroupId ? String(input.hostGroupId).trim() : '';
  if (!responsibleGroupId && !hostGroupId) return { ok: true, value: null };
  if (!responsibleGroupId || !hostGroupId) {
    return { ok: false, error: 'responsibleGroupId & hostGroupId wajib diisi keduanya (atau null untuk menghapus).' };
  }
  if (!ID_RE.test(responsibleGroupId) || !ID_RE.test(hostGroupId)) {
    return { ok: false, error: 'Format id grup tidak valid.' };
  }
  return { ok: true, value: { responsibleGroupId, hostGroupId } };
}

/** Metadata baru dengan penatalayanGroups di-set (value) atau dihapus (null). */
export function mergePenatalayanGroupsIntoMetadata(metadata, groups) {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  if (groups) base.penatalayanGroups = groups;
  else delete base.penatalayanGroups;
  return base;
}

/**
 * Mentor + co-mentor AKTIF dari 1-2 grup → calon penerima routing.
 * Satu user hanya sekali (grup pertama menang bila mentor di dua grup).
 * Return [{ userId, name, groupName, groupRole: 'PENANGGUNGJAWAB'|'TUAN_RUMAH', namespace: 'mentor'|'co-mentor' }]
 */
export async function resolveGroupMentors(prisma, groups) {
  const out = [];
  if (!prisma || !groups) return out;
  const entries = [
    ['PENANGGUNGJAWAB', groups.responsibleGroupId],
    ['TUAN_RUMAH', groups.hostGroupId],
  ].filter(([, id]) => id);
  if (!entries.length) return out;
  const ids = [...new Set(entries.map(([, id]) => String(id)))];
  const rows = await prisma.groupMember.findMany({
    where: { groupId: { in: ids }, status: 'ACTIVE', familyRole: { in: ['MENTOR', 'COMENTOR'] } },
    select: {
      userId: true,
      familyRole: true,
      groupId: true,
      user: { select: { name: true } },
      group: { select: { name: true } },
    },
  }).catch(() => []);
  const seen = new Set();
  for (const [groupRole, groupId] of entries) {
    for (const m of rows || []) {
      if (String(m.groupId) !== String(groupId)) continue;
      const uid = String(m.userId || '');
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      out.push({
        userId: uid,
        name: m.user?.name || uid,
        groupName: m.group?.name || String(groupId),
        groupRole,
        namespace: String(m.familyRole || '').toUpperCase() === 'COMENTOR' ? 'co-mentor' : 'mentor',
      });
    }
  }
  return out;
}
