/**
 * Regenerasi Kelompok - Penamaan Generasi
 * 
 * Aturan:
 * - Parent group (e.g., "Agape") → children: "Agape 1", "Agape 2", "Agape 3"
 * - Parent group tanpa angka di akhir nama = base name
 * - Child group nama = `${baseName} ${number}` (number mulai dari 1)
 * - Landing page hanya menampilkan parent groups (parentGroupId === null)
 * - Detail page menampilkan seluruh generasi via HeritageSection
 */

export function getBaseGroupName(name: string): string {
  // Remove trailing " N" where N is a number (e.g., "Agape 1" → "Agape")
  return name.replace(/\s+\d+$/, '').trim();
}

export function getGenerationNumber(name: string): number | null {
  // Extract number from end of name (e.g., "Agape 1" → 1, "Agape" → null)
  const match = name.match(/\s+(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function isParentGroup(name: string, parentGroupId: string | null): boolean {
  return !parentGroupId && getGenerationNumber(name) === null;
}

export function generateChildGroupName(parentName: string, existingChildren: string[]): string {
  const baseName = getBaseGroupName(parentName);
  const childNumbers = existingChildren
    .map((child) => getGenerationNumber(child))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  let nextNumber = 1;
  for (const num of childNumbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else {
      break;
    }
  }

  return `${baseName} ${nextNumber}`;
}

export function getGroupGenerationInfo(groups: { id: string; name: string; parentGroupId: string | null }[], groupId: string): {
  baseName: string;
  generation: number;
  isParent: boolean;
  children: string[];
  siblings: string[];
} {
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    return { baseName: '', generation: 0, isParent: true, children: [], siblings: [] };
  }

  const baseName = getBaseGroupName(group.name);
  const generation = getGenerationNumber(group.name) ?? 0;
  const isParent = !group.parentGroupId && generation === 0;

  // Find all groups with same base name
  const relatedGroups = groups.filter((g) => getBaseGroupName(g.name) === baseName);
  const children = relatedGroups
    .filter((g) => g.parentGroupId === groupId)
    .map((g) => g.name);
  const siblings = relatedGroups
    .filter((g) => g.parentGroupId === group.parentGroupId && g.id !== groupId)
    .map((g) => g.name);

  return { baseName, generation, isParent, children, siblings };
}

export function sortGroupsByGeneration(groups: { id: string; name: string; parentGroupId: string | null }[]): { id: string; name: string; parentGroupId: string | null }[] {
  return [...groups].sort((a, b) => {
    const aBase = getBaseGroupName(a.name);
    const bBase = getBaseGroupName(b.name);
    
    if (aBase !== bBase) {
      return aBase.localeCompare(bBase);
    }
    
    const aGen = getGenerationNumber(a.name) ?? 0;
    const bGen = getGenerationNumber(b.name) ?? 0;
    
    return aGen - bGen;
  });
}

export function getGroupDisplayName(group: { id: string; name: string; parentGroupId: string | null }, groups: { id: string; name: string; parentGroupId: string | null }[]): string {
  const info = getGroupGenerationInfo(groups, group.id);
  if (info.isParent) {
    return `${group.name} (Induk)`;
  }
  return `${group.name} (Gen-${info.generation})`;
}