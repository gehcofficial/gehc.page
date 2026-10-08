import { describe, expect, it } from 'vitest';
import { parseServiceMd, parseRhbMd, unwrapPythonMd } from '../../server/lib/didaskalia-md.mjs';
import { clampSermon } from '../../server/lib/didaskalia-ai.mjs';
import { buildPembekalanCaption, buildKhutbahCaption } from '../../src/lib/rhb-caption';

const SERVICE_MD = `# Chptr 1 - Week 2: The Rescue Plan

## A. Informasi Sesi
* **Tema Minggu Ini:** The Rescue Plan
* **Teks Utama (Serving Day / Sermon):** 2 Korintus 5:21
* **Teks Jangkar (Tema Mingguan / RHB 7 Path):** Kolose 1:13–14

## B. Materi Teologis Serving Day (Youth Sermon)

### 1. Pengantar: Mengapa Kita Butuh Rescue Plan?
Manusia mengira masalah terbesar adalah finansial dan masa depan.

### 2. Bedah Teologis 2 Korintus 5:21: The Great Exchange
Paulus merangkum soteriologi dalam tiga frasa utama.

### 3. Jembatan Menuju Tema Mingguan
Kolose 1:13-14 melengkapi gambaran secara utuh.

### 4. Kesimpulan untuk Panggung Serving Day
Anda sudah dibeli dengan harga lunas.
`;

const RHB_MD = `### Path 1: More Than Bad News
**Scripture:** Yesaya 64:6

Keadaan manusia yang telah jatuh.

> *Jembatan ke Path 2.*

### Path 2: The Power of Darkness
**Scripture:** Efesus 6:12

Pergumulan melawan kuasa kegelapan.
`;

describe('parseServiceMd', () => {
  it('mengenali 4 outline + info sesi dari MD bersih', () => {
    const r = parseServiceMd(SERVICE_MD);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.info.teksUtama).toContain('2 Korintus 5:21');
    expect(r.info.teksJangkar).toContain('Kolose 1:13');
    expect(r.outline.pengantar).toContain('finansial');
    expect(r.outline.bedahTeologis).toContain('soteriologi');
    expect(r.outline.jembatan).toContain('Kolose');
    expect(r.outline.kesimpulan).toContain('harga lunas');
  });

  it('melaporkan bagian yang hilang, bukan mengarang', () => {
    const r = parseServiceMd('# Judul\n\nIsi generik tanpa struktur.');
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('Pengantar');
    expect(r.missing).toContain('Teks Utama (Serving Day / Sermon)');
  });
});

describe('parseRhbMd', () => {
  it('mengenali Path + Scripture + bridge', () => {
    const r = parseRhbMd(RHB_MD);
    expect(r.paths).toHaveLength(2);
    expect(r.paths[0].title).toBe('More Than Bad News');
    expect(r.paths[0].scriptureRef).toBe('Yesaya 64:6');
    expect(r.paths[0].bridge).toContain('Jembatan ke Path 2');
    expect(r.missing).toContain('Hanya 2/7 Path ditemukan');
  });

  it('mengupas wrapper Python', () => {
    const wrapped = `md_content = """${RHB_MD}"""\n\nwith open("x.md", "w") as f:\n    f.write(md_content)`;
    expect(unwrapPythonMd(wrapped)).toContain('### Path 1');
    const r = parseRhbMd(wrapped);
    expect(r.paths).toHaveLength(2);
  });
});

describe('clampSermon — field 4 outline', () => {
  it('meloloskan bigIdea, teksUtama, dan outline', () => {
    const out = clampSermon({
      bigIdea: 'Rescue Plan menuntaskan semuanya.',
      teksUtama: { ref: '2 Korintus 5:21', text: 'Dia yang tidak mengenal dosa...' },
      outline: { pengantar: 'p', bedahTeologis: 'b', jembatan: 'j', kesimpulan: 'k' },
      methods: ['Teologi Biblika'],
    });
    expect(out.bigIdea).toContain('Rescue Plan');
    expect(out.teksUtama.ref).toBe('2 Korintus 5:21');
    expect(out.outline.kesimpulan).toBe('k');
  });

  it('default kosong untuk data lama', () => {
    const out = clampSermon({ summary: 'lama' });
    expect(out.bigIdea).toBe('');
    expect(out.outline.pengantar).toBe('');
    expect(out.summary).toBe('lama');
  });
});

function captionContent() {
  return {
    weekIndex: 2,
    date: '2026-10-11',
    theme: 'The Rescue Plan',
    chapterNo: '',
    fundamentalFirman: { ref: 'Kolose 1:13-14', text: '' },
    kitabFokus: '',
    paths: [],
    sermon: {
      bigIdea: 'Rescue Plan menuntaskan semuanya.',
      teksUtama: { ref: '2 Korintus 5:21', text: '' },
      outline: { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' },
      methods: ['Teologi Biblika'],
      rationale: '',
      summary: '',
      slideOutline: [],
      deliveryPlan: [],
      prepChecklist: [],
      discussionFlow: [],
    },
    images: {},
  };
}

describe('caption pembekalan & khotbah', () => {  it('pembekalan menyasar mentor + memuat teks utama dan tautan doc 02 (tanpa bigIdea AI)', () => {
    const t = buildPembekalanCaption({ doc: 'pembekalan', yearMonth: '2026-10', weekIndex: 2, content: captionContent() });
    expect(t).toContain('Mentor');
    expect(t).not.toContain('Rescue Plan menuntaskan');
    expect(t).toContain('2 Korintus 5:21');
    expect(t).toContain('#/materi/pembekalan/2026-10/2');
    expect(t).toContain('#/materi/khutbah/2026-10/2');
  });

  it('khotbah menyasar pembawa firman + teks utama', () => {
    const t = buildKhutbahCaption({ doc: 'khutbah', yearMonth: '2026-10', weekIndex: 2, content: captionContent() });
    expect(t).toContain('2 Korintus 5:21');
    expect(t).toContain('#/materi/khutbah/2026-10/2');
  });
});

describe('FGD 3Q + kembali kontekstual', () => {
  it('MONOLOG panduan memuat notes + download (isi & unduh dari FGD)', async () => {
    const { widgetsFor } = await import('../../src/lib/session-engine');
    expect(widgetsFor('MONOLOG', 'panduan')).toEqual(['guide', 'notes', 'download']);
  });

  it('pembekalan MONOLOG memuat Q eksplisit + aturan rotasi + arahan teknis', async () => {
    const { buildPembekalanDeck, contentFromStudio, patternTechnicalBullets } = await import('../../src/lib/didaskalia-presentation');
    const { defaultStudio } = await import('../../src/lib/didaskalia');
    const studio = defaultStudio();
    studio.sermon = { ...studio.sermon, discussionFlow: ['Pemanasan tema', 'Gali teks bersama', 'Terapkan nyata'] };
    const deck = buildPembekalanDeck(contentFromStudio(studio, 2, '2026-10-11', 'The Rescue Plan', null, null, 'MONOLOG'));
    // Slide Bagian B gabungan (b-pola): Q eksplisit + aturan rotasi + arahan teknis.
    const b = deck.find((s) => s.id === 'b-pola');
    expect(b?.title).toContain('FGD');
    expect(b?.fields?.map((f) => f.label)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(b?.paragraphs?.join('\n')).toContain('perwakilan bergiliran');
    expect(patternTechnicalBullets('POST_TO_POST')).toHaveLength(4);
    expect(patternTechnicalBullets('MONOLOG')[0]).toContain('Ikuti alur');
  });

  it('remember/last portal place: fallback aman + round-trip bila storage ada', async () => {    const { rememberPortalPlace, lastPortalPlace } = await import('../../src/lib/didaskalia-presentation');
    // Tanpa window (node): fallback.
    expect(lastPortalPlace()).toBe('#/portal');
    // Dengan storage stub: round-trip, materi tidak menimpa portal.
    const store: Record<string, string> = {};
    (globalThis as Record<string, unknown>).window = {
      location: { hash: '#/portal/komisi/event-info' },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
      },
    };
    try {
      rememberPortalPlace();
      expect(lastPortalPlace()).toBe('#/portal/komisi/event-info');
      rememberPortalPlace('#/materi/rhb/2026-10/2/3');
      expect(lastPortalPlace()).toBe('#/portal/komisi/event-info');
    } finally {
      delete (globalThis as Record<string, unknown>).window;
    }
  });
});
