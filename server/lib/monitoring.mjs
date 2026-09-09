/**
 * Monitoring kelompok — serialisasi + visibilitas.
 * Dipakai route /api/monitoring (sumber TiDB) agar laporan mentor
 * terlihat Komisi & perangkat lain, bukan hanya localStorage pengirim.
 */

export function serializeMonitoring(row, { groupName = null, mentorName = null } = {}) {
  const date = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || '').slice(0, 10);
  return {
    id: row.id,
    group_id: row.groupId ?? row.group_id,
    group_name: groupName ?? row.groupName ?? row.group_name ?? null,
    mentor_id: row.mentorId ?? row.mentor_id ?? null,
    mentor_name: mentorName ?? row.mentorName ?? row.mentor_name ?? null,
    date,
    data: row.data && typeof row.data === 'object' ? row.data : {},
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt ?? row.created_at ?? null,
  };
}

/**
 * Baris yang boleh dilihat user.
 * - Komisi/Superadmin: semua.
 * - Lainnya: baris grupnya sendiri (dari userRoles.groupId) atau laporannya sendiri.
 */
export function filterVisibleMonitoring(authUser, rows, { admin = false } = {}) {
  if (!authUser) return [];
  if (admin) return rows;
  const myGroups = new Set(
    (authUser.roles || []).map((r) => r.groupId).filter(Boolean),
  );
  return rows.filter((row) => {
    const gid = row.groupId ?? row.group_id;
    const mid = row.mentorId ?? row.mentor_id;
    if (mid && mid === authUser.id) return true;
    if (gid && myGroups.has(gid)) return true;
    return false;
  });
}
