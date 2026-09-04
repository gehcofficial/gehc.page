import { useQuery } from '@tanstack/react-query';

export type PublicOrgMember = {
  id: string;
  slotId?: string;
  name: string;
  position?: string | null;
  division?: string | null;
  subdivision?: string | null;
  photoUrl?: string | null;
  order: number;
  isOpenRole?: boolean;
};

type PublicOrgTree = {
  members: PublicOrgMember[];
  hasRealPeople: boolean;
};

export const PUBLIC_ORG_TREE_QUERY_KEY = ['org-public-tree'] as const;

async function fetchPublicOrgTree(): Promise<PublicOrgTree> {
  const r = await fetch('/api/org/public-tree');
  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  return {
    members: Array.isArray(d.members) ? d.members : [],
    hasRealPeople: Boolean(d.hasRealPeople),
  };
}

export function usePublicOrgTree() {
  return useQuery({
    queryKey: PUBLIC_ORG_TREE_QUERY_KEY,
    queryFn: fetchPublicOrgTree,
    staleTime: 60_000,
    retry: 1,
  });
}
