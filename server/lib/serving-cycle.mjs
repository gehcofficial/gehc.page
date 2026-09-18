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

// ---------- Urutan siklus dari DB (dapat diubah admin) ----------

const CYCLE_PAIRS_CACHE_MS = 30_000;
let cycleCache = { at: 0, rows: null };

/** Buang cache urutan siklus (dipanggil setelah admin menyimpan perubahan). */
export function invalidateCyclePairsCache() {
  cycleCache = { at: 0, rows: null };
}

/**
 * Ambil 10 pasangan siklus dari `serving_cycle_pairs`.
 * Selalu mengembalikan 10 baris; bila tabel kosong/belum ada → fallback SERVING_PAIRS.
 */
export async function loadCyclePairs(prisma, { fresh = false } = {}) {
  if (!fresh && cycleCache.rows && Date.now() - cycleCache.at < CYCLE_PAIRS_CACHE_MS) {
    return cycleCache.rows;
  }
  const fallback = SERVING_PAIRS.map(([responsibleName, hostName], cycleIndex) => ({
    cycleIndex,
    responsibleGroupId: null,
    hostGroupId: null,
    responsibleName,
    hostName,
    fromDb: false,
  }));
  if (!prisma) {
    cycleCache = { at: Date.now(), rows: fallback };
    return fallback;
  }
  try {
    const rows = await prisma.servingCyclePair.findMany({
      orderBy: { cycleIndex: 'asc' },
      include: {
        responsibleGroup: { select: { id: true, name: true } },
        hostGroup: { select: { id: true, name: true } },
      },
    });
    if (!rows.length) {
      cycleCache = { at: Date.now(), rows: fallback };
      return fallback;
    }
    const byIndex = new Map(rows.map((r) => [r.cycleIndex, r]));
    const out = [];
    for (let i = 0; i < 10; i++) {
      const r = byIndex.get(i);
      if (r) {
        out.push({
          cycleIndex: i,
          responsibleGroupId: r.responsibleGroupId,
          hostGroupId: r.hostGroupId,
          responsibleName: r.responsibleGroup?.name || String(r.responsibleGroupId),
          hostName: r.hostGroup?.name || String(r.hostGroupId),
          fromDb: true,
        });
      } else {
        out.push({ ...fallback[i] });
      }
    }
    cycleCache = { at: Date.now(), rows: out };
    return out;
  } catch {
    cycleCache = { at: Date.now(), rows: fallback };
    return fallback;
  }
}

/** resolvePairIds versi DB-backed (fallback ke konstanta). */
export async function resolvePairIdsDb(prisma, cycleIndex, groupRows) {
  const pairs = await loadCyclePairs(prisma);
  return pairFromList(pairs, cycleIndex, groupRows);
}

/** Ambil pasangan dari daftar (pure) — dipakai resolver DB & unit test. */
export function pairFromList(pairs, cycleIndex, groupRows = []) {
  const i = ((Number(cycleIndex) % 10) + 10) % 10;
  const pair = (pairs || [])[i];
  if (!pair) {
    const [responsibleName, hostName] = pairFor(i);
    return {
      responsibleGroupId: resolveGroupIdByName(responsibleName, groupRows),
      hostGroupId: resolveGroupIdByName(hostName, groupRows),
      responsibleName,
      hostName,
    };
  }
  const respName = pair.responsibleName || pair.name || '';
  const hostName = pair.hostName || '';
  return {
    responsibleGroupId: pair.responsibleGroupId || resolveGroupIdByName(respName, groupRows),
    hostGroupId: pair.hostGroupId || resolveGroupIdByName(hostName, groupRows),
    responsibleName: respName,
    hostName,
  };
}

/** Tukar dua grup di seluruh daftar pasangan (pure). */
export function swapGroupsInPairs(pairs, aGroupId, bGroupId, groupRows = null) {
  const swap = (id) => (id === aGroupId ? bGroupId : id === bGroupId ? aGroupId : id);
  const nameOf = groupRows
    ? (id) => (groupRows || []).find((g) => g.id === id)?.name || id
    : null;
  return (pairs || []).map((p) => {
    const responsibleGroupId = swap(p.responsibleGroupId);
    const hostGroupId = swap(p.hostGroupId);
    return {
      ...p,
      responsibleGroupId,
      hostGroupId,
      ...(nameOf ? { responsibleName: nameOf(responsibleGroupId), hostName: nameOf(hostGroupId) } : {}),
    };
  });
}

/** Validasi daftar pasangan: 10 baris, id valid, tidak dobel per peran. */
export function validateCyclePairs(list, groupRows = []) {
  const errors = [];
  if (!Array.isArray(list) || list.length !== 10) {
    errors.push('Harus tepat 10 pasangan siklus.');
    return { ok: false, errors };
  }
  const validIds = new Set((groupRows || []).map((g) => g.id));
  const seenResp = new Set();
  const seenHost = new Set();
  const seenIndex = new Set();
  for (const p of list) {
    const idx = Number(p?.cycleIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 9) errors.push(`cycleIndex tidak valid: ${p?.cycleIndex}`);
    else if (seenIndex.has(idx)) errors.push(`cycleIndex dobel: ${idx}`);
    seenIndex.add(idx);
    if (!p?.responsibleGroupId || !p?.hostGroupId) {
      errors.push(`Pasangan ${idx}: penanggung & tuan rumah wajib.`);
      continue;
    }
    if (validIds.size) {
      if (!validIds.has(p.responsibleGroupId)) errors.push(`Pasangan ${idx}: grup penanggung tidak dikenal.`);
      if (!validIds.has(p.hostGroupId)) errors.push(`Pasangan ${idx}: grup tuan rumah tidak dikenal.`);
    }
    if (seenResp.has(p.responsibleGroupId)) errors.push(`Grup penanggung dobel: ${p.responsibleGroupId}`);
    if (seenHost.has(p.hostGroupId)) errors.push(`Grup tuan rumah dobel: ${p.hostGroupId}`);
    seenResp.add(p.responsibleGroupId);
    seenHost.add(p.hostGroupId);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Pratinjau perubahan baris nyata bila urutan siklus diganti (pure).
 * rows: [{ id, eventDate, cycleIndex, isSwapped, responsibleGroupId, hostGroupId }]
 * Mengembalikan daftar { eventDate, before, after } — hanya yang berubah.
 */
export function diffAssignments(rows, pairs, groupRows, fromISO) {
  const from = String(fromISO || '').slice(0, 10);
  const groupName = (id) => (groupRows || []).find((g) => g.id === id)?.name || id || '—';
  const out = [];
  for (const row of rows || []) {
    const iso = row.eventDate instanceof Date
      ? row.eventDate.toISOString().slice(0, 10)
      : String(row.eventDate || '').slice(0, 10);
    if (!iso || (from && iso < from)) continue;
    if (row.isSwapped) continue; // baris tukar manual: jangan diubah
    const target = pairFromList(pairs, row.cycleIndex, groupRows);
    if (!target.responsibleGroupId && !target.hostGroupId) continue;
    const before = { responsibleGroupId: row.responsibleGroupId, hostGroupId: row.hostGroupId };
    const after = {
      responsibleGroupId: target.responsibleGroupId || row.responsibleGroupId,
      hostGroupId: target.hostGroupId || row.hostGroupId,
    };
    if (before.responsibleGroupId === after.responsibleGroupId && before.hostGroupId === after.hostGroupId) continue;
    out.push({
      id: row.id,
      eventDate: iso,
      cycleIndex: row.cycleIndex,
      before: { responsibleGroupId: before.responsibleGroupId, responsibleName: groupName(before.responsibleGroupId), hostGroupId: before.hostGroupId, hostName: groupName(before.hostGroupId) },
      after: { responsibleGroupId: after.responsibleGroupId, responsibleName: groupName(after.responsibleGroupId), hostGroupId: after.hostGroupId, hostName: groupName(after.hostGroupId) },
    });
  }
  return out;
}
