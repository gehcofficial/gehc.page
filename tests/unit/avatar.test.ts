import { describe, it, expect } from 'vitest';
import { displayAvatar, initialsAvatar } from '../../src/lib/avatar';
import { googleAvatarCreate, googleAvatarPatch } from '../../server/lib/user-avatar.mjs';

describe('displayAvatar', () => {
  it('uses provided url', () => {
    expect(displayAvatar('Ada', 'https://lh3.googleusercontent.com/a')).toBe(
      'https://lh3.googleusercontent.com/a',
    );
  });

  it('falls back to initials', () => {
    expect(displayAvatar('Ada Lovelace', '')).toBe(initialsAvatar('Ada Lovelace'));
  });
});

describe('googleAvatarPatch', () => {
  it('writes google picture for default users', () => {
    expect(googleAvatarPatch({ avatarSource: 'GOOGLE' }, 'https://pic')).toEqual({
      avatarGoogle: 'https://pic',
      avatar: 'https://pic',
      avatarSource: 'GOOGLE',
    });
  });

  it('does not clobber custom avatar', () => {
    expect(googleAvatarPatch({ avatarSource: 'CUSTOM', avatar: '/visuals/users/x.jpg' }, 'https://pic')).toEqual({
      avatarGoogle: 'https://pic',
    });
  });

  it('create stores google as source', () => {
    expect(googleAvatarCreate('https://pic')).toEqual({
      avatar: 'https://pic',
      avatarGoogle: 'https://pic',
      avatarSource: 'GOOGLE',
    });
  });
});
