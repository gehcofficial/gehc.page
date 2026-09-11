/**
 * Siklus Serving Day — 10 pasangan tetap, loop + swap.
 * W1 MENTORING_DAY tidak consume idx, hanya SERVING_DAY.
 */

export const SERVING_PAIRS = [
  ['Echad', 'Ruach'],
  ['Kairos', 'Shalom'],
  ['Agape', 'Metanoia'],
  ['Avodah', 'Hesed'],
  ['Logos', 'Dunamis'],
  ['Ruach', 'Echad'],
  ['Shalom', 'Kairos'],
  ['Metanoia', 'Agape'],
  ['Hesed', 'Avodah'],
  ['Dunamis', 'Logos'],
];

export function normalizeGroupName(s) {
  return String(s || '').trim();
}

export function pairFor(cycleIndex) {
  const i = ((Number(cycleIndex) % 10) + 10) % 10;
  return SERVING_PAIRS[i];
}

export function nextCycleIndex(servingCount) {
  return ((Number(servingCount) % 10) + 10) % 10;
}

/**
 * Map nama group case-insensitive ke id dari rows Group.
 */
export function resolveGroupIdByName(name, groupRows) {
  const target = normalizeGroupName(name).toUpperCase();
  // Prefer canonical grp-1..grp-10 over fallback grp-avodah etc if duplicates exist
  const candidates = groupRows.filter((g) => String(g.name || '').toUpperCase() === target);
  if (!candidates.length) return null;
  const canonical = candidates.find((g) => /^grp-\d+$/.test(String(g.id)));
  return (canonical || candidates[0]).id;
}

export function resolvePairIds(cycleIndex, groupRows) {
  const [respName, hostName] = pairFor(cycleIndex);
  return {
    responsibleGroupId: resolveGroupIdByName(respName, groupRows),
    hostGroupId: resolveGroupIdByName(hostName, groupRows),
    responsibleName: respName,
    hostName: hostName,
  };
}
