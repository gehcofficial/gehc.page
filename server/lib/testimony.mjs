/**
 * Undian kesaksian (modul `testimony`) — murni & teruji.
 *
 * Komposisi baku: 2 Mentee + 1 Mentor + 1 Co-mentor (total 4).
 * Bila peran di pool kurang, slot dilengkapi acak dari sisa pool.
 * Yang sudah terpilih dalam sesi ini tidak diundi ulang.
 */

/** Komposisi baku: [peran, jumlah]. */
export const TESTIMONY_NEED = [['MENTEE', 2], ['MENTOR', 1], ['CO_MENTOR', 1]];

export const TESTIMONY_TOTAL = TESTIMONY_NEED.reduce((n, [, c]) => n + c, 0);

/**
 * Klasifikasi peran pool: MENTOR > CO_MENTOR > MENTEE > OTHER.
 * @param roles string[] peran portal user
 */
export function classifyPoolRole(roles) {
  const up = (Array.isArray(roles) ? roles : []).map((r) => String(r?.role || r || '').toUpperCase());
  if (up.includes('MENTOR')) return 'MENTOR';
  if (up.includes('CO_MENTOR')) return 'CO_MENTOR';
  if (up.includes('MENTEE')) return 'MENTEE';
  return 'OTHER';
}

/**
 * Susun undian.
 * @param pool [{ userId, name, roles[] }]
 * @param excludeIds userId yang sudah terpilih (tak diundi ulang)
 * @param need komposisi [[peran, jumlah]]
 * @param rand fungsi acak (diinjeksikan untuk test)
 * @returns [{ userId, name, role, slot }] slot = 1..N
 */
export function composePicks(pool, excludeIds, need = TESTIMONY_NEED, rand = Math.random) {
  const excluded = new Set((excludeIds || []).map(String));
  const rest = (pool || []).filter((p) => p?.userId && !excluded.has(String(p.userId)));
  const byRole = new Map();
  for (const p of rest) {
    const r = classifyPoolRole(p.roles);
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r).push(p);
  }
  const take = (arr, n) => {
    const pool2 = [...arr];
    const out = [];
    while (out.length < n && pool2.length) {
      out.push(pool2.splice(Math.floor(rand() * pool2.length), 1)[0]);
    }
    return out;
  };
  const chosen = [];
  for (const [role, count] of need) {
    for (const p of take(byRole.get(role) || [], count)) {
      chosen.push({ userId: String(p.userId), name: String(p.name || 'Peserta'), role });
      const all = rest.indexOf(p);
      if (all >= 0) rest.splice(all, 1);
    }
  }
  // Lengkapi kekurangan dari sisa pool (peran apa pun).
  const total = need.reduce((n, [, c]) => n + c, 0);
  for (const p of take(rest, Math.max(0, total - chosen.length))) {
    chosen.push({ userId: String(p.userId), name: String(p.name || 'Peserta'), role: classifyPoolRole(p.roles) });
  }
  return chosen.map((c, i) => ({ ...c, slot: i + 1 }));
}
