import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ prompts: [] as string[], systems: [] as string[] }));

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

import { generateWeekDraft } from '../../server/lib/didaskalia-ai.mjs';

const base = { yearMonth: '2026-09', weekIndex: 4, date: '2026-09-27' };
const allPrompts = () => captured.prompts.join('\n');

describe('konteks tim (instruksi + knowledge)', () => {
  it('menyisipkan instruksi khusus dan dokumen pengetahuan ke prompt', async () => {
    captured.prompts = []; captured.systems = [];
    await generateWeekDraft({
      ...base,
      instruction: 'Dahulukan eksposisi historis.',
      knowledge: [{ title: 'Panduan Format', category: 'FORMAT', content: 'Komposisi 20/30/50.' }],
    });
    expect(allPrompts()).toContain('INSTRUKSI KHUSUS TIM');
    expect(allPrompts()).toContain('Dahulukan eksposisi historis.');
    expect(allPrompts()).toContain('PENGETAHUAN TIM');
    expect(allPrompts()).toContain('Panduan Format');
    expect(allPrompts()).toContain('Komposisi 20/30/50.');
  });

  it('tanpa knowledge/instruksi → blok tidak muncul', async () => {
    captured.prompts = []; captured.systems = [];
    await generateWeekDraft({ ...base });
    expect(allPrompts()).not.toContain('PENGETAHUAN TIM');
    expect(allPrompts()).not.toContain('INSTRUKSI KHUSUS TIM');
  });

  it('mematuhi batas karakter pengetahuan', async () => {
    captured.prompts = []; captured.systems = [];
    const big = 'A'.repeat(5000);
    await generateWeekDraft({
      ...base,
      maxKnowledgeChars: 1500,
      knowledge: [
        { title: 'Dok1', category: 'FORMAT', content: big },
        { title: 'Dok2', category: 'FORMAT', content: big },
      ],
    });
    // budget berlaku per panggilan; pastikan tidak melebihi batas + margin.
    const aCount = (allPrompts().match(/A/g) || []).length;
    const perCallMax = Math.max(...captured.prompts.map((p) => (p.match(/A/g) || []).length));
    expect(perCallMax).toBeLessThanOrEqual(1600);
    expect(aCount).toBeGreaterThan(500);
  });
});
