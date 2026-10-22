import { describe, expect, it } from 'vitest';
import {
  assertNoPublicPii,
  collectPiiFindings,
  memberHasContact,
  tenantIdsInGroups,
} from '../../scripts/lib/qa-security-scan.mjs';

describe('qa-security-scan', () => {
  it('flags known PII keys in nested JSON', () => {
    const findings = collectPiiFindings({
      groups: [{ batches: [{ mentorUserId: 'usr-x' }], members: [{ alumniNote: 'secret' }] }],
    });
    expect(findings.some((f) => f.includes('mentorUserId'))).toBe(true);
    expect(findings.some((f) => f.includes('alumniNote'))).toBe(true);
  });

  it('passes sanitized public group shape', () => {
    const { ok, findings } = assertNoPublicPii({
      groups: [{
        id: 'g1',
        tenantId: 'tenant-youth',
        name: 'Agape',
        batches: [{ mentorName: 'Budi', mentorAvatar: 'x.png' }],
        members: [{ id: 'm1', name: 'Ana', user: { name: 'Ana', avatar: 'a.png' } }],
      }],
    });
    expect(ok).toBe(true);
    expect(findings).toEqual([]);
  });

  it('detects member contact for mentor scope checks', () => {
    expect(memberHasContact({ email: 'a@b.c' })).toBe(true);
    expect(memberHasContact({ user: { name: 'X' } })).toBe(false);
  });

  it('collects tenant ids from groups list', () => {
    expect(tenantIdsInGroups([
      { tenantId: 'tenant-teen' },
      { tenantId: 'tenant-jemaat' },
    ])).toEqual(['tenant-teen', 'tenant-jemaat']);
  });
});
