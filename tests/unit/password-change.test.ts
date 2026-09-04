import { describe, expect, it } from 'vitest';
import { hashPassword, assertCurrentPassword } from '../../server/auth.mjs';

describe('assertCurrentPassword', () => {
  const passwordHash = hashPassword('GehC-temp99!');

  it('allows Google-only accounts with no hash', () => {
    expect(() => assertCurrentPassword({ passwordHash: null, currentPassword: '' })).not.toThrow();
  });

  it('rejects empty current password when a hash exists', () => {
    expect(() =>
      assertCurrentPassword({ passwordHash, currentPassword: '', mustChange: true }),
    ).toThrow(/Password sementara wajib/);
    expect(() =>
      assertCurrentPassword({ passwordHash, currentPassword: undefined, mustChange: true }),
    ).toThrow(/Password sementara wajib/);
  });

  it('rejects the wrong temporary password', () => {
    expect(() =>
      assertCurrentPassword({ passwordHash, currentPassword: 'wrong-pass', mustChange: true }),
    ).toThrow(/Password sementara wajib/);
  });

  it('accepts the matching current password', () => {
    expect(() =>
      assertCurrentPassword({ passwordHash, currentPassword: 'GehC-temp99!', mustChange: true }),
    ).not.toThrow();
  });

  it('uses the non-must-change error when mustChange is false', () => {
    expect(() =>
      assertCurrentPassword({ passwordHash, currentPassword: '', mustChange: false }),
    ).toThrow(/Password lama salah/);
  });
});
