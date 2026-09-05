import { describe, expect, it } from 'vitest';
import { canWriteKindSync, isChannelWriterSync } from '../../server/lib/channel-link-access.mjs';

const user = (...roles: string[]) => ({ roles: roles.map((role) => ({ role })) });

describe('channel-link write RBAC', () => {
  it('Admin, BPMJ, Komisi, and BOD Tim Kerja may write', () => {
    expect(isChannelWriterSync(user('SUPERADMIN'))).toBe(true);
    expect(isChannelWriterSync(user('KOMISI'))).toBe(true);
    expect(isChannelWriterSync(user('BPMJ'))).toBe(true);
    expect(isChannelWriterSync(user('COMMITTEE'), true)).toBe(true);
  });

  it('mentor, co-mentor, mentee, and non-BOD committee cannot write', () => {
    expect(isChannelWriterSync(user('MENTOR'))).toBe(false);
    expect(isChannelWriterSync(user('CO_MENTOR'))).toBe(false);
    expect(isChannelWriterSync(user('MENTEE'))).toBe(false);
    expect(isChannelWriterSync(user('COMMITTEE'), false)).toBe(false);
  });

  it('mentor cannot PUT GROUP; BPMJ and BOD can', () => {
    expect(canWriteKindSync(user('MENTOR'), 'GROUP')).toBe(false);
    expect(canWriteKindSync(user('BPMJ'), 'GROUP')).toBe(true);
    expect(canWriteKindSync(user('COMMITTEE'), 'GROUP', true)).toBe(true);
    expect(canWriteKindSync(user('COMMITTEE'), 'DIVISION', false)).toBe(false);
  });

  it('EVENT and KOLOM stay Komisi/Admin even for BOD', () => {
    expect(canWriteKindSync(user('COMMITTEE'), 'EVENT', true)).toBe(false);
    expect(canWriteKindSync(user('BPMJ'), 'EVENT')).toBe(false);
    expect(canWriteKindSync(user('KOMISI'), 'EVENT')).toBe(true);
    expect(canWriteKindSync(user('COMMITTEE'), 'KOLOM', true)).toBe(false);
    expect(canWriteKindSync(user('KOMISI'), 'KOLOM')).toBe(true);
  });
});
