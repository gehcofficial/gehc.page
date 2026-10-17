import { describe, expect, it } from 'vitest';
import {
  MAX_PROPOSAL_ITEMS,
  normalizeProposalItems,
  proposalRowKey,
} from '../../server/lib/penatalayan-proposals.mjs';

describe('penatalayan-proposals: normalize', () => {
  it('menerima multi-role x multi-people 1 tanggal', () => {
    const out = normalizeProposalItems({
      date: '2026-10-25',
      eventId: 'ev-1',
      items: [
        { serviceRoleId: 'r1', userId: 'u1' },
        { serviceRoleId: 'r1', userId: 'u2', note: 'vokal 2' },
        { serviceRoleId: 'r2', userId: 'u1' },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.rows).toHaveLength(3);
    expect(out.date).toBe('2026-10-25');
    expect(out.eventId).toBe('ev-1');
  });

  it('dedupe baris sama', () => {
    const out = normalizeProposalItems({
      date: '2026-10-25',
      items: [
        { serviceRoleId: 'r1', userId: 'u1' },
        { serviceRoleId: 'r1', userId: 'u1' },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.rows).toHaveLength(1);
  });

  it('tanggal wajib YYYY-MM-DD', () => {
    const out = normalizeProposalItems({ date: 'besok', items: [{ serviceRoleId: 'r1', userId: 'u1' }] });
    expect(out.ok).toBe(false);
  });

  it('menolak melebihi cap', () => {
    const items = Array.from({ length: MAX_PROPOSAL_ITEMS + 1 }, (_, i) => ({ serviceRoleId: `r${i}`, userId: 'u1' }));
    const out = normalizeProposalItems({ date: '2026-10-25', items });
    expect(out.ok).toBe(false);
    expect(out.errors[0]).toMatch(/Maksimal/);
  });
});

describe('penatalayan-proposals: rowKey', () => {
  it('stabil per role+orang+tanggal', () => {
    expect(proposalRowKey('r1', 'u1', '2026-10-25')).toBe('r1|u1|2026-10-25');
    expect(proposalRowKey('r1', 'u1', '2026-10-25T00:00:00Z')).toBe('r1|u1|2026-10-25');
  });
});
