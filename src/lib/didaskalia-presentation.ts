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
import { stripMd } from './md-lite';

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
  /** Judul besar opsional — slide potongan khutbah 02 tidak memakainya (cukup kicker). */
  title?: string;
  subtitle?: string;
  imageFileId?: string;
  /** Cover: gambar dipakai full-bleed sebagai background + teks overlay. */
  background?: boolean;
  paragraphs?: string[];
  bullets?: string[];
  fields?: { label: string; value: string }[];
  callout?: { label: string; value: string };
  /** Tautan aksi (mis. garis besar → doc Ringkasan Khotbah 02). */
  cta?: { label: string; href: string; text: string };
  /**
   * Sembunyikan judul besar (h1) — identitas cukup dari kicker.
   * Dipakai slide isi pembekalan & RHB (khotbah tidak tersentuh).
   */
  hideTitle?: boolean;
  /**
   * Judul kecil (bukan H1) — identitas segmen tetap tampil ringkas.
   * Dipakai slide section RHB (nama segmen saja, tanpa kicker hari/nomor).
   */
  smallTitle?: boolean;
  /**
   * Header sebaris pengganti H1: `{ lead, title }` dirender satu baris
   * (lead kecil kapital + judul beda warna). Dipakai cover RHB harian.
   */
  inlineTitle?: { lead: string; title: string };
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

/** Tugas operasional mentor/co-mentor yang berlaku di semua pola. */
export function mentorOpsBullets(): string[] {
  return [
    'Absensi: arahkan tiap anggota scan QR kehadiran saat tiba; catat tamu/walk-in tanpa QR ke Koinonia sebelum segmen inti dimulai.',
    'Pastikan kehadiran tercatat sebelum segmen inti dimulai — yang belum tercatat difollow-up mentor kelompoknya.',
    'Update monitoring: isi kehadiran + catatan tindak lanjut tiap kelompok di panel monitoring seusai ibadah.',
  ];
}

/** Panjang acuan kalimat kunci garis besar (±char, dipotong di batas kata + elipsis). */
export const GARIS_BESAR_MAX_CHARS = 200;

function stripListMarker(line: string): string {
  return String(line || '')
    .replace(/^\s*(#{2,4}\s+|> ?)/, '')
    .replace(/^\s*(\d+[.)]|[*\-])\s+/, '')
    .replace(/^\s*[A-E][.)]\s+/, '')
    .trim();
}

const GARIS_BESAR_TAKEAWAY_RE = /(poin utama|ingatlah|kuncinya|camkan|jadi,? hari ini)/i;

/**
 * Ambil 1 kalimat kunci VERBATIM dari satu bagian outline (untuk garis besar pembekalan).
 * Prioritas: baris takeaway ("Poin Utama bagi Anak Muda: ...") → baris pertama.
 * Kata-kata tidak diubah; hanya kupas penanda list dan potong di batas kata bila
 * melebihi budget (±200 char, prefix verbatim + elipsis).
 */
export function extractKeySentence(text?: string): string {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  const raw = lines.find((l) => GARIS_BESAR_TAKEAWAY_RE.test(stripMd(l))) || lines[0];
  const clean = stripListMarker(raw).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const m = clean.match(/^[^.!?]+[.!?]/);
  let s = (m ? m[0] : clean).trim();
  // Abaikan chunk sampah (pemisah `---`/kosong) — tak ada huruf/angka.
  if (!stripMd(s).replace(/[^A-Za-zÀ-ÿ0-9]/g, '')) return '';
  if (s.length > GARIS_BESAR_MAX_CHARS) {
    const cut = s.slice(0, GARIS_BESAR_MAX_CHARS);
    const ws = cut.lastIndexOf(' ');
    s = `${(ws > 80 ? cut.slice(0, ws) : cut).trim()} …`;
  }
  return s;
}

export type GarisBesarItem = { key: KhutbahOutlineKey; no: string; title: string; sentence: string };

/**
 * Garis besar 4 komponen outline (urutan tetap, hanya yang terisi).
 * Dipakai modul Pembekalan 01 agar tak menduplikasi seluruh isi literal doc 02.
 */
export function extractGarisBesar(outline?: DidaskaliaSermon['outline']): GarisBesarItem[] {
  const o = outline || { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' };
  return (Object.keys(KHUTBAH_OUTLINE_SECTIONS) as KhutbahOutlineKey[])
    .map((key) => ({
      key,
      no: KHUTBAH_OUTLINE_SECTIONS[key].no,
      title: KHUTBAH_OUTLINE_SECTIONS[key].title,
      sentence: extractKeySentence(o[key]),
    }))
    .filter((g) => g.sentence);
}

/** Baris standar gambaran 7 hari: label = nama hari, value = judul (tanpa summary). */
export function penutupDayFields(paths: DidaskaliaPath[]): { label: string; value: string }[] {
  return paths.map((p, i) => ({
    label: p.dayLabel || DAY_LABELS[i],
    value: p.title || '—',
  }));
}

/** Hash indeks RHB 7 hari sepekan — tujuan CTA dari penutup pembekalan. */
export function rhbIndexHashFor(content: PresentationContent): string {
  const ym = String(content.date || '').slice(0, 7);
  if (!YM_RE.test(ym)) return '#/materi/rhb';
  return `#/materi/rhb/${ym}/${content.weekIndex}`;
}

/** Hash doc 02 (Ringkasan Khotbah) sepekan — tujuan CTA dari garis besar pembekalan. */
export function khutbahHashFor(content: PresentationContent): string {
  const ym = String(content.date || '').slice(0, 7);
  if (!YM_RE.test(ym)) return '#/materi/khutbah';
  return `#/materi/khutbah/${ym}/${content.weekIndex}`;
}

/** Budget baris per slide isi (H1 sudah hilang → ruang baca lega, tanpa scroll). */
export const PACK_BUDGET = 10;

export type PackBlock =
  | { t: 'para'; text: string; cost?: number }
  | { t: 'field'; label: string; value: string }
  | { t: 'bullet'; text: string };

function packBlockLines(b: PackBlock): number {
  if (b.t === 'para') return b.cost ?? Math.max(1, estimateUnitLines(b.text));
  if (b.t === 'field') return 1 + Math.max(1, estimateUnitLines(b.value));
  return Math.max(1, estimateUnitLines(b.text));
}

/**
 * Packing budget ala koper: blok diisi berurutan sampai ±budget baris.
 * - 1 blok tak pernah dipotong (kalimat utuh).
 * - Ekor mungil (≤3 baris) digabung ke halaman sebelumnya bila muat dalam
 *   budget+2 (standar anti slide-almost-empty).
 * Hasil: slide pendek menyatu sendiri, slide panjang tetap pecah.
 */
export function packBlocks(blocks: PackBlock[], budget = PACK_BUDGET): PackBlock[][] {
  const pages: PackBlock[][] = [];
  let cur: PackBlock[] = [];
  let lines = 0;
  for (const b of blocks) {
    const bl = packBlockLines(b);
    if (cur.length && lines + bl > budget) {
      pages.push(cur);
      cur = [];
      lines = 0;
    }
    cur.push(b);
    lines += bl;
  }
  if (cur.length) pages.push(cur);
  if (pages.length > 1) {
    const tail = pages[pages.length - 1];
    const tailLines = tail.reduce((n, x) => n + packBlockLines(x), 0);
    const prev = pages[pages.length - 2];
    const prevLines = prev.reduce((n, x) => n + packBlockLines(x), 0);
    if (tailLines <= 3 && prevLines + tailLines <= budget + 2) {
      prev.push(...pages.pop()!);
    }
  }
  return pages;
}

/** Pecah blok PackBlock per jenis untuk slot paragraphs/fields/bullets slide. */
function splitPacked(page: PackBlock[]): { paras: string[]; fields: { label: string; value: string }[]; bullets: string[] } {
  const paras: string[] = [];
  const fields: { label: string; value: string }[] = [];
  const bullets: string[] = [];
  for (const b of page) {
    if (b.t === 'para') paras.push(b.text);
    else if (b.t === 'field') fields.push({ label: b.label, value: b.value });
    else bullets.push(b.text);
  }
  return { paras, fields, bullets };
}

/** Nomor halaman ala khotbah (`Judul (1/2)`, kicker `· 1/2`) bila >1 slide. */
function paginateSlides(slides: DeckSlide[]): DeckSlide[] {
  if (slides.length <= 1) return slides;
  return slides.map((s, i) => ({
    ...s,
    kicker: `${s.kicker || ''} · ${i + 1}/${slides.length}`.replace(/^ · /, ''),
    title: `${s.title} (${i + 1}/${slides.length})`,
  }));
}

export function buildPembekalanDeck(content: PresentationContent): DeckSlide[] {
  const { paths, images, sermon } = content;
  const deliverer = content.deliverer || 'Pengkhotbah / Deliverer';
  const garis = extractGarisBesar(sermon.outline);
  const khutbahHref = khutbahHashFor(content);
  const isMonolog = !content.patternCode || String(content.patternCode).toUpperCase() === 'MONOLOG';
  const flow = sermon.discussionFlow || [];
  const flowBullets = isMonolog
    ? []
    : flow.length
      ? flow
      : [
        `Ikuti skenario pola ${content.patternName}.`,
        'Sesuaikan dengan tema dan audiens minggu ini.',
        'Tutup dengan komitmen & doa.',
      ];

  // 1. Cover (tanpa bigIdea AI — standar literal).
  const cover: DeckSlide = {
    id: 'cover',
    kind: 'cover',
    kicker: `Modul Pembekalan · Pekan ${content.weekIndex}`,
    title: content.theme || content.kitabFokus || `Pekan ${content.weekIndex}`,
    subtitle: weekCoverSubtitle(content),
    imageFileId: images.cover,
    background: true,
    callout: content.fundamentalFirman?.text
      ? { label: content.fundamentalFirman.ref || 'Fundamental Firman', value: content.fundamentalFirman.text }
      : undefined,
    fields: [
      sermon.teksUtama?.ref ? { label: 'Teks Utama Khotbah', value: sermon.teksUtama.ref } : null,
      content.kitabFokus ? { label: 'Kitab / Bagian Fokus', value: content.kitabFokus } : null,
    ].filter(Boolean) as { label: string; value: string }[],
  };

  // 2. Garis besar 4 komponen (ekstrak verbatim) — packing budget ±10 baris:
  //    komponen pendek menyatu sendiri, panjang tetap pecah. CTA ke doc 02
  //    di slide terakhir. Paragraf memakai penanda `####` agar MdBlocks
  //    memberi highlight ala khotbah.
  const garisPages = packBlocks(
    garis.map((g) => ({
      t: 'para' as const,
      text: `#### ${g.no}. ${g.title}\n\n${g.sentence}`,
      cost: 1 + Math.max(1, estimateUnitLines(g.sentence)),
    }))
  );
  const garisSlides: DeckSlide[] = (garisPages.length ? garisPages : [[]]).map((page, ci, arr) => ({
    id: `garis-besar${arr.length > 1 ? `-${ci + 1}` : ''}`,
    kind: 'section' as const,
    kicker: 'Garis Besar · 4 Komponen',
    title: content.theme || 'Alur Pekan',
    hideTitle: true,
    paragraphs: splitPacked(page).paras,
    ...(ci === arr.length - 1
      ? {
        callout: { label: 'Detail Penuh', value: 'Uraian tiap komponen ada di Ringkasan Khotbah (doc 02).' } as { label: string; value: string },
        cta: { label: 'Buka Ringkasan Khotbah', href: khutbahHref, text: 'Detail 4 bagian verbatim' },
      }
      : {}),
  }));

  // 3. Bagian A — packing budget: deliver + checklist pendek jadi 1 slide
  //    gabungan; panjang tetap pecah per jenis.
  const aFieldBlocks: PackBlock[] = (sermon.deliveryPlan || []).map((d) => ({ t: 'field' as const, label: d.method || 'Metode', value: d.how }));
  const aBulletBlocks: PackBlock[] = (sermon.prepChecklist || []).map((c) => ({ t: 'bullet' as const, text: c }));
  const bagianA: DeckSlide[] = [];
  if (aFieldBlocks.length || aBulletBlocks.length) {
    const aAll = packBlocks([...aFieldBlocks, ...aBulletBlocks]);
    if (aAll.length <= 1) {
      const { fields, bullets } = splitPacked(aAll[0] || []);
      bagianA.push({
        id: aFieldBlocks.length ? 'a-deliver' : 'a-checklist',
        kind: 'section',
        kicker: `Bagian A · Untuk ${deliverer}`,
        title: aFieldBlocks.length && aBulletBlocks.length
          ? 'Panduan Deliver & Checklist Persiapan'
          : aFieldBlocks.length ? 'Panduan Deliver per Metode' : 'Checklist Persiapan Khotbah',
        hideTitle: true,
        fields,
        bullets,
      });
    } else {
      packBlocks(aFieldBlocks).forEach((pg, i, arr) => {
        if (!pg.length) return;
        bagianA.push({
          id: `a-deliver${arr.length > 1 ? `-${i + 1}` : ''}`,
          kind: 'section',
          kicker: `Bagian A · Untuk ${deliverer}`,
          title: 'Panduan Deliver per Metode',
          hideTitle: true,
          fields: splitPacked(pg).fields,
        });
      });
      packBlocks(aBulletBlocks).forEach((pg, i, arr) => {
        if (!pg.length) return;
        bagianA.push({
          id: `a-checklist${arr.length > 1 ? `-${i + 1}` : ''}`,
          kind: 'section',
          kicker: `Bagian A · Untuk ${deliverer}`,
          title: 'Checklist Persiapan Khotbah',
          hideTitle: true,
          bullets: splitPacked(pg).bullets,
        });
      });
    }
  }

  // 4. Bagian B — packing budget: Q + teknis pendek jadi 1 slide;
  //    panjang tetap pecah (Q dulu, lalu teknis). Aturan jawab selalu di slide Q pertama.
  const tech = patternTechnicalBullets(content.patternCode, content.patternName);
  const ops = mentorOpsBullets();
  const bagianB: DeckSlide[] = [];
  if (isMonolog) {
    const aturan: PackBlock = { t: 'para', text: 'Aturan jawab: tiap pertanyaan dijawab 1–2 perwakilan bergiliran — yang lain menulis catatannya.' };
    const qBlocks: PackBlock[] = flow.map((q, i) => ({ t: 'field' as const, label: `Q${i + 1}`, value: q }));
    const tBlocks: PackBlock[] = [...tech, ...ops].map((b) => ({ t: 'bullet' as const, text: b }));
    const allB = packBlocks([aturan, ...qBlocks, ...tBlocks]);
    if (allB.length <= 1 && (qBlocks.length || tBlocks.length)) {
      const { paras, fields, bullets } = splitPacked(allB[0]);
      bagianB.push({
        id: 'b-pola',
        kind: 'section',
        kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
        title: 'Arahan Teknis & Pertanyaan FGD Hari Minggu',
        hideTitle: true,
        paragraphs: paras,
        fields,
        bullets,
      });
    } else {
      packBlocks([aturan, ...qBlocks]).forEach((pg, qi, arr) => {
        if (!pg.length) return;
        const { paras, fields } = splitPacked(pg);
        if (!paras.length && !fields.length) return;
        bagianB.push({
          id: `b-pola${arr.length > 1 ? `-${qi + 1}` : ''}`,
          kind: 'section',
          kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
          title: qi === 0 ? 'Arahan Teknis & Pertanyaan FGD Hari Minggu' : 'Pertanyaan FGD (lanjutan)',
          hideTitle: true,
          paragraphs: paras,
          fields,
        });
      });
      packBlocks(tBlocks).forEach((pg, ci, arr) => {
        if (!pg.length) return;
        bagianB.push({
          id: `b-teknis${arr.length > 1 ? `-${ci + 1}` : ''}`,
          kind: 'section',
          kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
          title: 'Arahan Teknis & Tugas Operasional',
          hideTitle: true,
          bullets: splitPacked(pg).bullets,
        });
      });
    }
  } else {
    packBlocks([...tech, ...flowBullets, ...ops].map((b) => ({ t: 'bullet' as const, text: b }))).forEach((pg, ci, arr) => {
      if (!pg.length) return;
      bagianB.push({
        id: `b-pola${arr.length > 1 ? `-${ci + 1}` : ''}`,
        kind: 'section',
        kicker: 'Bagian B · Untuk Mentor & Co-Mentor',
        title: `Arahan Teknis & Alur ${content.patternName || 'Ibadah'} Hari Minggu`,
        hideTitle: true,
        bullets: splitPacked(pg).bullets,
      });
    });
  }

  // 5. Penutup — 1 slide ringkas: 7 hari sebagai baris standar
  //    (label hari + judul, tanpa summary) + doa syafaat + CTA ke indeks RHB.
  const penutupSlide: DeckSlide = {
    id: 'penutup',
    kind: 'closing',
    kicker: 'Penutup',
    title: 'Tutup dengan doa syafaat',
    fields: penutupDayFields(paths),
    paragraphs: [
      'Rangkum perjalanan 7 hari minggu ini, lalu tutup dengan doa syafaat untuk tiap anggota kelompok.',
    ],
    callout: { label: 'Lanjut RHB', value: 'Renungan harian Senin–Sabtu ada di RHB 7 Hari (doc 03).' },
    cta: { label: 'Buka RHB 7 Hari', href: rhbIndexHashFor(content), text: 'Indeks renungan sepekan' },
  };

  const slides: DeckSlide[] = [
    cover,
    ...paginateSlides(garisSlides),
    ...paginateSlides(bagianA),
    ...paginateSlides(bagianB),
    penutupSlide,
  ];

  // Buang slide opsional yang kosong (mis. belum ada deliveryPlan/checklist).
  return slides.filter((s, i) =>
    i === 0 ||
    s.kind === 'closing' ||
    Boolean(s.paragraphs?.length || s.bullets?.length || s.fields?.length || s.callout || s.cta)
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
  const rhbAi = content.images.rhbAi && typeof content.images.rhbAi === 'object' ? content.images.rhbAi : {};
  // Standar visual RHB: 1 gambar AI harian untuk SEMUA halaman hari itu (prinsip
  // khutbah: tulisan di atas gambar). Fallback terakhir = cover pekan.
  const daily = rhbAi[String(dayIndex)] || content.images.cover || undefined;
  const dayLabel = path.dayLabel || DAY_LABELS[dayIndex - 1];
  const useBg = Boolean(daily);
  const slides: DeckSlide[] = [
    {
      id: 'cover',
      kind: 'cover',
      kicker: `RHB · Pekan ${content.weekIndex}`,
      title: path.title,
      hideTitle: true,
      inlineTitle: { lead: dayLabel, title: path.title },
      subtitle: [content.chapterNo, path.bacaanRef].filter(Boolean).join(' · '),
      imageFileId: daily || content.images.cover,
      background: true,
      fields: [
        path.bacaanRef ? { label: 'Bacaan Alkitab', value: path.bacaanRef } : null,
        path.scriptureRef ? { label: 'Nats Pembimbing', value: path.scriptureRef } : null,
      ].filter(Boolean) as { label: string; value: string }[],
    },
  ];
  sections.forEach((s, i) => {
    const imgId = daily;
    const bg = Boolean(daily);
    const chunks = chunkSermonSection(s.body);
    if (!chunks.length) {
      // Standar anti slide-kosong: section kosong dilewati kecuali membawa
      // pertanyaan FGD / callout Firman.
      const bullets = s.key === 'DISKUSI_KELOMPOK' ? path.fgdQuestions || [] : undefined;
      const callout = i === 0 && path.scriptureText
        ? { label: path.scriptureRef || 'Nats', value: path.scriptureText }
        : undefined;
      if (!bullets?.length && !callout && !imgId) return;
      slides.push({
        id: `sec-${s.key}`,
        kind: 'section',
        // Identitas hari hanya di cover — slide isi cukup nama segmen kecil.
        title: s.title,
        smallTitle: true,
        imageFileId: imgId,
        background: bg,
        paragraphs: [],
        bullets,
        callout,
      });
      return;
    }
    // Section panjang di-chunk ≤6 baris/≤4 bullet per slide (budget khutbah).
    // Identitas hari hanya di cover — tiap lanjutan cukup nama segmen kecil.
    chunks.forEach((paragraphs, ci) => {
      slides.push({
        id: `sec-${s.key}${chunks.length > 1 ? `-${ci + 1}` : ''}`,
        kind: 'section',
        title: s.title,
        smallTitle: true,
        imageFileId: imgId,
        background: bg,
        paragraphs,
        callout: ci === 0 && i === 0 && path.scriptureText
          ? { label: path.scriptureRef || 'Nats', value: path.scriptureText }
          : undefined,
      });
    });
  });
  slides.push({
    id: 'closing',
    kind: 'closing',
    kicker: 'Besok',
    title: 'Jembatan ke hari berikutnya',
    imageFileId: daily,
    background: useBg,
    paragraphs: [path.bridge || 'Teruskan perjalanan RHB besok dengan hati yang terbuka.'],
  });
  return slides;
}

/** 4 bagian baku outline MD Service (urutan tetap) untuk deck khotbah literal. */
export const KHUTBAH_OUTLINE_SECTIONS = {
  pengantar: { no: '1', title: 'Pengantar', heading: 'Pengantar' },
  bedahTeologis: { no: '2', title: 'Bedah Teologis', heading: 'Bedah Teologis' },
  jembatan: { no: '3', title: 'Jembatan', heading: 'Jembatan ke Tema Mingguan' },
  kesimpulan: { no: '4', title: 'Kesimpulan', heading: 'Kesimpulan (Siap-Baca)' },
} as const;

export type KhutbahOutlineKey = keyof typeof KHUTBAH_OUTLINE_SECTIONS;

/** Budget layar POV presentasi: muat tanpa scroll (standar venue 5–7 baris/slide). */
export const KHUTBAH_CHUNK_MAX_LINES = 6;
export const KHUTBAH_CHUNK_MAX_BULLETS = 4;
/** Lebar acuan estimasi baris (±karakter per baris pada text-base/xl mobile). */
const KHUTBAH_LINE_WIDTH = 48;

const HEADING_RE = /^\s*#{2,4}\s+/;
const LIST_ITEM_RE = /^\s*([*\-]|\d+[.)])\s+/;
const QUOTE_RE = /^\s*>\s?/;

/** Unit adalah "sampah" (pemisah/divider) bila tak ada huruf tersisa setelah kupas markup. */
function isNoiseUnit(u: string): boolean {
  const t = stripMd(u).replace(/[─—–\-#>*\d.)\s]/g, '');
  return t.length === 0;
}

function estimateUnitLines(u: string): number {
  const t = stripMd(u).trim();
  if (!t) return 0;
  if (/^#{2,4}\s/.test(u)) return 2;
  return Math.max(1, Math.ceil(t.length / KHUTBAH_LINE_WIDTH));
}

function isBulletUnit(u: string): boolean {
  return /^\s*([*\-]|\d+[.)])\s+/.test(u);
}

/** Pecah unit raksasa (quote/prosa panjang) jadi potongan muat-layar — list & heading utuh. */
function splitOversizeUnit(u: string, maxLines: number): string[] {
  if (estimateUnitLines(u) <= maxLines) return [u];
  if (HEADING_RE.test(u) || isBulletUnit(u)) return [u];
  const pieces: string[] = [];
  const lines = u.split('\n').map((l) => l.trim()).filter(Boolean);
  const quote = lines.length > 0 && lines.every((l) => QUOTE_RE.test(l));
  for (const line of lines) {
    if (estimateUnitLines(line) <= maxLines) { pieces.push(line); continue; }
    const sents = line.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sents.length > 1 && sents.every((s) => estimateUnitLines((quote ? '> ' : '') + s) <= maxLines)) {
      for (const s of sents) pieces.push(quote && !QUOTE_RE.test(s) ? `> ${s}` : s);
    } else {
      pieces.push(line);
    }
  }
  return pieces.length ? pieces : [u];
}

/**
 * Pecah satu bagian outline (verbatim MD) menjadi N chunk muat-layar.
 * - Tidak memotong kalimat — batas hanya antar-unit (paragraf / baris bullet).
 * - Budget: ≤6 baris estimasi & ≤4 bullet per chunk.
 * - Chunk sampah (hanya `---`/kosong) dibuang — tak jadi slide kosong.
 */
export function chunkSermonSection(text?: string, maxLines = KHUTBAH_CHUNK_MAX_LINES, maxBullets = KHUTBAH_CHUNK_MAX_BULLETS): string[][] {
  // Segmentasi per baris: heading selalu unit sendiri; tiap item list unit sendiri
  // (boleh menempel ke heading); run quote/prosa berkelompok. Transisi = batas.
  const units: string[] = [];
  for (const para of toParagraphs(text)) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) { units.push(para); continue; }
    let buf: string[] = [];
    let mode: 'list' | 'quote' | 'other' | null = null;
    const flush = () => { if (buf.length) units.push(buf.join('\n')); buf = []; mode = null; };
    for (const l of lines) {
      if (HEADING_RE.test(l)) { flush(); units.push(l); continue; }
      const m = LIST_ITEM_RE.test(l) ? 'list' : QUOTE_RE.test(l) ? 'quote' : 'other';
      if (m === 'list') { flush(); units.push(l); continue; }
      if (mode !== null && m !== mode) flush();
      mode = m;
      buf.push(l);
    }
    flush();
  }
  const chunks: string[][] = [];
  let cur: string[] = [];
  let lines = 0;
  let bullets = 0;
  const push = () => {
    const kept = cur.filter((u) => !isNoiseUnit(u));
    if (kept.length) chunks.push(kept);
    cur = [];
    lines = 0;
    bullets = 0;
  };
  const sized: string[] = [];
  for (const u of units) sized.push(...splitOversizeUnit(u, maxLines));
  for (const u of sized) {
    const ul = estimateUnitLines(u);
    const ub = isBulletUnit(u) ? 1 : 0;
    if (cur.length > 0 && (lines + ul > maxLines || bullets + ub > maxBullets)) push();
    cur.push(u);
    lines += ul;
    bullets += ub;
  }
  if (cur.length) push();
  // Heading tak boleh menggantung di akhir chunk — pindahkan ke chunk berikut.
  for (let i = 0; i < chunks.length - 1; i++) {
    const c = chunks[i];
    const trailing: string[] = [];
    while (c.length > 1 && HEADING_RE.test(c[c.length - 1])) trailing.unshift(c.pop() as string);
    if (trailing.length) chunks[i + 1].unshift(...trailing);
  }
  // Chunk berisi heading saja (tanpa isi) digabung ke chunk berikut/terdahulu.
  let hi = 0;
  while (hi < chunks.length) {
    const c = chunks[hi];
    if (c.length > 0 && c.every((u) => HEADING_RE.test(u))) {
      const moved = c.splice(0, c.length);
      if (hi + 1 < chunks.length) chunks[hi + 1].unshift(...moved);
      else if (hi > 0) chunks[hi - 1].push(...moved);
    }
    hi++;
  }
  return chunks.filter((c) => c.some((u) => !isNoiseUnit(u)));
}

/**
 * Slide literal khotbah (deck khutbah 02):
 * 4 bagian outline MD verbatim, di-chunk rapi, 1 gambar background per bagian.
 * Modul Pembekalan 01 SENGAJA tidak memakai ini — ia hanya memuat garis besar
 * 4 komponen + CTA ke doc 02 (lihat extractGarisBesar).
 */
export function literalKhutbahSlides(
  content: PresentationContent,
  kickerPrefix: string,
  idPrefix: string,
  firstSlideBullets?: string[],
  opts?: { bareTitle?: boolean; maxLines?: number; maxBullets?: number },
): DeckSlide[] {
  const { sermon, images } = content;
  const outline = sermon.outline || { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' };
  const literal = images.khutbahLiteral && typeof images.khutbahLiteral === 'object' ? images.khutbahLiteral : {};
  const slides: DeckSlide[] = [];
  let first = true;
  (Object.keys(KHUTBAH_OUTLINE_SECTIONS) as KhutbahOutlineKey[]).forEach((key) => {
    const meta = KHUTBAH_OUTLINE_SECTIONS[key];
    const chunks = chunkSermonSection(outline[key], opts?.maxLines ?? KHUTBAH_CHUNK_MAX_LINES, opts?.maxBullets ?? KHUTBAH_CHUNK_MAX_BULLETS);
    const imgId = literal[key] || images.cover;
    chunks.forEach((paragraphs, ci) => {
      const numbered = chunks.length > 1;
      slides.push({
        id: `${idPrefix}-${key}${numbered ? `-${ci + 1}` : ''}`,
        kind: 'section',
        kicker: `${kickerPrefix} · ${meta.no} ${meta.title}${numbered ? ` · ${ci + 1}/${chunks.length}` : ''}`,
        title: opts?.bareTitle ? undefined : (numbered ? `${meta.heading} (${ci + 1}/${chunks.length})` : meta.heading),
        imageFileId: imgId,
        background: Boolean(imgId),
        bullets: first && firstSlideBullets?.length ? firstSlideBullets : undefined,
        paragraphs,
      });
      first = false;
    });
  });
  return slides;
}

export function buildKhutbahDeck(content: PresentationContent): DeckSlide[] {
  // Standar literal-MD: 4 bagian outline MD Service verbatim, di-chunk rapi.
  const { sermon, images } = content;
  const slides: DeckSlide[] = [
    {
      id: 'cover',
      kind: 'cover',
      kicker: `Ringkasan Khotbah · Pekan ${content.weekIndex}`,
      title: content.theme || `Pekan ${content.weekIndex}`,
      subtitle: weekCoverSubtitle(content),
      imageFileId: images.cover,
      background: true,
      fields: [
        sermon.teksUtama?.ref ? { label: 'Teks Utama Khotbah', value: sermon.teksUtama.ref } : null,
        content.fundamentalFirman?.ref ? { label: 'Teks Jangkar Mingguan', value: content.fundamentalFirman.ref } : null,
      ].filter(Boolean) as { label: string; value: string }[],
    },
    ...literalKhutbahSlides(content, 'Outline', 'outline', undefined, { bareTitle: true, maxLines: 9, maxBullets: 5 }),
  ];
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

export { lastPortalPlace, rememberPortalPlace } from './portal-place';
