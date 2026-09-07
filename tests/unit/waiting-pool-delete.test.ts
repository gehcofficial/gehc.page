import { describe, expect, it } from 'vitest';
import {
  assertPoolRegistrationDeleteAllowed,
  confirmMatchesPoolEntry,
} from '../../server/lib/waiting-pool-delete.mjs';

const dummy = {
  id: 'wp-dummy',
  userId: null,
  name: 'AIS',
  email: null,
  phone: '08212121211',
  status: 'REGISTERED',
};

describe('quick-register delete guards', () => {
  it('matches name or WhatsApp (0 / 62)', () => {
    expect(confirmMatchesPoolEntry(dummy, 'AIS')).toBe(true);
    expect(confirmMatchesPoolEntry(dummy, 'ais')).toBe(true);
    expect(confirmMatchesPoolEntry(dummy, '08212121211')).toBe(true);
    expect(confirmMatchesPoolEntry(dummy, '628212121211')).toBe(true);
    expect(confirmMatchesPoolEntry(dummy, 'salah')).toBe(false);
    expect(confirmMatchesPoolEntry(dummy, '')).toBe(false);
  });

  it('allows deleting guest counter rows', () => {
    expect(() => assertPoolRegistrationDeleteAllowed({ entry: dummy, confirm: 'AIS' })).not.toThrow();
    expect(() => assertPoolRegistrationDeleteAllowed({ entry: dummy, confirm: '08212121211' })).not.toThrow();
  });

  it('blocks waiting-pool / role rows and linked accounts', () => {
    expect(() =>
      assertPoolRegistrationDeleteAllowed({
        entry: { ...dummy, status: 'WAITING_POOL' },
        confirm: 'AIS',
      }),
    ).toThrow(/Quick Register/i);
    expect(() =>
      assertPoolRegistrationDeleteAllowed({
        entry: { ...dummy, userId: 'usr-1' },
        confirm: 'AIS',
      }),
    ).toThrow(/tertaut akun/i);
    expect(() => assertPoolRegistrationDeleteAllowed({ entry: null, confirm: 'AIS' })).toThrow(/tidak ditemukan/i);
  });
});
