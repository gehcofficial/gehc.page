import { describe, it, expect } from 'vitest';
import { roleParamsFromOrgNode, buildOrgTree } from '../../server/services/org-assign.mjs';

describe('org-assign', () => {
  it('maps BOD Ketua slot to TIMKERJA division and Ketua Tim Kerja position', () => {
    const node = {
      id: 'n1',
      slug: 'BOD_KETUA_TIM_KERJA',
      label: 'Ketua Tim Kerja',
      nodeKind: 'POSITION_SLOT',
      metadata: {
        portalRole: 'COMMITTEE',
        division: 'TIMKERJA',
        position: 'Ketua Tim Kerja',
        maxAssignees: 1,
      },
    };
    const params = roleParamsFromOrgNode(node);
    expect(params.role).toBe('COMMITTEE');
    expect(params.division).toBe('TIMKERJA');
    expect(params.position).toBe('Ketua Tim Kerja');
  });

  it('maps Kolom diaken slot with leader metadata', () => {
    const node = {
      id: 'k1',
      slug: 'KOLOM_1_DIAKEN',
      label: 'Diaken Kolom',
      nodeKind: 'POSITION_SLOT',
      metadata: {
        linkedKolomId: 'kol-1',
        position: 'Diaken',
        leaderKind: 'DIAKEN',
        maxAssignees: 1,
      },
    };
    const params = roleParamsFromOrgNode(node);
    expect(params.role).toBeNull();
    expect(params.position).toBe('Diaken');
  });

  it('builds sorted org tree from flat nodes', () => {
    const tree = buildOrgTree([
      { id: 'b', parentId: null, label: 'B', sortOrder: 2, slug: 'B' },
      { id: 'a', parentId: null, label: 'A', sortOrder: 1, slug: 'A' },
      { id: 'c', parentId: 'a', label: 'C', sortOrder: 1, slug: 'C' },
    ]);
    expect(tree.map((n) => n.id)).toEqual(['a', 'b']);
    expect(tree[0].children[0].id).toBe('c');
  });
});
