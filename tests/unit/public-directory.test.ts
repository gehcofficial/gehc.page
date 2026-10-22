import { describe, expect, it } from 'vitest';
import { toPublicGroup, toPublicMember, toPublicStrukturMember } from '../../server/lib/public-directory.mjs';
import {
  canReadGroupPastoral,
  canReadStrukturPii,
  isPastoralStaff,
  redactUserContact,
} from '../../server/lib/pastoral-access.mjs';
import { isActiveAccount } from '../../server/lib/account-status.mjs';
import { resolveRoleTenant } from '../../server/lib/role-tenant.mjs';
import { tenantRegistrationOpen } from '../../server/lib/registration-gate.mjs';

describe('public directory projection', () => {
  it('drops member contact, notes, and account ids', () => {
    const member = toPublicMember({
      id: 'm1',
      groupId: 'g1',
      batchPeriod: '2026-07',
      userId: 'usr-1',
      name: 'Ana',
      email: 'ana@example.com',
      phone: '0812',
      familyRole: 'MENTEE',
      status: 'ALUMNI',
      joinedDate: '2024-01-01',
      alumniDate: '2026-01-01',
      alumniNote: 'pindah kota, nomor WA pribadi',
      attendanceRate: 80,
      notes: 'rahasia pastoral',
      user: { id: 'usr-1', avatar: 'a.png', name: 'Ana', email: 'ana@example.com' },
    });
    expect(member).toEqual({
      id: 'm1',
      groupId: 'g1',
      batchPeriod: '2026-07',
      name: 'Ana',
      familyRole: 'MENTEE',
      status: 'ALUMNI',
      alumniDate: '2026-01-01',
      user: { avatar: 'a.png', name: 'Ana' },
    });
    expect(JSON.stringify(member)).not.toMatch(/email|phone|userId|alumniNote|0812/);
  });

  it('drops mentor account ids from public groups', () => {
    const group = toPublicGroup({
      id: 'g1',
      tenantId: 'tenant-teen',
      name: 'Kasih',
      batches: [{ id: 'b1', mentorName: 'Budi', mentorUserId: 'usr-b', comentorUserId: 'usr-c', mentorAvatar: 'm.png' }],
      members: [{ id: 'm1', groupId: 'g1', name: 'Ana', familyRole: 'MENTEE', status: 'ACTIVE', email: 'a@b.c' }],
    });
    expect(group.batches[0].mentorName).toBe('Budi');
    expect(group.batches[0].mentorAvatar).toBe('m.png');
    expect(group.batches[0].mentorUserId).toBeUndefined();
    expect(group.members[0].email).toBeUndefined();
  });

  it('drops pengurus email, phone, and userId', () => {
    const row = toPublicStrukturMember({
      id: 's1',
      name: 'Ketua',
      position: 'Ketua',
      email: 'ketua@example.com',
      phone: '0811',
      userId: 'usr-1',
      photoUrl: 'p.png',
    });
    expect(row).toEqual({ id: 's1', name: 'Ketua', position: 'Ketua', photoUrl: 'p.png' });
  });
});

const user = (roles: Array<{ role: string; groupId?: string }>, accountStatus = 'ACTIVE') => ({
  id: 'u',
  accountStatus,
  roles,
});

describe('pastoral access', () => {
  it('staff reads every group; mentor only their house', () => {
    const mentor = user([{ role: 'MENTOR', groupId: 'g1' }]);
    expect(canReadGroupPastoral(mentor, 'g1')).toBe(true);
    expect(canReadGroupPastoral(mentor, 'g2')).toBe(false);
    expect(isPastoralStaff(user([{ role: 'KOMISI' }]))).toBe(true);
    expect(canReadGroupPastoral(user([{ role: 'MENTEE', groupId: 'g1' }]), 'g1')).toBe(false);
    expect(canReadGroupPastoral(user([{ role: 'MENTOR', groupId: 'g1' }], 'PENDING'), 'g1')).toBe(false);
  });

  it('struktur PII is staff-only and active accounts only', () => {
    expect(canReadStrukturPii(user([{ role: 'COMMITTEE' }]))).toBe(true);
    expect(canReadStrukturPii(user([{ role: 'MENTOR', groupId: 'g1' }]))).toBe(false);
    expect(canReadStrukturPii(user([{ role: 'KOMISI' }], 'PENDING'))).toBe(false);
  });

  it('redacts email unless the caller is staff', () => {
    const person = { id: 'u', name: 'Ana', email: 'a@b.c', avatar: null };
    expect(redactUserContact(person, false)).toEqual({ id: 'u', name: 'Ana', avatar: null });
    expect(redactUserContact(person, true)?.email).toBe('a@b.c');
  });
});

describe('account status', () => {
  it('treats missing status as active and blocks pending', () => {
    expect(isActiveAccount({ id: 'u' })).toBe(true);
    expect(isActiveAccount({ accountStatus: 'ACTIVE' })).toBe(true);
    expect(isActiveAccount({ accountStatus: 'pending' })).toBe(false);
  });
});

describe('resolveRoleTenant', () => {
  const prisma = {
    group: {
      findUnique: async ({ where }: { where: { id: string } }) => (
        where.id === 'g-teen' ? { tenantId: 'tenant-teen' } : null
      ),
    },
  };

  it('uses the group tenant, jemaat for BPMJ, and the host otherwise', async () => {
    expect(await resolveRoleTenant(prisma, { role: 'MENTEE', groupId: 'g-teen', fallbackTenant: 'tenant-men' })).toBe('tenant-teen');
    expect(await resolveRoleTenant(prisma, { role: 'BPMJ', fallbackTenant: 'tenant-men' })).toBe('tenant-jemaat');
    expect(await resolveRoleTenant(prisma, { role: 'KOMISI', fallbackTenant: 'tenant-women' })).toBe('tenant-women');
  });
});

describe('tenantRegistrationOpen', () => {
  const req = { headers: { host: 'men.gehc.page' } };

  it('requires the host tenant flag, not only the env switch', async () => {
    const prev = process.env.REGISTRATION_OPEN;
    delete process.env.REGISTRATION_OPEN;
    const closed = {
      tenant: { findUnique: async () => ({ registrationOpen: false, isActive: true }) },
    };
    const open = {
      tenant: { findUnique: async () => ({ registrationOpen: true, isActive: true }) },
    };
    expect(await tenantRegistrationOpen(closed, req)).toBe(false);
    expect(await tenantRegistrationOpen(open, req)).toBe(true);
    process.env.REGISTRATION_OPEN = 'false';
    expect(await tenantRegistrationOpen(open, req)).toBe(false);
    if (prev === undefined) delete process.env.REGISTRATION_OPEN;
    else process.env.REGISTRATION_OPEN = prev;
  });
});
