import { describe, expect, it, vi } from 'vitest';
import { approverUserIds, notifyApprovalItem } from '../../server/lib/approval-notify.mjs';
import { diffDrift } from '../../server/lib/drive-audit.mjs';

function stubPrisma({ roles = [{ userId: 'u-komisi' }], open = [] }: { roles?: Array<{ userId: string }>; open?: Array<{ payload?: unknown }> } = {}) {
  return {
    userRole: { findMany: async () => roles },
    notification: {
      findMany: async () => open,
      createMany: vi.fn(async () => ({ count: roles.length })),
    },
  };
}

describe('notifyApprovalItem', () => {
  it('membuat notif per Komisi/Superadmin', async () => {
    const prisma = stubPrisma({ roles: [{ userId: 'u1' }, { userId: 'u2' }] });
    const n = await notifyApprovalItem(prisma, {
      queue: 'soal-event',
      itemId: 'eqr-1',
      title: 'Usulan soal: X',
      message: 'Tinjau.',
      url: '#/portal/komisi/events',
    });
    expect(n).toBe(2);
    expect(prisma.notification.createMany).toHaveBeenCalledOnce();
  });

  it('dedupe: item sama yang masih OPEN tidak dobel', async () => {
    const prisma = stubPrisma({
      open: [{ payload: { queue: 'soal-event', itemId: 'eqr-1' } }],
    });
    const n = await notifyApprovalItem(prisma, {
      queue: 'soal-event',
      itemId: 'eqr-1',
      title: 'x',
      message: 'y',
      url: null,
    });
    expect(n).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('tanpa penerima → 0 dan tanpa tulis', async () => {
    const prisma = stubPrisma({ roles: [] });
    expect(await notifyApprovalItem(prisma, { queue: 'q', itemId: 'i', title: 't', message: 'm', url: null })).toBe(0);
  });

  it('approverUserIds unik', async () => {
    const prisma = stubPrisma({ roles: [{ userId: 'u1' }, { userId: 'u1' }, { userId: 'u2' }] });
    expect(await approverUserIds(prisma)).toEqual(['u1', 'u2']);
  });
});

describe('diffDrift', () => {
  const curr = {
    missing: ['grup:Agape'],
    extra: ['[GROUP:X]'],
    untagged: ['Folder Tanpa Tag'],
    publicNew: [{ id: 'f1', name: 'foto.jpg', folderName: 'Website Visual [PUBLIK]' }],
    publicFiles: [{ folderId: 'd1', files: [{ id: 'f1', name: 'foto.jpg' }] }],
    tokenOk: true,
  };

  it('tanpa snapshot → semua item baru', () => {
    expect(diffDrift(null, curr)).toHaveLength(4);
  });

  it('item lama tidak diulang; token flip terdeteksi', () => {
    const prev = {
      missing: ['grup:Agape'],
      extra: [],
      untagged: [],
      publicFiles: [],
      tokenOk: true,
    };
    const items = diffDrift(prev, { ...curr, tokenOk: false });
    expect(items.map((i) => i.kind).sort()).toEqual(['extra', 'public-file', 'token', 'untagged']);
  });

  it('sunyi bila tak ada perubahan', () => {
    const prev = {
      missing: ['grup:Agape'],
      extra: ['[GROUP:X]'],
      untagged: ['Folder Tanpa Tag'],
      publicFiles: [{ folderId: 'd1', files: [{ id: 'f1', name: 'foto.jpg' }] }],
      tokenOk: true,
    };
    expect(diffDrift(prev, curr)).toHaveLength(0);
  });
});
