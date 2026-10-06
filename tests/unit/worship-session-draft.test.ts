import { describe, expect, it, vi } from 'vitest';
import {
  countFilled,
  draftToStored,
  emptySessionDraft,
  sessionDraftGuard,
  storedToSections,
  templateFieldKeys,
} from '../../src/lib/worship-session-draft';
import { normalizeConfig } from '../../server/routes/worship.mjs';

const CODES = ['MONOLOG', 'POST_TO_POST', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES'];

describe('session-draft: template kosongan 5 pola', () => {
  it.each(CODES)('%s punya section + kunci field unik', (code) => {
    const sections = emptySessionDraft(code);
    expect(sections.length).toBeGreaterThan(0);
    const keys = sections.flatMap((s) => s.fields.map((f) => f.key));
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(sections.every((s) => s.fields.length > 0)).toBe(true);
  });

  it('POST_TO_POST: 9 slot Likert + 12 chip + timer', () => {
    const keys = templateFieldKeys('POST_TO_POST').map((f) => f.key);
    expect(keys.filter((k) => k.startsWith('item-'))).toHaveLength(9);
    expect(keys.filter((k) => k.startsWith('note-'))).toHaveLength(9);
    expect(keys.filter((k) => k.startsWith('chip-'))).toHaveLength(12);
    expect(keys).toContain('timerSeconds');
  });

  it('DEBAT: 5 slot mosi + trap reveal', () => {
    const keys = templateFieldKeys('DEBAT').map((f) => f.key);
    expect(keys.filter((k) => k.startsWith('mosi-'))).toHaveLength(5);
    expect(keys).toContain('trap-reveal');
  });

  it('round-trip simpan/muat mempertahankan nilai', () => {
    const sections = emptySessionDraft('MONOLOG');
    sections[0].fields[0].value = 'Apa kata teks?';
    const stored = draftToStored(sections);
    const back = storedToSections('MONOLOG', stored);
    expect(back[0].fields[0].value).toBe('Apa kata teks?');
    expect(countFilled(back)).toEqual({ filled: 1, total: 8 });
  });

  it('MONOLOG gabungan: FGD 3 + lagu 3 + deep 2; DUAL memetakan ke MONOLOG', () => {
    const keys = templateFieldKeys('MONOLOG').map((f) => f.key);
    for (const k of ['fgd-observe', 'fgd-interpret', 'fgd-apply', 'song-title', 'song-about', 'song-singer', 'deep-q1', 'deep-q2']) {
      expect(keys).toContain(k);
    }
    expect(templateFieldKeys('DUAL_MONOLOG').map((f) => f.key)).toEqual(keys);
  });

  it('kosongan penuh → filled 0', () => {
    const c = countFilled(emptySessionDraft('POST_TO_POST'));
    expect(c.filled).toBe(0);
    expect(c.total).toBeGreaterThan(30);
  });
});

describe('session-draft: guard sesi terisi', () => {
  it('DRAFT kosong → boleh diisi', () => {
    expect(sessionDraftGuard({ status: 'DRAFT', submittedCount: 0, hasItems: false }).locked).toBe(false);
  });

  it('status jalan → terkunci', () => {
    for (const s of ['LIKERT_OPEN', 'RUNNING', 'WRAPUP', 'CLOSED']) {
      const g = sessionDraftGuard({ status: s, submittedCount: 0, hasItems: false });
      expect(g.locked).toBe(true);
      expect(g.reason).toContain(s);
    }
  });

  it('ada jawaban peserta → terkunci', () => {
    const g = sessionDraftGuard({ status: 'DRAFT', submittedCount: 5, hasItems: false });
    expect(g.locked).toBe(true);
    expect(g.reason).toContain('jawaban peserta');
  });

  it('sudah berisi soal (kasus 4 Okt) → terkunci', () => {
    const g = sessionDraftGuard({ status: 'DRAFT', submittedCount: 0, hasItems: true });
    expect(g.locked).toBe(true);
    expect(g.reason).toContain('kontrol hari-H');
  });
});

describe('session-draft: config draft lolos normalisasi', () => {
  it('draft object dipertahankan', () => {
    const d = normalizeConfig({ draft: { fgd: { 'fgd-observe': 'Apa?' } } });
    expect(d.draft).toEqual({ fgd: { 'fgd-observe': 'Apa?' } });
  });

  it('draft non-object dibuang', () => {
    expect(normalizeConfig({ draft: 'x' }).draft).toBeNull();
    expect(normalizeConfig(null).draft).toBeNull();
  });
});

const capturedPrompts = vi.hoisted(() => ({ list: [] as string[] }));

vi.mock('../../server/ai-provider.mjs', () => ({
  jethroGenerateText: vi.fn(async () => ({ text: '{}', finishReason: 'stop', modelId: 'mock' })),
  jethroGenerateObject: vi.fn(async ({ prompt, schema }: { prompt: string; schema?: { safeParse?: (v: unknown) => { success: boolean } } }) => {
    capturedPrompts.list.push(String(prompt || ''));
    void schema;
    return {
      object: {
        exegesis: { points: ['Kristus mati karena dosa kita'], implications: ['Identitas bukan performa'] },
        topics: [{ code: 'HUBUNGAN', label: 'Hubungan', pic: 'PIC A' }],
        items: [{ topicCode: 'HUBUNGAN', text: 'Saya merasa ...', gospelNote: 'Kristus ...' }],
        chips: [{ code: 'KASIH', label: '#Kasih', topicCode: 'HUBUNGAN' }],
        affirmations: [{ topicCode: 'HUBUNGAN', lines: ['Kamu dikasihi.'] }],
        timerSeconds: 1200,
        values: [{ key: 'mosi-1', value: 'X vs Y' }, { key: 'asing', value: 'buang' }],
      },
      finishReason: 'stop',
      modelId: 'mock',
    };
  }),
  generateImageBase64: vi.fn(async () => ({ base64: '', mediaType: 'image/jpeg', model: 'mock' })),
}));

import { generateSessionDraft } from '../../server/lib/didaskalia-ai.mjs';

describe('session-draft: AI proposal', () => {
  it('POST_TO_POST terstruktur + clamp', async () => {
    const out = await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'More Than Good News',
      fundamentalFirman: { ref: '1Kor 15:3-4', text: '...' },
      pattern: { code: 'POST_TO_POST', name: 'Post-to-Post', phases: [], playbook: 'x' },
    });
    expect(out.kind).toBe('POST_TO_POST');
    expect(out.topics[0]).toMatchObject({ code: 'HUBUNGAN', label: 'Hubungan' });
    expect(out.items[0].topicCode).toBe('HUBUNGAN');
    expect(out.timerSeconds).toBe(1200);
  });

  it('pola lain hanya mengembalikan kunci dikenal', async () => {
    const out = await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'T',
      pattern: { code: 'DEBAT', name: 'Debat', phases: [], playbook: 'x' },
      fieldKeys: [{ key: 'mosi-1', label: 'Mosi 1' }],
    });
    expect(out.kind).toBe('GENERIC');
    expect(out.values).toEqual([{ key: 'mosi-1', value: 'X vs Y' }]);
  });

  it('prompt membedakan peran dua perikop', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'More Than Good News',
      fundamentalFirman: { ref: '1 Korintus 15:3-4', text: 'Kristus telah mati...' },
      kitabFokus: '1 Korintus 15',
      pattern: { code: 'POST_TO_POST', name: 'Post-to-Post', phases: [], playbook: 'x' },
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('PERAN DUA PERIKOP');
    expect(prompt).toContain('JANGKAR TEMA');
    expect(prompt).toContain('BAHAN BACAAN & PENDALAMAN');
    expect(prompt).toContain('1 Korintus 15:3-4');
  });

  it('prompt eksegesis-pertama + anti-contoh + kontekstual', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'More Than Good News',
      fundamentalFirman: { ref: '1 Korintus 15:3-4', text: 'Kristus telah mati...' },
      kitabFokus: '1 Korintus 15',
      pattern: { code: 'DEBAT', name: 'Debat', phases: [], playbook: 'x' },
      fieldKeys: [{ key: 'mosi-1', label: 'Mosi 1' }],
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('LANGKAH 1');
    expect(prompt).toContain('EKSEGESIS');
    expect(prompt).toContain('ANTI-CONTOH');
    expect(prompt).toContain('KONTEKSTUAL');
  });

  it('eksegesis lolos ke output', async () => {
    const out = await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'More Than Good News',
      fundamentalFirman: { ref: '1 Korintus 15:3-4', text: 'x' },
      kitabFokus: '1 Korintus 15',
      pattern: { code: 'POST_TO_POST', name: 'Post-to-Post', phases: [], playbook: 'x' },
    });
    expect(out.exegesis.points).toEqual(['Kristus mati karena dosa kita']);
    expect(out.exegesis.implications).toEqual(['Identitas bukan performa']);
  });

  it('tanpa perikop → blok peran absen', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'T',
      pattern: { code: 'MONOLOG', name: 'Monolog', phases: [], playbook: 'x' },
      fieldKeys: [],
    });
    expect(capturedPrompts.list.join('\n')).not.toContain('PERAN DUA PERIKOP');
  });
});
