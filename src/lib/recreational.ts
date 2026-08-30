export interface RecreationalNode {
  id: string;
  slug: string;
  name: string;
  kind: string;
  parentId?: string | null;
  selectable?: boolean;
  sortOrder?: number;
  children?: RecreationalNode[];
}

export function buildRecreationalTree(flat: RecreationalNode[]): RecreationalNode[] {
  const byId = new Map(flat.map((r) => [r.id, { ...r, children: [] as RecreationalNode[] }]));
  const roots: RecreationalNode[] = [];
  for (const r of byId.values()) {
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.children!.push(r);
    } else if (!r.parentId) {
      roots.push(r);
    }
  }
  const sort = (nodes: RecreationalNode[]) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    nodes.forEach((n) => n.children?.length && sort(n.children));
  };
  sort(roots);
  return roots;
}

export function recreationalLeaves(flat: RecreationalNode[]): RecreationalNode[] {
  return flat.filter((r) => r.selectable !== false);
}

export function recreationalByKind(flat: RecreationalNode[], kind: string): RecreationalNode[] {
  return flat.filter((r) => r.kind === kind && !r.parentId);
}

export function collectDescendantIds(flat: RecreationalNode[], slugOrId: string): string[] {
  const byId = new Map(flat.map((r) => [r.id, r]));
  const bySlug = new Map(flat.map((r) => [r.slug, r]));
  const start = bySlug.get(slugOrId) || byId.get(slugOrId);
  if (!start) return [];
  const ids: string[] = [];
  const walk = (id: string) => {
    const node = byId.get(id);
    if (!node) return;
    const kids = flat.filter((r) => r.parentId === id);
    if (!kids.length && node.selectable !== false) ids.push(id);
    else kids.forEach((k) => walk(k.id));
  };
  walk(start.id);
  return ids;
}

export function recreationalLabel(flat: RecreationalNode[], leafId: string): string {
  const byId = new Map(flat.map((r) => [r.id, r]));
  const leaf = byId.get(leafId);
  if (!leaf) return leafId;
  const parent = leaf.parentId ? byId.get(leaf.parentId) : null;
  const pillar = leaf.kind === 'SPORTS' ? 'Sports' : 'Arts';
  if (parent) return `${pillar} · ${parent.name} · ${leaf.name}`;
  return `${pillar} · ${leaf.name}`;
}
