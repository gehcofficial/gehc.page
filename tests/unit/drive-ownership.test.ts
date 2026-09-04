import { describe, it, expect } from 'vitest';
import {
  GROUP_SUBFOLDERS,
  findRegisteredSlot,
  resolveSlotWrite,
  houseStem,
} from '../../server/lib/drive-ownership.mjs';
import { decodeImageUpload } from '../../server/lib/drive-jpeg.mjs';

describe('GROUP_SUBFOLDERS', () => {
  it('includes Cover plus Foto Kegiatan', () => {
    expect(GROUP_SUBFOLDERS).toContain('Cover');
    expect(GROUP_SUBFOLDERS).toContain('Foto Kegiatan');
    expect(GROUP_SUBFOLDERS).toContain('Absensi');
  });
});

describe('findRegisteredSlot', () => {
  it('accepts house covers and panca stems', () => {
    expect(findRegisteredSlot('kelompok', 'cover-echad')?.stem).toBe('cover-echad');
    expect(findRegisteredSlot('panca', 'cover-liturgia')?.key).toBe('panca.liturgia');
  });

  it('rejects unknown stems', () => {
    expect(findRegisteredSlot('landing', 'not-a-slot')).toBeNull();
    expect(findRegisteredSlot('ops', 'random')).toBeNull();
  });
});

describe('resolveSlotWrite kelompok cover', () => {
  const groupId = 'grp-echad';
  const mentor = {
    id: 'u-mentor',
    email: 'mentor@gehc.demo',
    roles: [{ role: 'MENTOR', groupId }],
  };
  const comentor = {
    id: 'u-co',
    email: 'co@gehc.demo',
    roles: [{ role: 'CO_MENTOR', groupId }],
  };
  const mentee = {
    id: 'u-mentee',
    email: 'mentee@gehc.demo',
    roles: [{ role: 'MENTEE', groupId }],
  };

  it('allows mentor and co-mentor of that house', async () => {
    expect((await resolveSlotWrite(mentor, 'kelompok', houseStem('Echad'), { groupId })).allowed).toBe(true);
    expect((await resolveSlotWrite(comentor, 'kelompok', 'cover-echad', { groupId })).allowed).toBe(true);
  });

  it('denies mentee cover writes', async () => {
    const v = await resolveSlotWrite(mentee, 'kelompok', 'cover-echad', { groupId });
    expect(v.allowed).toBe(false);
  });
});

describe('decodeImageUpload', () => {
  it('reads a data URL', () => {
    const { buffer } = decodeImageUpload({
      mimetype: 'image/jpeg',
      data: 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64'),
      filename: 'x.jpg',
    });
    expect(buffer.length).toBe(4);
  });

  it('rejects empty payloads', () => {
    expect(() => decodeImageUpload({ mimetype: 'image/jpeg', data: '' })).toThrow();
  });
});
