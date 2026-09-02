export interface OrgNode {
  id: string;
  domain: string;
  parentId: string | null;
  slug: string;
  label: string;
  nodeKind: string;
  metadata?: Record<string, unknown> | null;
  sortOrder: number;
  children?: OrgNode[];
}

export const ORG_DOMAINS = [
  { id: 'YOUTH', label: 'Pemuda (YOUTH)' },
  { id: 'KOLOM', label: 'Kolom (KOLOM)' },
];

export function flattenBranches(nodes: OrgNode[]): OrgNode[] {
  return nodes.filter((n) => n.nodeKind === 'BRANCH' || n.nodeKind === 'GROUP_REF');
}

export function collectAssignableSlots(node: OrgNode | null): OrgNode[] {
  if (!node) return [];
  const out: OrgNode[] = [];
  const walk = (n: OrgNode, prefix: string) => {
    const label = prefix ? `${prefix} → ${n.label}` : n.label;
    if (n.nodeKind === 'POSITION_SLOT' || n.nodeKind === 'GROUP_REF') {
      out.push({ ...n, label });
      return;
    }
    (n.children || []).forEach((c) => walk(c, label));
  };
  walk(node, '');
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}
