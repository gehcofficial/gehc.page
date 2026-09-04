import { describe, it, expect } from 'vitest';
import {
  assertUserDeleteAllowed,
  confirmMatchesUser,
  isGoogleLinkedUser,
} from '../../server/lib/user-delete.mjs';

const mentee = {
  id: 'usr-dup',
  name: 'Alvandi Saerang',
  loginUsername: 'alvandi.saerang2',
  email: null,
  googleSub: null,
  linkStatus: 'UNLINKED',
  accountKind: 'INVITED',
};

describe('user-delete guards', () => {
  it('matches username with or without @', () => {
    expect(confirmMatchesUser(mentee, 'alvandi.saerang2')).toBe(true);
    expect(confirmMatchesUser(mentee, '@alvandi.saerang2')).toBe(true);
    expect(confirmMatchesUser(mentee, 'Alvandi Saerang')).toBe(true);
    expect(confirmMatchesUser(mentee, 'salah')).toBe(false);
  });

  it('blocks system and self', () => {
    expect(() =>
      assertUserDeleteAllowed({ actorId: 'usr-a', target: { ...mentee, id: 'usr-platform-ops' }, confirm: 'x' }),
    ).toThrow(/sistem/i);
    expect(() =>
      assertUserDeleteAllowed({ actorId: 'usr-dup', target: mentee, confirm: 'alvandi.saerang2' }),
    ).toThrow(/sedang dipakai/i);
  });

  it('requires HAPUS for Google-linked accounts', () => {
    const linked = {
      ...mentee,
      googleSub: 'sub-1',
      linkStatus: 'LINKED',
      email: 'alvandi@example.com',
    };
    expect(isGoogleLinkedUser(linked)).toBe(true);
    expect(() =>
      assertUserDeleteAllowed({ actorId: 'usr-admin', target: linked, confirm: 'alvandi@example.com' }),
    ).toThrow(/HAPUS/);
    expect(() =>
      assertUserDeleteAllowed({
        actorId: 'usr-admin',
        target: linked,
        confirm: 'alvandi@example.com',
        confirmPhrase: 'HAPUS',
      }),
    ).not.toThrow();
  });

  it('allows deleting unlinked duplicate with username confirm', () => {
    expect(() =>
      assertUserDeleteAllowed({ actorId: 'usr-admin', target: mentee, confirm: 'alvandi.saerang2' }),
    ).not.toThrow();
  });
});
