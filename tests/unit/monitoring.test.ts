import { describe, expect, it } from 'vitest';
import { filterVisibleMonitoring, serializeMonitoring } from '../../server/lib/monitoring.mjs';

const ROWS = [
  { id: 'a', groupId: 'grp-10', mentorId: 'usr-mentor', date: new Date('2026-09-08T00:00:00Z'), data: { meetingTopic: 'PA' } },
  { id: 'b', groupId: 'grp-1', mentorId: 'usr-lain', date: '2026-09-01', data: {} },
];

describe('serializeMonitoring', () => {
  it('memetakan baris Prisma ke bentuk klien', () => {
    const s = serializeMonitoring(ROWS[0], { groupName: 'Echad', mentorName: 'Holly' });
    expect(s).toMatchObject({
      id: 'a',
      group_id: 'grp-10',
      group_name: 'Echad',
      mentor_id: 'usr-mentor',
      mentor_name: 'Holly',
      date: '2026-09-08',
    });
  });
});

describe('filterVisibleMonitoring', () => {
  it('admin melihat semua', () => {
    expect(filterVisibleMonitoring({ id: 'x', roles: [] }, ROWS, { admin: true })).toHaveLength(2);
  });

  it('mentor melihat grupnya + laporannya sendiri', () => {
    const me = { id: 'usr-mentor', roles: [{ role: 'MENTOR', groupId: 'grp-10' }] };
    expect(filterVisibleMonitoring(me, ROWS).map((r) => r.id)).toEqual(['a']);
  });

  it('tanpa grup dan bukan pelapor → kosong', () => {
    const me = { id: 'usr-asing', roles: [{ role: 'MENTOR', groupId: 'grp-9' }] };
    expect(filterVisibleMonitoring(me, ROWS)).toHaveLength(0);
  });

  it('tanpa user → kosong', () => {
    expect(filterVisibleMonitoring(null, ROWS)).toHaveLength(0);
  });
});
