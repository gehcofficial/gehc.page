import { describe, expect, it, vi } from 'vitest';
import { deleteEmptySession } from '../../server/routes/worship.mjs';

function stubPrisma({ status = 'DRAFT', responses = 0, votes = 0, notes = 0, items = [] } = {}) {
  const calls = [];
  return {
    calls,
    prisma: {
      worshipLikertResponse: { count: async () => responses, deleteMany: async () => ({}) },
      worshipChipVote: { count: async () => votes, deleteMany: async (a) => (calls.push(['votes-del', a]), {}) },
      worshipNote: {
        count: async () => notes,
        deleteMany: async (a) => (calls.push(['notes-del', a]), {}),
      },
      worshipLikertItem: {
        findMany: async () => items,
        deleteMany: async (a) => (calls.push(['items-del', a]), { count: items.length }),
      },
      worshipChip: { deleteMany: async (a) => (calls.push(['chips-del', a]), {}) },
      worshipSession: { delete: async (a) => (calls.push(['session-del', a]), {}) },
      $transaction: async (ops) => {
        await Promise.all(ops);
        return [];
      },
    },
    session: { id: 'ws-1', slug: 'sesi-x', status },
  };
}

describe('worship: hapus sesi DRAFT kosong', () => {
  it('menolak bila bukan DRAFT', async () => {
    const { prisma, session } = stubPrisma({ status: 'RUNNING' });
    await expect(deleteEmptySession(prisma, session)).rejects.toMatchObject({ status: 409 });
  });

  it('menolak bila ada jawaban/vote/catatan', async () => {
    for (const over of [{ responses: 3 }, { votes: 1 }, { notes: 2 }]) {
      const { prisma, session } = stubPrisma(over);
      await expect(deleteEmptySession(prisma, session)).rejects.toMatchObject({ status: 409 });
    }
  });

  it('menghapus cascade bila DRAFT kosong', async () => {
    const { prisma, calls, session } = stubPrisma({ items: [{ id: 'wli-1' }, { id: 'wli-2' }] });
    const out = await deleteEmptySession(prisma, session);
    expect(out).toEqual({ slug: 'sesi-x' });
    expect(calls.some(([k]) => k === 'session-del')).toBe(true);
    expect(calls.some(([k]) => k === 'items-del')).toBe(true);
    expect(calls.some(([k]) => k === 'chips-del')).toBe(true);
  });

  it('404 bila sesi null', async () => {
    const { prisma } = stubPrisma();
    await expect(deleteEmptySession(prisma, null)).rejects.toMatchObject({ status: 404 });
  });
});
