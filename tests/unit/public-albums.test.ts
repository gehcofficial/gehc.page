import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ALBUM_STATUS,
  filterPublicAlbums,
  isAlbumPublic,
  serializePublicAlbum,
  sortPublicAlbums,
} from '../../server/lib/public-albums.mjs';

describe('album publik: aturan privasi', () => {
  it('default privat walau status SELESAI', () => {
    expect(isAlbumPublic({ status: 'SELESAI', showOnLanding: false })).toBe(false);
    expect(isAlbumPublic({ status: 'SELESAI' })).toBe(false);
    expect(isAlbumPublic({ status: 'SELESAI', showOnLanding: null })).toBe(false);
  });

  it('hanya SELESAI + ditandai', () => {
    expect(isAlbumPublic({ status: 'SELESAI', showOnLanding: true })).toBe(true);
    expect(isAlbumPublic({ status: 'RENCANA', showOnLanding: true })).toBe(false);
    expect(isAlbumPublic({ status: 'BATAL', showOnLanding: true })).toBe(false);
    expect(PUBLIC_ALBUM_STATUS).toBe('SELESAI');
  });

  it('filter mempertahankan hanya album publik', () => {
    const rows = [
      { id: 'a', status: 'SELESAI', showOnLanding: true },
      { id: 'b', status: 'SELESAI', showOnLanding: false },
      { id: 'c', status: 'RENCANA', showOnLanding: true },
      { id: 'd', status: 'SELESAI', showOnLanding: true },
    ];
    expect(filterPublicAlbums(rows).map((r) => r.id)).toEqual(['a', 'd']);
  });
});

describe('album publik: penyajian', () => {
  it('urut terbaru dulu', () => {
    const rows = [
      { id: 'a', occurredOn: '2026-07-01' },
      { id: 'b', occurredOn: '2026-09-08' },
      { id: 'c', occurredOn: null },
    ];
    expect(sortPublicAlbums(rows).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('serialize hanya memuat field publik (tanpa folder Drive)', () => {
    const out = serializePublicAlbum(
      {
        id: 'al-1',
        groupId: 'grp-10',
        title: 'Bonding',
        kind: 'ADHOC',
        occurredOn: '2026-09-08',
        location: 'Cikarang',
        publishedAt: '2026-09-18T00:00:00.000Z',
        driveFolderId: 'rahasia-drive-id',
        coverDriveFileId: 'rahasia-cover-id',
        createdById: 'usr-1',
      },
      { groupName: 'Echad', coverUrl: 'https://x/cover.jpg', previews: [{ id: 'f1', thumbnailUrl: 'u' }] },
    );
    expect(out).toMatchObject({ groupName: 'Echad', title: 'Bonding', coverUrl: 'https://x/cover.jpg' });
    expect(out).not.toHaveProperty('driveFolderId');
    expect(out).not.toHaveProperty('coverDriveFileId');
    expect(out).not.toHaveProperty('createdById');
    expect(JSON.stringify(out)).not.toContain('rahasia');
  });
});
