import { describe, expect, it } from 'vitest';
import { congregationUserWhere, isSystemAccount } from '../../server/lib/system-users.mjs';
import {
  assignmentBranches,
  nestedDomainOf,
  ORG_DOMAINS,
  DEFAULT_ORG_DOMAIN,
} from '../../src/lib/org-tree-utils';

describe('system accounts', () => {
  it('treats platform.ops and SYSTEM_LEGACY as non-person', () => {
    expect(isSystemAccount({ id: 'usr-platform-ops', accountKind: 'INVITED' })).toBe(true);
    expect(isSystemAccount({ id: 'usr-1', loginUsername: 'platform.ops' })).toBe(true);
    expect(isSystemAccount({ id: 'usr-1', accountKind: 'SYSTEM_LEGACY' })).toBe(true);
    expect(isSystemAccount({ id: 'usr-1', accountKind: 'INVITED', loginUsername: 'alvandi' })).toBe(false);
  });

  it('congregationUserWhere excludes system ids and SYSTEM_LEGACY', () => {
    const where = congregationUserWhere();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: { notIn: expect.arrayContaining(['usr-platform-ops']) } }),
        { accountKind: { not: 'SYSTEM_LEGACY' } },
      ]),
    );
  });
});

describe('org assignment domains', () => {
  it('picker order is Jemaat → BIPRA → Kolom', () => {
    expect(ORG_DOMAINS.map((d) => d.id)).toEqual(['CHURCH', 'BIPRA', 'KOLOM']);
    expect(DEFAULT_ORG_DOMAIN).toBe('CHURCH');
  });

  it('hides BPMJ when listing YOUTH branches', () => {
    const nodes = [
      { id: '1', domain: 'YOUTH', parentId: null, slug: 'BPMJ', label: 'BPMJ', nodeKind: 'BRANCH', sortOrder: 1 },
      { id: '2', domain: 'YOUTH', parentId: null, slug: 'KOMISI', label: 'Komisi', nodeKind: 'BRANCH', sortOrder: 2 },
    ];
    expect(assignmentBranches(nodes, 'YOUTH').map((n) => n.slug)).toEqual(['KOMISI']);
  });

  it('reads nestedDomain from Pemuda BIPRA branch', () => {
    expect(nestedDomainOf({
      id: 'p',
      domain: 'BIPRA',
      parentId: null,
      slug: 'PEMUDA',
      label: 'Pemuda',
      nodeKind: 'BRANCH',
      sortOrder: 3,
      metadata: { nestedDomain: 'YOUTH' },
    })).toBe('YOUTH');
  });
});
