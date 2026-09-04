import { describe, it, expect } from 'vitest';
import { displayAvatar, initialsAvatar } from '../../src/lib/avatar';
import {
  googleAvatarCreate,
  googleAvatarPatch,
  servedAvatarUrl,
  inlineAvatarDataUrl,
  pickStoredAvatarUrl,
  MAX_INLINE_AVATAR_BYTES,
} from '../../server/lib/user-avatar.mjs';

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

describe('pickStoredAvatarUrl', () => {
  const jpeg = Buffer.from('fake-jpeg');

  it('prefers served blob URL', () => {
    expect(
      pickStoredAvatarUrl({
        blobOk: true,
        userId: 'usr-abc',
        version: 99,
        driveUrl: 'https://drive.example/x',
        jpegBuffer: jpeg,
      }),
    ).toBe('/api/media/user-avatar/usr-abc?v=99');
  });

  it('uses Drive URL when blob table is missing', () => {
    expect(
      pickStoredAvatarUrl({
        blobOk: false,
        userId: 'usr-abc',
        version: 1,
        driveUrl: 'https://lh3.googleusercontent.com/x',
        jpegBuffer: jpeg,
      }),
    ).toBe('https://lh3.googleusercontent.com/x');
  });

  it('falls back to data URL so upload works without Drive token', () => {
    const url = pickStoredAvatarUrl({
      blobOk: false,
      userId: 'usr-abc',
      version: 1,
      driveUrl: '',
      jpegBuffer: jpeg,
    });
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('returns empty when inline JPEG would overflow TEXT', () => {
    const huge = Buffer.alloc(MAX_INLINE_AVATAR_BYTES + 1, 1);
    expect(
      pickStoredAvatarUrl({
        blobOk: false,
        userId: 'usr-abc',
        version: 1,
        driveUrl: '',
        jpegBuffer: huge,
      }),
    ).toBe('');
  });
});

describe('servedAvatarUrl', () => {
  it('encodes user id', () => {
    expect(servedAvatarUrl('usr-1', 7)).toBe('/api/media/user-avatar/usr-1?v=7');
  });

  it('builds data URL under the TEXT cap', () => {
    expect(inlineAvatarDataUrl(Buffer.from('abc'))).toBe(
      `data:image/jpeg;base64,${Buffer.from('abc').toString('base64')}`,
    );
  });
});
