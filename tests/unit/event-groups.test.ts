import { describe, expect, it } from 'vitest';
import {
  mergePenatalayanGroupsIntoMetadata,
  normalizePenatalayanGroupsInput,
  parsePenatalayanGroups,
  resolveGroupMentors,
} from '../../server/lib/event-groups.mjs';

describe('parsePenatalayanGroups', () => {
  it('membaca metadata valid', () => {
    expect(parsePenatalayanGroups({ penatalayanGroups: { responsibleGroupId: 'g1', hostGroupId: 'g2' } }))
      .toEqual({ responsibleGroupId: 'g1', hostGroupId: 'g2' });
  });

  it('null bila kosong / bukan objek', () => {
    expect(parsePenatalayanGroups(null)).toBeNull();
    expect(parsePenatalayanGroups({})).toBeNull();
    expect(parsePenatalayanGroups({ penatalayanGroups: {} })).toBeNull();
    expect(parsePenatalayanGroups({ penatalayanGroups: 'x' })).toBeNull();
  });
});

describe('normalizePenatalayanGroupsInput', () => {
  it('undefined = tidak diubah', () => {
    expect(normalizePenatalayanGroupsInput(undefined)).toEqual({ ok: true, value: undefined });
  });

  it('null / kosong = hapus', () => {
    expect(normalizePenatalayanGroupsInput(null)).toEqual({ ok: true, value: null });
    expect(normalizePenatalayanGroupsInput({})).toEqual({ ok: true, value: null });
  });

  it('pasangan lengkap valid', () => {
    const r = normalizePenatalayanGroupsInput({ responsibleGroupId: 'grp-1', hostGroupId: 'grp_2' });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ responsibleGroupId: 'grp-1', hostGroupId: 'grp_2' });
  });

  it('hanya satu grup / id aneh = error', () => {
    expect(normalizePenatalayanGroupsInput({ responsibleGroupId: 'g1' }).ok).toBe(false);
    expect(normalizePenatalayanGroupsInput({ hostGroupId: 'g1' }).ok).toBe(false);
    expect(normalizePenatalayanGroupsInput({ responsibleGroupId: 'g 1', hostGroupId: 'g2' }).ok).toBe(false);
    expect(normalizePenatalayanGroupsInput('x').ok).toBe(false);
  });
});

describe('mergePenatalayanGroupsIntoMetadata', () => {
  it('set & hapus tanpa merusak field lain', () => {
    const meta = { cycleIndex: 5, weekIndex: 1 };
    const set = mergePenatalayanGroupsIntoMetadata(meta, { responsibleGroupId: 'a', hostGroupId: 'b' });
    expect(set.cycleIndex).toBe(5);
    expect(set.penatalayanGroups).toEqual({ responsibleGroupId: 'a', hostGroupId: 'b' });
    const cleared = mergePenatalayanGroupsIntoMetadata(set, null);
    expect(cleared.penatalayanGroups).toBeUndefined();
    expect(cleared.weekIndex).toBe(1);
  });
});

describe('resolveGroupMentors', () => {
  const prisma = (rows: unknown[]) => ({
    groupMember: { findMany: async () => rows },
  });

  it('memetakan peran grup, namespace, dan dedupe user', () => {
    const rows = [
      { userId: 'u1', familyRole: 'MENTOR', groupId: 'g-resp', user: { name: 'Sari' }, group: { name: 'Echad' } },
      { userId: 'u2', familyRole: 'COMENTOR', groupId: 'g-resp', user: { name: 'Budi' }, group: { name: 'Echad' } },
      { userId: 'u3', familyRole: 'MENTOR', groupId: 'g-host', user: { name: 'Rina' }, group: { name: 'Ruach' } },
      { userId: 'u1', familyRole: 'MENTOR', groupId: 'g-host', user: { name: 'Sari' }, group: { name: 'Ruach' } },
    ];
    return resolveGroupMentors(prisma(rows) as never, { responsibleGroupId: 'g-resp', hostGroupId: 'g-host' }).then((out) => {
      expect(out.map((m) => `${m.userId}:${m.groupRole}:${m.namespace}`)).toEqual([
        'u1:PENANGGUNGJAWAB:mentor',
        'u2:PENANGGUNGJAWAB:co-mentor',
        'u3:TUAN_RUMAH:mentor',
      ]);
      expect(out[0].groupName).toBe('Echad');
    });
  });

  it('null tanpa grup / prisma', async () => {
    expect(await resolveGroupMentors(null as never, { responsibleGroupId: 'a' })).toEqual([]);
    expect(await resolveGroupMentors(prisma([]) as never, null as never)).toEqual([]);
  });
});
