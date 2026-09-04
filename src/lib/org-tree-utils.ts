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

/** Picker assign: Jemaat → BIPRA → Kolom. Pohon Komisi Pemuda tetap domain YOUTH, disarang di BIPRA/Pemuda. */
export const ORG_DOMAINS = [
  { id: 'CHURCH', label: 'Jemaat' },
  { id: 'BIPRA', label: 'BIPRA' },
  { id: 'KOLOM', label: 'Kolom' },
];

export const DEFAULT_ORG_DOMAIN = 'CHURCH';

export function flattenBranches(nodes: OrgNode[]): OrgNode[] {
  return nodes.filter((n) => n.nodeKind === 'BRANCH' || n.nodeKind === 'GROUP_REF');
}

export function hideYouthBpmjBranches(nodes: OrgNode[]): OrgNode[] {
  return nodes.filter((n) => n.slug !== 'BPMJ' && !String(n.slug || '').startsWith('BPMJ_'));
}

export function assignmentBranches(nodes: OrgNode[], domain?: string): OrgNode[] {
  const list = flattenBranches(nodes);
  if (domain === 'YOUTH') return hideYouthBpmjBranches(list);
  return list;
}

export function nestedDomainOf(node: OrgNode | null): string | null {
  const raw = node?.metadata?.nestedDomain;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().toUpperCase();
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
