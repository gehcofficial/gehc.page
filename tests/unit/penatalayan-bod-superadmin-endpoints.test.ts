import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  canAccessDivisionInbox,
  canFillBodLink,
  canManageBodLink,
  isPenatalayanSuperadmin,
} from '../../server/lib/penatalayan-bod-access.mjs';
import { buildPortalNavItems } from '../../src/lib/portal-nav-config';

const mockLink = { id: 'pbl-1', token: 'tok', eventId: 'evt-1' };

describe('SUPERADMIN tautan penatalayan (akses penuh)', () => {
  const superRole = { id: 'u-sa', email: 'admin@example.com', roles: [{ role: 'SUPERADMIN' }] };
  const superEmailOnly = { id: 'u-tech', email: 'tech@gehc.demo', roles: [{ role: 'MENTOR' }] };

  beforeEach(() => {
    vi.stubEnv('SUPERADMIN_EMAILS', 'tech@gehc.demo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isPenatalayanSuperadmin: peran atau email terpercaya', () => {
    expect(isPenatalayanSuperadmin(superRole)).toBe(true);
    expect(isPenatalayanSuperadmin(superEmailOnly)).toBe(true);
    expect(isPenatalayanSuperadmin({ roles: [{ role: 'MENTOR' }], email: 'x@y.com' })).toBe(false);
  });

  it('POST /api/penatalayan/bod-links — canManageBodLink', async () => {
    await expect(canManageBodLink(superRole)).resolves.toBe(true);
    await expect(canManageBodLink(superEmailOnly)).resolves.toBe(true);
  });

  it('GET token board — canFillBodLink', async () => {
    await expect(canFillBodLink(superRole, null, mockLink)).resolves.toBe(true);
    await expect(canFillBodLink(superEmailOnly, null, mockLink)).resolves.toBe(true);
  });

  it('POST assign & request-division — canFillBodLink', async () => {
    await expect(canFillBodLink(superRole, {}, mockLink)).resolves.toBe(true);
  });

  it('GET caption — canManageBodLink', async () => {
    await expect(canManageBodLink(superEmailOnly)).resolves.toBe(true);
  });

  it('GET division-inbox — canAccessDivisionInbox tanpa LEAD divisi', async () => {
    await expect(canAccessDivisionInbox(superRole, null, 'LITURGIA')).resolves.toBe(true);
    await expect(canAccessDivisionInbox(superEmailOnly, { eventDivisionMember: { findMany: vi.fn() } }, 'DIAKONIA')).resolves.toBe(true);
  });

  it('nav portal: SUPERADMIN melihat tab penatalayan-tautan', () => {
    const items = buildPortalNavItems('SUPERADMIN', { isBodTimkerja: false, isGroupMentor: false, isMentee: false }, false, 'youth');
    expect(items.some((i) => i.id === 'penatalayan-tautan')).toBe(true);
  });
});
