import { describe, expect, it } from 'vitest';
import {
  isDemoEmail,
  isLandingPublicSlot,
  publicDivisionOf,
  toPublicOrgMembers,
} from '../../server/services/org-public.mjs';

const slot = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  domain: 'YOUTH',
  slug: 'KOMISI_KETUA_KOMISI',
  label: 'Ketua Komisi',
  nodeKind: 'POSITION_SLOT',
  sortOrder: 0,
  metadata: { portalRole: 'KOMISI', position: 'Ketua Komisi', maxAssignees: 1 },
  ...over,
});

describe('org public landing', () => {
  it('infers BPMJ / KOMISI / TIMKERJA / pillar from slug or metadata', () => {
    expect(publicDivisionOf({ slug: 'BPMJ_KETUA_BPMJ', metadata: { churchOffice: 'BPMJ' } })).toBe('BPMJ');
    expect(publicDivisionOf(slot())).toBe('KOMISI');
    expect(publicDivisionOf({ slug: 'BOD_KETUA_TIM_KERJA', metadata: { division: 'TIMKERJA' } })).toBe('TIMKERJA');
    expect(publicDivisionOf({ slug: 'LITURGIA_HEAD', metadata: {} })).toBe('LITURGIA');
  });

  it('hides Beyonders, Individu, and grouped slots from landing', () => {
    expect(isLandingPublicSlot({ ...slot(), slug: 'BEYONDERS', nodeKind: 'GROUP_REF' })).toBe(false);
    expect(isLandingPublicSlot({ ...slot(), slug: 'INDIVIDU', metadata: { position: 'Individu' } })).toBe(false);
    expect(isLandingPublicSlot({ ...slot(), metadata: { requiresGroup: true } })).toBe(false);
    expect(isLandingPublicSlot(slot())).toBe(true);
  });

  it('treats @gehc.demo as unpublished', () => {
    expect(isDemoEmail('theo@gehc.demo')).toBe(true);
    expect(isDemoEmail('theo@gmail.com')).toBe(false);
  });

  it('publishes assigned people with avatar and keeps empty slots open', () => {
    const nodes = [
      slot({ id: 'filled' }),
      slot({
        id: 'empty',
        slug: 'KOMISI_SEKRETARIS',
        label: 'Sekretaris',
        sortOrder: 2,
        metadata: { position: 'Sekretaris' },
      }),
      {
        id: 'hidden',
        domain: 'YOUTH',
        slug: 'BEYONDERS',
        label: 'Beyonders',
        nodeKind: 'GROUP_REF',
        sortOrder: 9,
        metadata: { requiresGroup: true },
      },
    ];
    const { members, hasRealPeople } = toPublicOrgMembers(nodes, [
      {
        orgNodeId: 'filled',
        isActive: true,
        user: {
          id: 'u1',
          name: 'Theo Kowaas',
          email: 'theo@gehc.id',
          avatar: 'https://cdn.example/theo.jpg',
        },
      },
      {
        orgNodeId: 'filled',
        isActive: true,
        user: { id: 'u-demo', name: 'Demo Ketua', email: 'ketua@gehc.demo', avatar: 'x' },
      },
    ]);

    expect(hasRealPeople).toBe(true);
    expect(members.find((m) => m.id === 'hidden')).toBeUndefined();
    const filled = members.find((m) => m.slotId === 'filled' && !m.isOpenRole);
    expect(filled).toMatchObject({
      name: 'Theo Kowaas',
      position: 'Ketua Komisi',
      division: 'KOMISI',
      photoUrl: 'https://cdn.example/theo.jpg',
    });
    expect(members.some((m) => m.name === 'Demo Ketua')).toBe(false);
    const open = members.find((m) => m.slotId === 'empty');
    expect(open).toMatchObject({ isOpenRole: true, position: 'Sekretaris', division: 'KOMISI' });
  });
});
