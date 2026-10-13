import { describe, expect, it, vi } from 'vitest';
import { parseRhbMd } from '../../server/lib/didaskalia-md.mjs';
import { bacaanMatchesKitab, defaultStudio, ensurePaths } from '../../src/lib/didaskalia';
import { buildRhbDayDeck, contentFromStudio } from '../../src/lib/didaskalia-presentation';
import { buildDayCaption } from '../../src/lib/rhb-caption';

const captured = vi.hoisted(() => ({ prompts: [] as string[] }));

vi.mock('../../server/ai-provider.mjs', () => ({
  jethroGenerateText: vi.fn(async () => ({ text: '{}', finishReason: 'stop', modelId: 'mock' })),
  jethroGenerateObject: vi.fn(async ({ prompt }: { prompt: string }) => {
    captured.prompts.push(prompt);
    return {
      object: {
        pathIndex: 1, dayLabel: 'Minggu', title: 'T', summary: 's', bacaanRef: 'b',
        scriptureRef: 'r', scriptureText: 't', homileticLens: ['a'], hookQuestion: 'h',
        illustration: 'i', reflection: 'r', observeQ: 'o', interpretQ: 'n', applyQ: 'p',
        fgdQuestions: ['q'], bridge: 'br', imageStem: '',
        rhbSections: [
          { key: 'PENGANTAR', title: 'a', body: 'x' },
          { key: 'PEMBAHASAN_TEMATIS', title: 'b', body: 'y' },
          { key: 'MAKNA_IMPLIKASI', title: 'c', body: 'z' },
        ],
      },
      finishReason: 'stop',
      modelId: 'mock',
    };
  }),
  generateImageBase64: vi.fn(async () => ({ base64: '', mediaType: 'image/jpeg', model: 'mock' })),
}));

import { generateWeekDraft } from '../../server/lib/didaskalia-ai.mjs';

const KITAB = '1 Timotius 3:1-13';

function studioKitabStatis() {
  const studio = defaultStudio();
  studio.kitabFokus = KITAB;
  studio.paths = ensurePaths(studio).map((p, i) => ({
    ...p,
    title: `Path ${i + 1}`,
    bacaanRef: `1 Timotius 3:${i + 1}`,
    scriptureRef: `Nats hari ${i + 1}`,
  }));
  return studio;
}

describe('RHB Kitab Fokus statis + Nats bervariasi', () => {
  it('deck hari 1 & 7 memuat kitab statis yang sama + nats berbeda', () => {
    const content = contentFromStudio(studioKitabStatis(), 1, '2026-09-06', 'Tema');
    const d1 = buildRhbDayDeck(content, 1);
    const d7 = buildRhbDayDeck(content, 7);
    const val = (deck: ReturnType<typeof buildRhbDayDeck>, label: string) =>
      (deck[0].fields || []).find((f) => f.label === label)?.value;
    expect(val(d1, 'Kitab / Bagian Fokus')).toBe(KITAB);
    expect(val(d7, 'Kitab / Bagian Fokus')).toBe(KITAB);
    expect(val(d1, 'Bacaan hari ini')).toBe('1 Timotius 3:1');
    expect(val(d7, 'Bacaan hari ini')).toBe('1 Timotius 3:7');
    expect(val(d1, 'Nats Pembimbing')).toBe('Nats hari 1');
    expect(val(d7, 'Nats Pembimbing')).toBe('Nats hari 7');
  });

  it('caption harian memuat kitab statis + bacaan + nats', () => {
    const content = contentFromStudio(studioKitabStatis(), 1, '2026-09-06', 'Tema');
    const t1 = buildDayCaption({ doc: 'rhb', yearMonth: '2026-09', weekIndex: 1, dayIndex: 1, content, origin: 'https://x.test' });
    const t7 = buildDayCaption({ doc: 'rhb', yearMonth: '2026-09', weekIndex: 1, dayIndex: 7, content, origin: 'https://x.test' });
    for (const t of [t1, t7]) expect(t).toContain(KITAB);
    expect(t1).toContain('Bacaan hari ini: 1 Timotius 3:1');
    expect(t1).toContain('Nats: Nats hari 1');
    expect(t7).toContain('Nats: Nats hari 7');
  });

  it('parseRhbMd membaca Bacaan opsional + Scripture (Nats)', () => {
    const md = `### Path 1: Judul Satu
**Scripture:** 1 Timotius 3:11
**Bacaan:** 1 Timotius 3:1-2

Narasi hari satu.

> Jembatan satu.
`;
    const r = parseRhbMd(md);
    expect(r.paths[0].scriptureRef).toBe('1 Timotius 3:11');
    expect(r.paths[0].bacaanRef).toBe('1 Timotius 3:1-2');
    expect(r.paths[0].summary).toContain('Narasi hari satu');
  });

  it('parseRhbMd tanpa Bacaan: bacaanRef kosong (dipertahankan editor)', () => {
    const md = `### Path 1: Judul Satu
**Scripture:** 1 Timotius 3:11

Narasi.

> Jembatan.
`;
    const r = parseRhbMd(md);
    expect(r.paths[0].bacaanRef).toBe('');
  });

  it('bacaanMatchesKitab: porsi kitab sama lolos, kitab beda ditandai', () => {
    expect(bacaanMatchesKitab('1 Timotius 3:3-4', '1 Timotius 3:1-13')).toBe(true);
    expect(bacaanMatchesKitab('1 Timotius 3:3-4', '1 Timotius 3')).toBe(true);
    expect(bacaanMatchesKitab('Kolose 1:13', '1 Timotius 3:1-13')).toBe(false);
    expect(bacaanMatchesKitab('', KITAB)).toBe(true);
    expect(bacaanMatchesKitab('1 Timotius 3:3', '')).toBe(true);
  });

  it('prompt draft AI: kitab statis + bacaan subset + nats pengaya', async () => {
    captured.prompts = [];
    await generateWeekDraft({ yearMonth: '2026-09', weekIndex: 4, date: '2026-09-27', kitabFokus: KITAB });
    const p = captured.prompts.join('\n');
    expect(p).toContain('STATIS sepekan');
    expect(p).toContain('subset');
    expect(p).toContain('Nats Pembimbing');
  });
});
