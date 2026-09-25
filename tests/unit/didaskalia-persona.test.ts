import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ systems: [] as string[], prompts: [] as string[] }));

const PATH_OBJECT = {
  pathIndex: 1, dayLabel: 'Minggu', title: 'T', summary: 's', bacaanRef: 'b',
  scriptureRef: 'r', scriptureText: 't', homileticLens: ['a'], hookQuestion: 'h',
  illustration: 'i', reflection: 'r', observeQ: 'o', interpretQ: 'n', applyQ: 'p',
  fgdQuestions: ['q'], bridge: 'br', imageStem: '',
  rhbSections: [
    { key: 'PENGANTAR', title: 'a', body: 'x' },
    { key: 'PEMBAHASAN_TEMATIS', title: 'b', body: 'y' },
    { key: 'MAKNA_IMPLIKASI', title: 'c', body: 'z' },
  ],
};

vi.mock('../../server/ai-provider.mjs', () => ({
  jethroGenerateText: vi.fn(async ({ system, prompt }: { system: string; prompt: string }) => {
    captured.systems.push(system); captured.prompts.push(prompt);
    return { text: '{}', finishReason: 'stop', modelId: 'mock' };
  }),
  jethroGenerateObject: vi.fn(async ({ system, prompt }: { system: string; prompt: string }) => {
    captured.systems.push(system); captured.prompts.push(prompt);
    return { object: PATH_OBJECT, finishReason: 'stop', modelId: 'mock' };
  }),
  generateImageBase64: vi.fn(async () => ({ base64: '', mediaType: 'image/jpeg', model: 'mock' })),
}));

import { generateWeekDraft, generateSermon, refineField } from '../../server/lib/didaskalia-ai.mjs';

describe('persona AI Didaskalia — kerangka Reformed', () => {
  it('system prompt memuat identitas GMIM, audiens, dan kerangka Reformed', async () => {
    captured.systems = []; captured.prompts = [];
    await generateWeekDraft({ yearMonth: '2026-09', weekIndex: 4, date: '2026-09-27' });
    const s = captured.systems.join('\n');
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
    captured.systems = [];
    await generateSermon({ yearMonth: '2026-09', weekIndex: 4 });
    expect(captured.systems.join('\n')).toContain('Reformed');

    captured.systems = [];
    await refineField({ fieldLabel: 'Ringkasan', current: 'x', instruction: 'y', context: '' });
    expect(captured.systems.join('\n')).toContain('Reformed');
  });
});
