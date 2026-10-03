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

import { generateWeekDraft, generateSermon } from '../../server/lib/didaskalia-ai.mjs';
import { patternBlock } from '../../server/lib/didaskalia-ai.mjs';

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

  it('pola RHB Beyonders selalu ikut di aturan generate', async () => {
    captured.prompts = []; captured.systems = [];
    await generateWeekDraft({ ...base });
    expect(allPrompts()).toContain('REFLEKSI_PRIBADI');
    expect(allPrompts()).toContain('🎒 Pelajar');
    expect(allPrompts()).toContain('🎓 Mahasiswa');
    expect(allPrompts()).toContain('💼 Pekerja');
    expect(allPrompts()).toContain('DISKUSI_KELOMPOK');
    expect(allPrompts()).toContain('observasi → interpretasi → aplikasi');
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

describe('pola ibadah minggu ini', () => {
  it('patternBlock default MONOLOG (FGD)', () => {
    const lines = patternBlock(undefined).join('\n');
    expect(lines).toContain('POLA IBADAH MINGGU INI');
    expect(lines).toContain('MONOLOG');
    expect(lines).toContain('FGD');
  });

  it('patternBlock POST_TO_POST memakai rute kunjungan', () => {
    const lines = patternBlock({ code: 'POST_TO_POST', name: 'Post-to-Post', summary: 'Pos', playbook: 'Skenario' }).join('\n');
    expect(lines).toContain('RUTE KUNJUNGAN');
    expect(lines).toContain('BUKAN FGD');
    expect(lines).toContain('Skenario');
  });

  it('generateWeekDraft menyertakan blok pola', async () => {
    captured.prompts = []; captured.systems = [];
    await generateWeekDraft({
      ...base,
      pattern: { code: 'POST_TO_POST', name: 'Post-to-Post', summary: 'Pos', playbook: 'Skenario' },
    });
    expect(allPrompts()).toContain('POLA IBADAH MINGGU INI');
    expect(allPrompts()).toContain('Post-to-Post');
  });

  it('generateSermon menyertakan blok pola', async () => {
    captured.prompts = []; captured.systems = [];
    await generateSermon({
      ...base,
      pattern: { code: 'DEBAT', name: 'Debat', summary: '', playbook: '' },
    });
    expect(allPrompts()).toContain('POLA IBADAH MINGGU INI');
    expect(allPrompts()).toContain('ronde debat');
  });

  it('metode default terkunci (Praktika + Tematika + Biblika) bila tak dipilih', async () => {
    const draft = await generateWeekDraft({ ...base });
    expect(draft.homileticMethods).toEqual([
      'Teologi Praktika / Pastoral',
      'Pengajaran Tematika',
      'Teologi Biblika',
    ]);
  });

  it('metode pilihan manual dipertahankan', async () => {
    const draft = await generateWeekDraft({ ...base, methods: ['Apologetika'] });
    expect(draft.homileticMethods).toEqual(['Apologetika']);
  });
});
