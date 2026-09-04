import { TEN_HOMES } from './website-visuals.mjs';

export const GEN0_PERIOD = '2026-06';
export const GEN0_LABEL = 'Generasi 0 — Retreat UNSHAKABLE';

export function houseKey(name) {
  return String(name || '').trim().toLowerCase();
}

export function isTenHomeName(name) {
  const k = houseKey(name);
  return TEN_HOMES.some((h) => houseKey(h) === k);
}

export function isPeriod(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''));
}

export function namesMatch(a, b) {
  const na = String(a || '').toLowerCase().replace(/\./g, '').trim();
  const nb = String(b || '').toLowerCase().replace(/\./g, '').trim();
  if (!na || !nb || na === 'tbd' || nb === 'tbd') return false;
  if (na === nb) return true;
  if (na.startsWith(nb) || nb.startsWith(na)) return true;
  const fa = na.split(/\s+/)[0];
  const fb = nb.split(/\s+/)[0];
  return fa.length >= 4 && fa === fb;
}

export function leaderMismatch(batchName, batchUserId, live) {
  const named = batchName && String(batchName).trim() && String(batchName).trim().toUpperCase() !== 'TBD';
  if (!live) return Boolean(named);
  if (batchUserId && live.id && batchUserId !== live.id) return true;
  if (named && !namesMatch(batchName, live.name)) return true;
  return false;
}

/** Parent 10 homes: same-name dupes keep the live roster (current batch / members). */
export function pickTenHomes(groups) {
  const score = (g) => {
    const current = (g.batches || []).some((b) => b.isCurrent);
    return (current ? 2 : 0) + ((g.memberCount || 0) > 0 ? 1 : 0);
  };
  const byName = new Map();
  for (const g of groups) {
    if (g.parentGroupId) continue;
    if (!isTenHomeName(g.name)) continue;
    const key = houseKey(g.name);
    const prev = byName.get(key);
    if (!prev || score(g) > score(prev)) byName.set(key, g);
  }
  return TEN_HOMES.map((name) => byName.get(houseKey(name))).filter(Boolean);
}
