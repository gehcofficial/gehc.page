import { describe, expect, it, vi } from 'vitest';
import {
  EVENT_PROGRAM_PUBLIC_SELECT,
  findEventProgramPublic,
} from '../../server/lib/event-program-public.mjs';

describe('findEventProgramPublic', () => {
  it('tidak meminta kolom arsip Drive', () => {
    expect(EVENT_PROGRAM_PUBLIC_SELECT.archiveFolderId).toBeUndefined();
    expect(EVENT_PROGRAM_PUBLIC_SELECT.previewFileIds).toBeUndefined();
    expect(EVENT_PROGRAM_PUBLIC_SELECT.eventDate).toBe(true);
    expect(EVENT_PROGRAM_PUBLIC_SELECT.whatsappGroupUrl).toBe(true);
  });

  it('mengembalikan null jika Prisma gagal karena kolom belum ada', async () => {
    const prisma = {
      eventProgram: {
        findUnique: vi.fn().mockRejectedValue(
          new Error('The column gehc.eventprogram.archive_folder_id does not exist'),
        ),
      },
    };
    await expect(findEventProgramPublic(prisma, { id: 'evt-baku-tau-4-0' })).resolves.toBeNull();
  });
});
