/**
 * Presentasi Didaskalia — template tetap (kode) + isi dinamis dari Studio.
 *
 * Deck dibangun dari konten yang sama dengan PDF, sehingga web & PDF identik.
 * Rute: #/materi/<doc>/<YYYY-MM>/<pekan>[/<hari>]
 */
import {
  DAY_LABELS,
  RHB_SECTIONS,
  defaultSermon,
  ensurePaths,
  ensureRhbSections,
  type DidaskaliaPath,
  type DidaskaliaPresentationImages,
  type DidaskaliaRhbSection,
  type DidaskaliaSermon,
  type DidaskaliaStudio,
} from './didaskalia';

export type MaterialDoc = 'pembekalan' | 'khutbah' | 'rhb';

export const MATERIAL_DOCS: readonly MaterialDoc[] = ['pembekalan', 'khutbah', 'rhb'];

export const MATERIAL_DOC_LABEL: Record<MaterialDoc, string> = {
  pembekalan: 'Modul Pembekalan Mentor & Co-Mentor',
  khutbah: 'Ringkasan Khotbah',
  rhb: 'RHB 7 Hari',
};

/** Akses dokumen: 01/02 = mentor+staf, 03 = beyonders+staf. */
export function docAccess(doc: MaterialDoc): 'mentor' | 'beyonder' {
  return doc === 'rhb' ? 'beyonder' : 'mentor';
}

export type DeckSlide = {
  id: string;
  kind: 'cover' | 'section' | 'path' | 'closing';
  kicker?: string;
  title: string;
  subtitle?: string;
  imageFileId?: string;
  /** Cover: gambar dipakai full-bleed sebagai background + teks overlay. */
  background?: boolean;
  paragraphs?: string[];
  bullets?: string[];
  fields?: { label: string; value: string }[];
  callout?: { label: string; value: string };
};

export type PresentationContent = {
  weekIndex: number;
  date: string;
  theme: string;
  chapterNo: string;
  fundamentalFirman: { ref: string; text: string };
  kitabFokus: string;
  paths: DidaskaliaPath[];
  sermon: DidaskaliaSermon;
  images: DidaskaliaPresentationImages;
  /** Label deliverer (dari jenis ibadah). */
  deliverer?: string;
  /** Nama pola ibadah pekan ini (untuk judul Bagian B). */
  patternName?: string;
  /** Kode pola ibadah pekan ini (MONOLOG = alur FGD). */
  patternCode?: string;
};

export type ParsedMaterialHash = {
  doc: MaterialDoc;
  yearMonth: string;
  weekIndex: number;
  dayIndex?: number;
};

const YM_RE = /^\d{4}-\d{2}$/;

export function parseMaterialHash(hash: string): ParsedMaterialHash | null {
  const raw = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  if (seg[0] !== 'materi') return null;
  const doc = seg[1] as MaterialDoc;
  if (!MATERIAL_DOCS.includes(doc)) return null;
  const yearMonth = seg[2] || '';
  if (!YM_RE.test(yearMonth)) return null;
  const weekIndex = Number(seg[3]);
  if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > 6) return null;
  const dayIndex = seg[4] ? Number(seg[4]) : undefined;
  if (dayIndex !== undefined && (!Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > 7)) return null;
  return { doc, yearMonth, weekIndex, dayIndex };
}

export function materialHashPath(r: ParsedMaterialHash): string {
  const base = `#/materi/${r.doc}/${r.yearMonth}/${r.weekIndex}`;
  return r.dayIndex ? `${base}/${r.dayIndex}` : base;
}

export function materialAbsoluteUrl(r: ParsedMaterialHash, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://youth.gehc.page');
  return `${base}/${materialHashPath(r)}`;
}

/** URL proxy gambar (SA-backed, login-gated) — bukan link Drive publik. */
export function imageAssetUrl(fileId?: string): string | undefined {
  return fileId ? `/api/didaskalia/asset/${encodeURIComponent(fileId)}` : undefined;
}

function toParagraphs(text?: string): string[] {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Section RHB efektif: pakai tersimpan; bila kosong turunkan dari field lama. */
export function effectiveRhbSections(path: DidaskaliaPath): DidaskaliaRhbSection[] {
  const saved = ensureRhbSections(path.rhbSections);
  const anyFilled = saved.some((s) => s.body.trim() || s.imageFileId);
  if (anyFilled) return saved;
  const legacy: Record<string, string> = {
    PENGANTAR: [path.hookQuestion, path.illustration].filter(Boolean).join('\n\n'),
    PEMBAHASAN_TEMATIS: [path.scriptureText, path.interpretQ].filter(Boolean).join('\n\n'),
    MAKNA_IMPLIKASI: path.applyQ || '',
    REFLEKSI_PRIBADI: path.reflection || '',
    DISKUSI_KELOMPOK: (path.fgdQuestions || []).join('\n'),
  };
  return saved.map((s) => ({ ...s, body: legacy[s.key] || s.body }));
}

function weekCoverSubtitle(content: PresentationContent): string {
  return [content.date, content.kitabFokus].filter(Boolean).join(' · ');
}

export function buildPembekalanDeck(content: PresentationContent): DeckSlide[] {
  const { paths, images, sermon } = content;
  const deliverer = content.deliverer || 'Pengkhotbah / Deliverer';
  const outline = sermon.outline || { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' };
  const slides: DeckSlide[] = [
    {
      id: 'cover',
      kind: 'cover',
      kicker: `Modul Pembekalan · Pekan ${content.weekIndex}`,
      title: content.theme || content.kitabFokus || `Pekan ${content.weekIndex}`,
      subtitle: weekCoverSubtitle(content),
      imageFileId: images.cover,
      background: true,
    },
    {
      id: 'inti',
      kind: 'section',
      kicker: 'Inti Pesan & Fundamental Firman',
      title: 'Big Idea & Arah Tema',
      paragraphs: sermon.bigIdea ? [sermon.bigIdea] : undefined,
      callout: content.fundamentalFirman?.text
        ? { label: content.fundamentalFirman.ref || 'Fundamental Firman', value: content.fundamentalFirman.text }
        : undefined,
      fields: [
        sermon.teksUtama?.ref ? { label: 'Teks Utama Khotbah', value: sermon.teksUtama.ref } : null,
        content.kitabFokus ? { label: 'Kitab / Bagian Fokus', value: content.kitabFokus } : null,
      ].filter(Boolean) as { label: string; value: string }[],
    },
    // Garis besar bahasan pekan ini (untuk semua pembaca modul).
    {
      id: 'garis-besar',
      kind: 'section',
      kicker: 'Garis Besar Bahasan Pekan Ini',
      title: content.theme || 'Alur Pekan',
      paragraphs: [
        outline.pengantar,
        outline.jembatan,
      ].filter(Boolean).flatMap(toParagraphs),
      callout: outline.kesimpulan
        ? { label: 'Pesan Kunci', value: outline.kesimpulan }
        : undefined,
    },
    // Bagian A — untuk pengkhotbah / deliverer (ringkasan khotbah sebagai acuan).
    {
      id: 'a-deliver',
      kind: 'section',
      kicker: `Bagian A · Untuk ${deliverer}`,
      title: 'Persiapan & Penyampaian Khotbah',
      bullets: (sermon.deliveryPlan || []).map((d) => `${d.method}: ${d.how}`),
    },
    {
      id: 'a-ringkasan',
      kind: 'section',
      kicker: `Bagian A · Untuk ${deliverer}`,
      title: 'Ringkasan Khotbah',
      paragraphs: toParagraphs(sermon.summary),
      callout: sermon.rationale ? { label: 'Pendekatan & Metode', value: sermon.rationale } : undefined,
    },
    ...(sermon.slideOutline || []).map((s, i) => ({
      id: `a-slide-${i}`,
      kind: 'section' as const,
      kicker: `Kerangka Slide ${i + 1}`,
      title: s.title,
      bullets: s.bullets,
    })),
    {
      id: 'a-checklist',
      kind: 'section',
      kicker: `Bagian A · Untuk ${deliverer}`,
      title: 'Checklist Persiapan Khotbah',
      bullets: sermon.prepChecklist || [],
    },
    // Bagian B — untuk mentor & co-mentor (mengikuti pola ibadah pekan ini)
    {
      id: 'b-teknis',
      kind: 'section',
      kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
      title: `Arahan Teknis: ${content.patternName || 'Pola Ibadah'} Pekan Ini`,
      bullets: patternTechnicalBullets(content.patternCode, content.patternName),
    },
    {
      id: 'b-fgd',
      kind: 'section',
      kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
      title: !content.patternCode || String(content.patternCode).toUpperCase() === 'MONOLOG'
        ? 'Alur FGD Hari Minggu'
        : `Alur ${content.patternName || 'Ibadah'} Hari Minggu`,
      bullets: (sermon.discussionFlow || []).length
        ? sermon.discussionFlow
        : (!content.patternCode || String(content.patternCode).toUpperCase() === 'MONOLOG'
          ? [
              'Buka dengan pertanyaan pemanasan yang dekat dengan tema.',
              'Gali teks bersama (amati → pahami).',
              'Terapkan secara nyata dalam hidup pemuda/anak rantau.',
              'Tutup dengan komitmen & doa.',
            ]
          : [
              `Ikuti skenario pola ${content.patternName}.`,
              'Sesuaikan dengan tema dan audiens minggu ini.',
              'Tutup dengan komitmen & doa.',
            ]),
    },
    {
      id: 'b-7hari',
      kind: 'section',
      kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
      title: 'Gambaran 7 Hari (Minggu–Sabtu)',
      bullets: paths.map((p, i) => `${p.dayLabel || DAY_LABELS[i]} — ${p.title}${p.summary ? `: ${p.summary}` : ''}`),
    },
    {
      id: 'closing',
      kind: 'closing',
      kicker: 'Penutup',
      title: 'Tutup dengan doa syafaat',
      paragraphs: [
        'Rangkum perjalanan 7 hari minggu ini, lalu tutup dengan doa syafaat untuk tiap anggota kelompok.',
      ],
    },
  ];

  // Buang slide opsional yang kosong (mis. belum ada deliveryPlan/checklist).
  return slides.filter((s, i) =>
    i === 0 ||
    s.kind === 'closing' ||
    Boolean(s.paragraphs?.length || s.bullets?.length || s.fields?.length || s.callout)
  );
}

/** Arahan teknis mentor/co-mentor mengikuti pola ibadah pekan ini. */
export function patternTechnicalBullets(patternCode?: string, patternName?: string): string[] {
  const code = String(patternCode || 'MONOLOG').toUpperCase();
  const name = patternName || code;
  const close = 'Tutup dengan komitmen & doa syafaat.';
  switch (code) {
    case 'POST_TO_POST':
      return [
        `Briefing pos sebelum bergerak — jelaskan aturan main & rute kunjungan rank 1→3 (${name}).`,
        'Pimpin rombongan zgodnie rute; jaga timer tiap pos agar semua kebagian.',
        'PIC pos memastikan Likert & chip terisi sebelum rombongan pindah.',
        close,
      ];
    case 'DUAL_MONOLOG':
      return [
        'Siapkan blocking 2 speaker + cue musik/lampu sesuai rundown.',
        'Pimpin pembacaan berbalasan; mentor buka deep sharing lebih dulu.',
        'Akhiri dengan Satu Kata + 2 pertanyaan wajib, lalu konvergensi firman.',
        close,
      ];
    case 'DEBAT':
      return [
        'Bagi peran PRO/KONTRA + juri; pegang timer ronde secara mutlak.',
        'Moderasi netral — jangan bocorkan posisi teologis sebelum konklusi.',
        'Tutup dengan konklusi teologis dari tim (bukan skor debat).',
        close,
      ];
    case 'BEDAH_FILM':
      return [
        'Uji setup pemutaran (gambar + suara) sebelum ibadah mulai.',
        'Fasilitasi pleno analisa dengan pancingan yang sudah disiapkan.',
        'Arahkan deep sharing identitas, bukan review film.',
        close,
      ];
    case 'THREE_SEQUENCES':
      return [
        'Bagi 5 tim Mission Room sebelum sequence 1 mulai.',
        'Komando countdown tiap sequence tanpa jeda (Melayani → Bersekutu → Bersaksi).',
        'Atur presentasi 4 menit per tim + deklarasi penutup.',
        close,
      ];
    default:
      return [
        `Ikuti alur ${name}: buka dengan pemanasan dekat tema, gali teks bersama, terapkan nyata, tutup komitmen.`,
        'Pancing satu per satu — jangan biarkan 1-2 orang mendominasi.',
        close,
      ];
  }
}

export function buildRhbDayDeck(content: PresentationContent, dayIndex: number): DeckSlide[] {
  const paths = content.paths;
  const path = paths[dayIndex - 1];
  if (!path) return [];
  const sections = effectiveRhbSections(path);
  const perDay = content.images.rhb?.[String(dayIndex)] || {};
  const slides: DeckSlide[] = [
    {
      id: 'cover',
      kind: 'cover',
      kicker: `RHB · Pekan ${content.weekIndex} · ${path.dayLabel || DAY_LABELS[dayIndex - 1]}`,
      title: path.title,
      subtitle: [content.chapterNo, path.bacaanRef].filter(Boolean).join(' · '),
      imageFileId: perDay.cover || path.coverImageFileId || undefined,
      background: true,
      fields: [
        path.bacaanRef ? { label: 'Bacaan Alkitab', value: path.bacaanRef } : null,
        path.scriptureRef ? { label: 'Nats Pembimbing', value: path.scriptureRef } : null,
      ].filter(Boolean) as { label: string; value: string }[],
    },
  ];
  sections.forEach((s, i) => {
    const paragraphs = toParagraphs(s.body);
    slides.push({
      id: `sec-${s.key}`,
      kind: 'section',
      kicker: `Hari ${dayIndex} · ${path.dayLabel || DAY_LABELS[dayIndex - 1]}`,
      title: s.title,
      imageFileId: perDay[s.key] || s.imageFileId || undefined,
      paragraphs,
      bullets: s.key === 'DISKUSI_KELOMPOK' && !paragraphs.length ? path.fgdQuestions || [] : undefined,
      callout: i === 0 && path.scriptureText ? { label: path.scriptureRef || 'Nats', value: path.scriptureText } : undefined,
    });
  });
  slides.push({
    id: 'closing',
    kind: 'closing',
    kicker: 'Besok',
    title: 'Jembatan ke hari berikutnya',
    paragraphs: [path.bridge || 'Teruskan perjalanan RHB besok dengan hati yang terbuka.'],
  });
  return slides;
}

export function buildKhutbahDeck(content: PresentationContent): DeckSlide[] {
  const { sermon, images } = content;
  const outline = sermon.outline || { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' };
  const slides: DeckSlide[] = [
    {
      id: 'cover',
      kind: 'cover',
      kicker: `Ringkasan Khotbah · Pekan ${content.weekIndex}`,
      title: content.theme || `Pekan ${content.weekIndex}`,
      subtitle: weekCoverSubtitle(content),
      imageFileId: images.cover,
      background: true,
    },
    {
      id: 'inti',
      kind: 'section',
      kicker: 'Ringkasan',
      title: 'Inti Khotbah',
      paragraphs: [
        ...(sermon.bigIdea ? [`Inti pesan: ${sermon.bigIdea}`] : []),
        ...toParagraphs(sermon.summary),
      ],
      callout: sermon.teksUtama?.ref
        ? { label: `Teks Utama · ${sermon.teksUtama.ref}`, value: sermon.teksUtama.text || sermon.teksUtama.ref }
        : sermon.rationale
          ? { label: 'Pendekatan & Metode', value: sermon.rationale }
          : undefined,
    },
    {
      id: 'outline-pengantar',
      kind: 'section',
      kicker: 'Outline · 1 Pengantar',
      title: 'Pengantar',
      paragraphs: toParagraphs(outline.pengantar),
    },
    {
      id: 'outline-bedah',
      kind: 'section',
      kicker: 'Outline · 2 Bedah Teologis',
      title: 'Bedah Teologis',
      paragraphs: toParagraphs(outline.bedahTeologis),
    },
    {
      id: 'outline-jembatan',
      kind: 'section',
      kicker: 'Outline · 3 Jembatan',
      title: 'Jembatan ke Tema Mingguan',
      paragraphs: toParagraphs(outline.jembatan),
    },
    {
      id: 'outline-kesimpulan',
      kind: 'section',
      kicker: 'Outline · 4 Kesimpulan',
      title: 'Kesimpulan (Siap-Baca)',
      paragraphs: toParagraphs(outline.kesimpulan),
    },
  ];
  (sermon.slideOutline || []).forEach((s, i) => {
    const imgId = images.khutbah?.[String(i)];
    slides.push({
      id: `slide-${i}`,
      kind: 'section',
      kicker: `Slide ${i + 1}`,
      title: s.title,
      imageFileId: imgId,
      bullets: s.bullets,
      callout: !imgId && s.visualNote ? { label: 'Arahan Visual', value: s.visualNote } : undefined,
    });
  });
  return slides;
}

export function buildDeck(doc: MaterialDoc, content: PresentationContent, dayIndex?: number): DeckSlide[] {
  if (doc === 'pembekalan') return buildPembekalanDeck(content);
  if (doc === 'khutbah') return buildKhutbahDeck(content);
  return buildRhbDayDeck(content, dayIndex || 1);
}

/** Ringkasan 7 hari untuk halaman indeks RHB. */
export function rhbDayList(content: PresentationContent): { dayIndex: number; dayLabel: string; title: string; ref: string }[] {
  return content.paths.map((p, i) => ({
    dayIndex: i + 1,
    dayLabel: p.dayLabel || DAY_LABELS[i],
    title: p.title,
    ref: p.scriptureRef,
  }));
}

/** Label deliverer berdasarkan jenis ibadah (mentoring/serving day). */
export function delivererLabel(serviceType?: string | null): string {
  const t = String(serviceType || '').toUpperCase();
  if (t.includes('MENTORING')) return 'Perwakilan Tim Didaskalia';
  if (t.includes('SERVING')) return 'Perwakilan yang akan Berkhotbah';
  return 'Pengkhotbah / Deliverer';
}

/** Konten presentasi dari studio (live). */
export function contentFromStudio(studio: DidaskaliaStudio, weekIndex: number, date: string, theme: string, serviceType?: string | null, patternName?: string | null, patternCode?: string | null): PresentationContent {
  return {
    weekIndex,
    date,
    theme,
    chapterNo: studio.chapterNo || '',
    fundamentalFirman: studio.fundamentalFirman || { ref: '', text: '' },
    kitabFokus: studio.kitabFokus || '',
    paths: ensurePaths(studio),
    sermon: studio.sermon || defaultSermon(),
    images: studio.presentation || {},
    deliverer: delivererLabel(serviceType),
    patternName: patternName || undefined,
    patternCode: patternCode || undefined,
  };
}

export { RHB_SECTIONS };
