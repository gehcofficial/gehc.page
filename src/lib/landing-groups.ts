import type { GroupBatch, YouthGroup } from '../types';

type House = YouthGroup & { parentGroupId?: string | null };

/** Parent houses for the public carousel: empty shells stay visible; same-name dupes keep the live roster. */
export function landingBeyondersHouses(
  groups: House[],
  groupBatches: GroupBatch[] = [],
): YouthGroup[] {
  const hasCurrent = (id: string) =>
    groupBatches.some((b) => b.group_id === id && b.isCurrent);
  const score = (g: House) =>
    (hasCurrent(g.id) ? 2 : 0) + (g.memberCount > 0 ? 1 : 0);
  const byName = new Map<string, House>();
  for (const g of groups.filter((item) => !item.parentGroupId)) {
    const key = g.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || score(g) > score(prev)) byName.set(key, g);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
