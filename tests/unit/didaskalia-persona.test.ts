import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ system: '', prompt: '' }));

vi.mock('../../server/ai-provider.mjs', () => ({
  jethroGenerateText: vi.fn(async ({ system, prompt }: { system: string; prompt: string }) => {
    captured.system = system;
    captured.prompt = prompt;
    return '{}';
  }),
  generateImageBase64: vi.fn(async () => ({ base64: '', mediaType: 'image/jpeg', model: 'mock' })),
}));

import { generateWeekDraft, generateSermon, refineField } from '../../server/lib/didaskalia-ai.mjs';

describe('persona AI Didaskalia — kerangka Reformed', () => {
  it('system prompt memuat identitas GMIM, audiens, dan kerangka Reformed', async () => {
    await generateWeekDraft({ yearMonth: '2026-09', weekIndex: 4, date: '2026-09-27' });
    const s = captured.system;
    expect(s).toContain('GMIM');
    expect(s).toContain('mahasiswa dan pekerja');
    expect(s).toContain('Protestan Kalvinis (Reformed)');
    expect(s).toContain('Sola Scriptura');
    expect(s).toContain('Sola Gratia');
    expect(s).toContain('Sola Fide');
    expect(s).toContain('Solus Christus');
    expect(s).toContain('Soli Deo Gloria');
    expect(s).toContain('kedaulatan Allah');
    expect(s).toContain('teologi perjanjian');
  });

  it('persona Reformed dipakai juga oleh generator lain', async () => {
    captured.system = '';
    await generateSermon({ yearMonth: '2026-09', weekIndex: 4 });
    expect(captured.system).toContain('Reformed');

    captured.system = '';
    await refineField({ fieldLabel: 'Ringkasan', current: 'x', instruction: 'y', context: '' });
    expect(captured.system).toContain('Reformed');
  });
});
