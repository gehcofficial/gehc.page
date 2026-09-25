import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ prompt: '' }));

vi.mock('../../server/ai-provider.mjs', () => ({
  jethroGenerateText: vi.fn(async ({ prompt }: { prompt: string }) => { captured.prompt = prompt; return { text: '{}', finishReason: 'stop', modelId: 'mock' }; }),
  generateImageBase64: vi.fn(async () => ({ base64: '', mediaType: 'image/jpeg', model: 'mock' })),
}));

import { generateWeekDraft } from '../../server/lib/didaskalia-ai.mjs';

const base = { yearMonth: '2026-09', weekIndex: 4, date: '2026-09-27' };

describe('konteks tim (instruksi + knowledge)', () => {
  it('menyisipkan instruksi khusus dan dokumen pengetahuan ke prompt', async () => {
    await generateWeekDraft({
      ...base,
      instruction: 'Dahulukan eksposisi historis.',
      knowledge: [{ title: 'Panduan Format', category: 'FORMAT', content: 'Komposisi 20/30/50.' }],
    });
    expect(captured.prompt).toContain('INSTRUKSI KHUSUS TIM');
    expect(captured.prompt).toContain('Dahulukan eksposisi historis.');
    expect(captured.prompt).toContain('PENGETAHUAN TIM');
    expect(captured.prompt).toContain('Panduan Format');
    expect(captured.prompt).toContain('Komposisi 20/30/50.');
  });

  it('tanpa knowledge/instruksi → blok tidak muncul', async () => {
    await generateWeekDraft({ ...base });
    expect(captured.prompt).not.toContain('PENGETAHUAN TIM');
    expect(captured.prompt).not.toContain('INSTRUKSI KHUSUS TIM');
  });

  it('mematuhi batas karakter pengetahuan', async () => {
    const big = 'A'.repeat(5000);
    await generateWeekDraft({
      ...base,
      maxKnowledgeChars: 1500,
      knowledge: [
        { title: 'Dok1', category: 'FORMAT', content: big },
        { title: 'Dok2', category: 'FORMAT', content: big },
      ],
    });
    const aCount = (captured.prompt.match(/A/g) || []).length;
    expect(aCount).toBeLessThanOrEqual(1600);
    expect(aCount).toBeGreaterThan(500);
  });
});
