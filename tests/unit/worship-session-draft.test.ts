import { describe, expect, it, vi } from 'vitest';
import {
  countFilled,
  draftToStored,
  emptySessionDraft,
  sessionDraftGuard,
  sessionHasDraftContent,
  storedToSections,
  templateFieldKeys,
} from '../../src/lib/worship-session-draft';
import { deepGuide, filmAffirm, normalizeConfig } from '../../server/routes/worship.mjs';
import { parseFilmDurationMin } from '../../server/lib/session-stage.mjs';

const CODES = ['MONOLOG', 'POST_TO_POST', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES', 'CREATIVE_LAB'];

describe('session-draft: template kosongan 6 pola', () => {
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
    expect(countFilled(back)).toEqual({ filled: 1, total: 21 });
  });

  it('MONOLOG gabungan: FGD 3 + lagu 6 + deep 2 + lesson 10; DUAL memetakan ke MONOLOG', () => {
    const keys = templateFieldKeys('MONOLOG').map((f) => f.key);
    for (const k of ['fgd-observe', 'fgd-interpret', 'fgd-apply', 'song-title', 'song-book-ref', 'song-writer', 'song-story', 'song-about', 'song-id', 'deep-q1', 'deep-q2', 'lesson-chip-1', 'lesson-chip-10']) {
      expect(keys).toContain(k);
    }
    expect(keys).not.toContain('song-singer');
    expect(templateFieldKeys('DUAL_MONOLOG').map((f) => f.key)).toEqual(keys);
  });

  it('BEDAH_FILM: film + likert 5 (2 ronde) + deep 3 + afirmasi 5 + lesson 10', () => {
    const keys = templateFieldKeys('BEDAH_FILM').map((f) => f.key);
    for (const k of ['film-title', 'film-scenes', 'likert-film-1', 'likert-film-5', 'film-q1', 'film-q3', 'affirm-q1', 'affirm-likert-low', 'affirm-likert-high', 'lesson-chip-1', 'lesson-chip-10']) {
      expect(keys).toContain(k);
    }
    expect(keys.filter((k) => k.startsWith('likert-film-'))).toHaveLength(5);
  });

  it('CREATIVE_LAB: 6 kartu jar + 5 kelompok × 5 field + durasi fase', () => {
    const keys = templateFieldKeys('CREATIVE_LAB').map((f) => f.key);
    for (const k of ['jar-root', 'jar-truth', 'jar-lost', 'jar-community', 'jar-verse', 'jar-step']) {
      expect(keys).toContain(k);
    }
    expect(keys.filter((k) => k.startsWith('group-'))).toHaveLength(25);
    expect(keys).toContain('group-1-scribe');
    expect(keys).toContain('group-5-bag');
    expect(keys).toContain('a1-minutes');
    expect(keys).toContain('a2-minutes');
    expect(keys).toContain('present-seconds');
    expect(keys.filter((k) => k.startsWith('lesson-chip-'))).toHaveLength(10);
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

describe('session-draft: gate kontrol mengikuti bila draft terisi', () => {
  it('null/kosong → belum terisi', () => {
    expect(sessionHasDraftContent(null)).toBe(false);
    expect(sessionHasDraftContent({ config: null, likertItems: [], chips: [] })).toBe(false);
    expect(sessionHasDraftContent({ config: { draft: null } })).toBe(false);
    expect(sessionHasDraftContent({ config: { draft: { fgd: { 'fgd-observe': '  ' } } } })).toBe(false);
  });

  it('draft form terisi → terisi', () => {
    expect(sessionHasDraftContent({ config: { draft: { fgd: { 'fgd-observe': 'Apa yang kamu lihat?' } } } })).toBe(true);
  });

  it('soal/chip hasil Terapkan → terisi walau draft config kosong', () => {
    expect(sessionHasDraftContent({ config: {}, likertItems: [{ id: 'x' }], chips: [] })).toBe(true);
    expect(sessionHasDraftContent({ config: {}, likertItems: [], chips: [{ id: 'y' }] })).toBe(true);
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
import { CASE_FOR_CHRIST_DRAFT } from '../../server/lib/bedah-film-case-for-christ.mjs';

describe('session-draft: curasi The Case for Christ', () => {
  it('memuat film + 5 likert + 3 deep + 5 afirmasi + 10 chip', () => {
    expect(CASE_FOR_CHRIST_DRAFT.film['film-title']).toContain('The Case for Christ');
    expect(Object.keys(CASE_FOR_CHRIST_DRAFT['likert-film'])).toHaveLength(5);
    expect(Object.keys(CASE_FOR_CHRIST_DRAFT.deep)).toHaveLength(3);
    expect(Object.keys(CASE_FOR_CHRIST_DRAFT.affirm)).toHaveLength(5);
    expect(Object.keys(CASE_FOR_CHRIST_DRAFT.affirm)).toEqual(
      expect.arrayContaining(['affirm-q1', 'affirm-q2', 'affirm-q3', 'affirm-likert-low', 'affirm-likert-high']),
    );
    expect(Object.keys(CASE_FOR_CHRIST_DRAFT.lesson)).toHaveLength(10);
  });

  it('berakar firman kebangkitan + konteks Beyonders', () => {
    const all = JSON.stringify(CASE_FOR_CHRIST_DRAFT);
    expect(all).toContain('1 Korintus 15');
    expect(all).toContain('Yohanes 20');
    expect(all).toContain('500');
    expect(all).toContain('Lee Strobel');
  });

  it('Likert PRE baseline tanpa spoiler (tanpa nama tokoh/plot)', () => {
    const vals = Object.values(CASE_FOR_CHRIST_DRAFT['likert-film']);
    for (const v of vals) {
      expect(v).not.toMatch(/Leslie|Lee Strobel/);
    }
  });

  it('setiap nilai muat batas 2000 char server', () => {
    const vals = Object.values(CASE_FOR_CHRIST_DRAFT).flatMap((sec) => Object.values(sec));
    expect(vals.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 2000)).toBe(true);
  });
});

describe('session-draft: filmAffirm afirmasi per jawaban', () => {
  it('kosong → fallback 1Kor 15 / Yoh 20 / Kis 4', () => {
    const out = filmAffirm({ draft: {} });
    expect(Object.keys(out.notes)).toEqual(['FILM-Q1', 'FILM-Q2', 'FILM-Q3']);
    expect(out.notes['FILM-Q1']).toContain('1Kor 15:3');
    expect(out.likertLow).toContain('Yoh 20:27');
    expect(out.likertHigh).toContain('1Kor 15:58');
  });

  it('draf terisi → pakai redaksi tim', () => {
    const out = filmAffirm({ draft: { affirm: { 'affirm-q1': 'Custom Q1', 'affirm-likert-high': 'Custom high' } } });
    expect(out.notes['FILM-Q1']).toBe('Custom Q1');
    expect(out.notes['FILM-Q2']).toContain('1Kor 15:6');
    expect(out.likertHigh).toBe('Custom high');
  });
});

describe('session-draft: screening dari judul draf', () => {
  it('parse "…2017, 112 menit…" → 112 (tahun diabaikan)', () => {
    expect(parseFilmDurationMin('The Case for Christ (2017, 112 menit — tayang versi 60–95 menit)')).toBe(112);
  });

  it('tanpa angka menit → 90; clamp 10–180', () => {
    expect(parseFilmDurationMin('Judul Tanpa Angka')).toBe(90);
    expect(parseFilmDurationMin('Film (5 menit)')).toBe(90);
    expect(parseFilmDurationMin('Film (09 menit)')).toBe(10);
    expect(parseFilmDurationMin('Film (500 menit)')).toBe(180);
  });
});

describe('session-draft: deepGuide film 3Q', () => {
  it('draf film → 3 pertanyaan dari film-q1..3', () => {
    const out = deepGuide({ draft: { deep: { 'film-q1': 'Q1?', 'film-q2': 'Q2?', 'film-q3': 'Q3?' } } });
    expect(out).toEqual(['Q1?', 'Q2?', 'Q3?']);
  });

  it('draf monolog → tetap 2 pertanyaan deep-q', () => {
    const out = deepGuide({ draft: { deep: { 'deep-q1': 'A?', 'deep-q2': 'B?' } } });
    expect(out).toEqual(['A?', 'B?']);
  });

  it('kosong → fallback generik (film: 3, monolog: 2)', () => {
    expect(deepGuide({ draft: { deep: { 'film-q1': 'X' } } })).toHaveLength(3);
    expect(deepGuide({ draft: {} })).toHaveLength(2);
  });
});

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

  it('prompt bedah lagu: KJ/NKB/NNBT + anti-ngarang + kisah', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'Setia sampai akhir',
      fundamentalFirman: { ref: 'Why 2:10', text: 'Hendaklah engkau setia sampai mati...' },
      pattern: { code: 'MONOLOG', name: 'Monolog', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('MONOLOG'),
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('BEDAH LAGU');
    expect(prompt).toContain('song-book-ref');
    expect(prompt).toContain('NNBT');
    expect(prompt).toContain('song-story');
    expect(prompt).toContain('perlu verifikasi tim');
    expect(prompt).toContain('Mengikut Yesus Keputusanku');
  });

  it('prompt likert film: 5 pernyataan dipakai 2 ronde', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'T',
      fundamentalFirman: { ref: 'Why 2:10', text: 'Setia sampai mati...' },
      pattern: { code: 'BEDAH_FILM', name: 'Movie Breakdown', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('BEDAH_FILM'),
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('LIKERT FILM');
    expect(prompt).toContain('likert-film-1');
    expect(prompt).toContain('LESSON LEARNED');
  });

  it('tanpa kunci song-* → aturan bedah lagu absen', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'T',
      pattern: { code: 'DEBAT', name: 'Debat', phases: [], playbook: 'x' },
      fieldKeys: [{ key: 'mosi-1', label: 'Mosi 1' }],
    });
    expect(capturedPrompts.list.join('\n')).not.toContain('BEDAH LAGU');
  });

  it('prompt chip lesson: ada bila kunci lesson-chip-* dikirim', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'T',
      fundamentalFirman: { ref: 'Why 2:10', text: 'Setia sampai mati...' },
      pattern: { code: 'MONOLOG', name: 'Monolog', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('MONOLOG'),
    });
    expect(capturedPrompts.list.join('\n')).toContain('LESSON LEARNED');
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'T',
      pattern: { code: 'DEBAT', name: 'Debat', phases: [], playbook: 'x' },
      fieldKeys: [{ key: 'mosi-1', label: 'Mosi 1' }],
    });
    expect(capturedPrompts.list.join('\n')).not.toContain('LESSON LEARNED');
  });

  it('film kunci tim: judul dipakai sebagai anchor, bukan diganti', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 3,
      theme: 'T',
      fundamentalFirman: { ref: '1 Korintus 15:3-4', text: 'Kristus telah mati...' },
      pattern: { code: 'BEDAH_FILM', name: 'Bedah Film', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('BEDAH_FILM'),
      filmTitle: 'The Case for Christ (2017)',
      currentDraft: { film: { 'film-title': 'The Case for Christ (2017)' } },
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('FILM KUNCI DARI TIM');
    expect(prompt).toContain('The Case for Christ');
    expect(prompt).toContain('JANGAN DIGANTI');
    expect(prompt).toContain('Lee Strobel');
  });

  it('tanpa film kunci: anti-contoh menolak default lama', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 3,
      theme: 'T',
      pattern: { code: 'BEDAH_FILM', name: 'Bedah Film', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('BEDAH_FILM'),
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('Gavin Stone');
    expect(prompt).toContain('JANGAN mengarang film populer');
  });

  it('prompt deep film: Q2 wajib kait Bedah Teologis khotbah', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 3,
      theme: 'Ancient Word, Modern World',
      fundamentalFirman: { ref: '1 Korintus 15:3-4', text: 'Kristus telah mati...' },
      sermonSummary: 'Ringkasan…',
      sermonBigIdea: 'Kebangkitan Yesus adalah fakta sejarah yang menuntut respons.',
      sermonTeksUtama: { ref: '1 Korintus 15:3-8', text: '…' },
      pattern: { code: 'BEDAH_FILM', name: 'Bedah Film', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('BEDAH_FILM'),
      filmTitle: 'The Case for Christ',
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('DEEP SHARING FILM');
    expect(prompt).toContain('FOKUS KHOTBAH PEKAN');
    expect(prompt).toContain('Kebangkitan Yesus adalah fakta sejarah');
    expect(prompt).toContain('1 Korintus 15:3-8');
  });

  it('tanpa kunci film-q → aturan deep film absen', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 3,
      theme: 'T',
      pattern: { code: 'DEBAT', name: 'Debat', phases: [], playbook: 'x' },
      fieldKeys: [{ key: 'mosi-1', label: 'Mosi 1' }],
    });
    expect(capturedPrompts.list.join('\n')).not.toContain('DEEP SHARING FILM');
  });

  it('prompt Creative Lab: jar/a1/a2/group + anti-ngarang nama', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 2,
      theme: 'Akar yang Berbuah',
      fundamentalFirman: { ref: 'Yakobus 1:22-25', text: 'Jadilah pelaku firman...' },
      pattern: { code: 'CREATIVE_LAB', name: 'Creative Lab', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('CREATIVE_LAB'),
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('ATURAN CREATIVE LAB');
    expect(prompt).toContain('jar-root');
    expect(prompt).toContain('a2-pot');
    expect(prompt).toContain('a2-bag');
    expect(prompt).toContain('group-*');
    expect(prompt).toContain('jangan mengarang nama');
  });

  it('draf saat ini dikirim sebagai masukan', async () => {
    capturedPrompts.list = [];
    await generateSessionDraft({
      yearMonth: '2026-10',
      weekIndex: 3,
      theme: 'T',
      pattern: { code: 'BEDAH_FILM', name: 'Bedah Film', phases: [], playbook: 'x' },
      fieldKeys: templateFieldKeys('BEDAH_FILM'),
      currentDraft: { film: { 'film-title': 'The Case for Christ' }, deep: { 'film-q1': 'sudah terisi' } },
    });
    const prompt = capturedPrompts.list.join('\n');
    expect(prompt).toContain('DRAF SAAT INI');
    expect(prompt).toContain('film-title');
  });
});
