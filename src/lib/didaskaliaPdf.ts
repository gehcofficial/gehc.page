/**
 * Didaskalia Studio — generator PDF (brand GEHC) untuk 3 dokumen:
 *  - Modul Pembekalan Mentor/Co-Mentor (01)
 *  - Ringkasan Khotbah + kerangka slide (02)
 *  - RHB 7 Path harian (03) — 7 file terpisah
 *
 * Memakai jsPDF langsung (bukan html2canvas) agar deterministik & tanpa render
 * DOM tersembunyi. Gambar opsional (data URL) untuk mempercantik halaman.
 */
import { jsPDF } from 'jspdf';
import { DAY_LABELS, defaultSermon, type DidaskaliaStudio, type DidaskaliaWeek } from './didaskalia';
import { effectiveRhbSections, extractGarisBesar, mentorOpsBullets, patternTechnicalBullets, penutupDayFields } from './didaskalia-presentation';
import { parseMdLite, stripMd } from './md-lite';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;
const CONTENT_W = PAGE_W - M * 2;

const C = {
  bg: [250, 249, 245] as const,
  ink: [27, 27, 27] as const,
  muted: [140, 136, 128] as const,
  line: [217, 215, 208] as const,
  accent: [14, 165, 233] as const,
  accentSoft: [224, 242, 254] as const,
  pink: [255, 65, 108] as const,
  orange: [255, 75, 43] as const,
  panel: [240, 239, 235] as const,
};

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setText(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

class Writer {
  doc: jsPDF;
  y: number;
  footerLabel: string;
  /** Mode gelap (teks terang di atas gambar full-bleed) — ala slide khotbah. */
  dark = false;
  /** Gambar full-bleed yang dilukis ulang tiap ganti halaman (1 gambar per hari RHB). */
  bgEachPage?: string;

  constructor(footerLabel: string) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.footerLabel = footerLabel;
    this.y = M;
    this.paintBg();
  }

  paintBg() {
    setFill(this.doc, C.bg);
    this.doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  }

  /** Lukis gambar full-bleed + scrim gelap; teks berikutnya memakai warna terang. */
  darkPage(dataUrl?: string) {
    if (!dataUrl) {
      this.dark = false;
      return;
    }
    try {
      this.doc.addImage(dataUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
      this.doc.setGState(new (this.doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.6 }));
      setFill(this.doc, [0, 0, 0]);
      this.doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      this.doc.setGState(new (this.doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }));
      this.dark = true;
    } catch {
      this.dark = false;
    }
  }

  newPage() {
    this.doc.addPage();
    this.y = M;
    if (this.bgEachPage) this.darkPage(this.bgEachPage);
    else {
      this.paintBg();
      this.dark = false;
    }
  }

  /** Tinta teks isi: putih di mode gelap, ink di mode terang. */
  private ink(): readonly [number, number, number] {
    return this.dark ? [255, 255, 255] : C.ink;
  }

  /** Tinta redup: abu terang di mode gelap, muted di mode terang. */
  private muted(): readonly [number, number, number] {
    return this.dark ? [203, 203, 203] : C.muted;
  }

  ensure(h: number) {
    if (this.y + h > PAGE_H - 20) this.newPage();
  }

  gradientBar(y = 0, h = 8) {
    const half = PAGE_W / 2;
    setFill(this.doc, C.pink);
    this.doc.rect(0, y, half, h, 'F');
    setFill(this.doc, C.orange);
    this.doc.rect(half, y, half, h, 'F');
  }

  label(text: string, color: readonly [number, number, number] = C.accent) {
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    setText(this.doc, color);
    this.doc.text(String(text || '').toUpperCase(), M, this.y + 2.7, { charSpace: 0.6 });
    this.y += 6;
  }

  title(text: string, size = 24) {
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(size);
    setText(this.doc, this.ink());
    const lines = this.doc.splitTextToSize(String(text || ''), CONTENT_W);
    this.ensure(lines.length * (size * 0.42) + 4);
    this.doc.text(lines, M, this.y + size * 0.32);
    this.y += lines.length * (size * 0.42) + 3;
  }

  subtitle(text: string) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    setText(this.doc, this.muted());
    const lines = this.doc.splitTextToSize(String(text || ''), CONTENT_W);
    this.ensure(lines.length * 5 + 3);
    this.doc.text(lines, M, this.y + 3.3);
    this.y += lines.length * 5 + 3;
  }

  divider(space = 6) {
    this.ensure(space + 2);
    setDraw(this.doc, C.line);
    this.doc.setLineWidth(0.3);
    this.doc.line(M, this.y, PAGE_W - M, this.y);
    this.y += space;
  }

  paragraph(text: string, size = 10.5, lineH = 5.4) {
    if (!text) return;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    setText(this.doc, this.ink());
    for (const para of String(text).split(/\n+/)) {
      const lines = this.doc.splitTextToSize(para.trim(), CONTENT_W);
      this.ensure(lines.length * lineH + 2);
      this.doc.text(lines, M, this.y + size * 0.3);
      this.y += lines.length * lineH + 1.5;
    }
  }

  /** Paragraf dengan segmen **tebal** (diukur per kata agar wrap tepat). */
  richParagraph(text: string, size = 10.5, lineH = 5.4) {
    const clean = String(text || '').replace(/`([^`]+)`/g, '$1');
    if (!clean.trim()) return;
    if (!/\*\*/.test(clean)) { this.paragraph(stripMd(clean), size, lineH); return; }
    type Run = { t: string; bold: boolean };
    const runs: Run[] = [];
    for (const part of clean.split(/(\*\*[^*\n]+\*\*)/g)) {
      if (!part) continue;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) runs.push({ t: part.slice(2, -2), bold: true });
      else runs.push({ t: part, bold: false });
    }
    const words: Run[] = [];
    for (const r of runs) {
      const plain = r.bold ? r.t : stripMd(r.t);
      for (const w of plain.split(/\s+/).filter(Boolean)) words.push({ t: w, bold: r.bold });
    }
    if (!words.length) return;
    this.doc.setFontSize(size);
    setText(this.doc, this.ink());
    const spaceW = this.doc.getTextWidth(' ');
    let x = M;
    let lineWords = 0;
    const newLine = () => { this.y += lineH; x = M; lineWords = 0; };
    this.ensure(lineH + 2);
    const baseline = () => this.y + size * 0.3;
    for (const w of words) {
      this.doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
      const ww = this.doc.getTextWidth(w.t);
      if (lineWords > 0 && x + ww > M + CONTENT_W) { newLine(); this.ensure(lineH + 2); }
      this.doc.text(w.t, x, baseline());
      x += ww + spaceW;
      lineWords += 1;
    }
    this.y += lineH + 1.5;
  }

  field(label: string, value: string, size = 10.5) {
    if (!value) return;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    setText(this.doc, C.accent);
    this.ensure(6);
    this.doc.text(String(label || '').toUpperCase(), M, this.y + 2.5, { charSpace: 0.4 });
    this.y += 4.5;
    this.paragraph(value, size);
    this.y += 1.5;
  }

  callout(title: string, body: string, tone: 'accent' | 'amber' = 'accent') {
    if (!title && !body) return;
    const bg = tone === 'amber' ? ([255, 251, 235] as const) : C.accentSoft;
    const line = tone === 'amber' ? ([217, 119, 6] as const) : C.accent;
    const titleInk = tone === 'amber' ? ([146, 64, 14] as const) : C.accent;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    const titleLines = title ? this.doc.splitTextToSize(title, CONTENT_W - 10) : [];
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    const bodyLines = body ? this.doc.splitTextToSize(body, CONTENT_W - 10) : [];
    const h = 8 + titleLines.length * 4.6 + bodyLines.length * 5 + 4;
    this.ensure(h + 4);
    setFill(this.doc, bg);
    setDraw(this.doc, line);
    this.doc.setLineWidth(0.4);
    this.doc.roundedRect(M, this.y, CONTENT_W, h, 2.5, 2.5, 'FD');
    let ty = this.y + 6;
    if (title) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      setText(this.doc, titleInk);
      this.doc.text(titleLines, M + 5, ty);
      ty += titleLines.length * 4.6;
    }
    if (body) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      setText(this.doc, C.ink);
      this.doc.text(bodyLines, M + 5, ty + 1.5);
    }
    this.y += h + 4;
  }

  /** Bullet list; `bullet='ordered'` menomori item, level>0 menjorok + tanda strip. */
  bullets(items: (string | { text: string; level: number })[], bullet: string | 'ordered' = '•') {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    setText(this.doc, this.ink());
    items.forEach((raw, idx) => {
      const it = typeof raw === 'string' ? raw : raw.text;
      const level = typeof raw === 'string' ? 0 : Math.min(2, raw.level || 0);
      const mark = bullet === 'ordered' ? `${idx + 1}.` : level > 0 ? '–' : bullet;
      const indent = level * 6;
      const lines = this.doc.splitTextToSize(stripMd(String(it || '')), CONTENT_W - 6 - indent);
      this.ensure(lines.length * 5 + 2);
      this.doc.text(mark, M + indent, this.y + 3);
      this.doc.text(lines, M + 4 + indent, this.y + 3);
      this.y += lines.length * 5 + 1.2;
    });
  }

  /** Render teks MD verbatim menjadi blok baca (paritas web): peran → label/callout/bold. */
  mdBlocks(text: string, opts?: { speech?: boolean; size?: number }) {
    const size = opts?.size || 10.5;
    for (const b of parseMdLite(text, { speech: opts?.speech })) {
      if (b.kind === 'divider') { this.divider(4); continue; }
      if (b.kind === 'heading') { this.label(stripMd(b.text)); continue; }
      if (b.kind === 'quote') {
        const ref = b.ref ? stripMd(b.ref) : undefined;
        this.callout(ref ? `Firman — ${ref}` : 'Firman', stripMd(b.text).replace(/^["“”'\s]+|["“”'\s]+$/g, ''));
        continue;
      }
      if (b.kind === 'list') { this.bullets(b.items, b.ordered ? 'ordered' : '•'); continue; }
      if (b.kind === 'table') { this.mdTable(b.headers, b.rows); continue; }
      if (b.role === 'takeaway' || b.role === 'reflection') { this.callout(b.role === 'reflection' ? 'Refleksi' : 'Poin Utama', stripMd(b.text), 'amber'); continue; }
      if (b.role === 'correction') { this.callout('Luruskan', stripMd(b.text), 'amber'); continue; }
      if (b.role === 'speech') { this.richParagraph(b.text, size + 1, 6); continue; }
      this.richParagraph(b.text, size, 5.4);
    }
  }

  /** Tabel MD → baris bernomor + sel dipisah · (paritas baca tanpa grid). */
  mdTable(headers: string[], rows: string[][]) {
    if (headers.length) this.label(`Tabel — ${headers.map((h) => stripMd(h)).join(' · ')}`);
    rows.forEach((r, i) => {
      const line = r.map((c) => stripMd(c)).join(' · ');
      if (line) this.bullets([`${i + 1}. ${line}`], '•');
    });
  }

  image(dataUrl: string | undefined, h = 45) {
    if (!dataUrl) return;
    try {
      setDraw(this.doc, C.line);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(M, this.y, CONTENT_W, h, 3, 3, 'S');
      this.doc.addImage(dataUrl, 'JPEG', M, this.y, CONTENT_W, h, undefined, 'FAST');
      this.y += h + 4;
    } catch {
      /* gambar gagal dimuat — lewati */
    }
  }

  numbered(n: number, title: string) {
    this.ensure(12);
    setFill(this.doc, C.accent);
    this.doc.circle(M + 4, this.y - 1.2, 4, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(String(n), M + 4, this.y + 0.2, { align: 'center' });
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(16);
    setText(this.doc, this.ink());
    const lines = this.doc.splitTextToSize(String(title || ''), CONTENT_W - 12);
    this.doc.text(lines, M + 11, this.y + 3);
    this.y += lines.length * 6.5 + 3;
  }

  finishFooters() {
    const total = this.doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p);
      setDraw(this.doc, C.line);
      this.doc.setLineWidth(0.3);
      this.doc.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      setText(this.doc, this.muted());
      this.doc.text(this.footerLabel, M, PAGE_H - 9);
      this.doc.text(`${p} / ${total}`, PAGE_W - M, PAGE_H - 9, { align: 'right' });
    }
  }

  blob(): Blob {
    return this.doc.output('blob');
  }
}

export type PdfOptions = {
  monthLabel?: string;
  version?: number;
  coverImage?: string;
  /** Ilustrasi AI per bagian khotbah literal: { pengantar|bedahTeologis|jembatan|kesimpulan: dataUrl } */
  khutbahSectionImages?: Record<string, string>;
  /** Ilustrasi harian RHB (AI per hari → upload hero → cover pekan): { [pathIndex]: dataUrl } */
  rhbDayImages?: Record<number, string>;
  /** Jenis ibadah (MENTORING_DAY/SERVING_DAY) — untuk label deliverer. */
  serviceType?: string | null;
  /** Pola ibadah pekan ini — untuk judul Bagian B. */
  patternCode?: string | null;
  patternName?: string | null;
};

function weekMeta(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions) {
  const theme = week.mentoringTheme || week.servingTheme || week.theme || '';
  const chapter = studio.chapterNo || '';
  const dateLabel = week.date
    ? new Date(`${week.date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';
  const monthLabel = opts.monthLabel || '';
  return { theme, chapter, dateLabel, monthLabel };
}

function cover(w: Writer, week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions, docLabel: string) {
  const m = weekMeta(week, studio, opts);
  const bg = opts.coverImage;

  // Mode background: gambar full-bleed + scrim gelap + teks overlay.
  if (bg) {
    try {
      w.doc.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
      w.doc.setGState(new (w.doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.64 }));
      setFill(w.doc, [0, 0, 0]);
      w.doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      w.doc.setGState(new (w.doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }));
    } catch {
      /* gambar gagal — lanjut dengan teks */
    }
    const WHITE: readonly [number, number, number] = [255, 255, 255];
    w.y = 40;
    w.doc.setFont('helvetica', 'bold');
    w.doc.setFontSize(9);
    setText(w.doc, WHITE);
    w.doc.text(`${m.chapter ? `${m.chapter} · ` : ''}${docLabel}`.toUpperCase(), M, w.y, { charSpace: 0.6 });
    w.y += 8;
    w.doc.setFont('times', 'bold');
    w.doc.setFontSize(30);
    setText(w.doc, WHITE);
    const titleLines = w.doc.splitTextToSize(m.theme || studio.chapterNo || 'Didaskalia', CONTENT_W);
    w.doc.text(titleLines, M, w.y + 30 * 0.32);
    w.y += titleLines.length * (30 * 0.42) + 4;
    w.doc.setFont('helvetica', 'normal');
    w.doc.setFontSize(11);
    setText(w.doc, WHITE);
    const sub = [m.monthLabel, m.dateLabel, `Minggu ke-${week.index}`].filter(Boolean).join(' · ');
    w.doc.text(sub, M, w.y + 3.3);
    w.y += 10;
    if (studio.fundamentalFirman?.ref) {
      w.doc.setFont('helvetica', 'bold');
      w.doc.setFontSize(9);
      setText(w.doc, WHITE);
      w.doc.text(`FUNDAMENTAL FIRMAN — ${studio.fundamentalFirman.ref}`.toUpperCase(), M, w.y + 2.5, { charSpace: 0.4 });
      w.y += 6;
    }
    if (studio.kitabFokus) {
      w.doc.setFont('helvetica', 'normal');
      w.doc.setFontSize(10);
      setText(w.doc, WHITE);
      w.doc.text(`Kitab / Bagian Fokus: ${studio.kitabFokus}`, M, w.y + 3);
    }
    // Footer putih
    w.doc.setFont('helvetica', 'bold');
    w.doc.setFontSize(10);
    setText(w.doc, WHITE);
    w.doc.text('GEHC YOUTH · BEYONDERS', M, PAGE_H - 34);
    w.doc.setFont('helvetica', 'normal');
    w.doc.setFontSize(9);
    setText(w.doc, WHITE);
    w.doc.text('Divisi Didaskalia — GMIM Eben Haezer Cikarang', M, PAGE_H - 28);
    return;
  }

  w.gradientBar(0, 12);
  w.y = 30;
  w.label(`${m.chapter ? `${m.chapter} · ` : ''}${docLabel}`, C.accent);
  w.title(m.theme || studio.chapterNo || 'Didaskalia', 28);
  w.subtitle([m.monthLabel, m.dateLabel, `Minggu ke-${week.index}`].filter(Boolean).join(' · '));
  w.divider(8);
  w.callout(
    studio.fundamentalFirman?.ref ? `Fundamental Firman — ${studio.fundamentalFirman.ref}` : 'Fundamental Firman',
    studio.fundamentalFirman?.text || ''
  );
  if (studio.kitabFokus) w.field('Kitab / Bagian Fokus', studio.kitabFokus);
  if (studio.homileticMethods?.length) w.field('Metode Khotbah', studio.homileticMethods.join(' · '));
  w.y = PAGE_H - 40;
  w.doc.setFont('helvetica', 'bold');
  w.doc.setFontSize(10);
  setText(w.doc, C.accent);
  w.doc.text('GEHC YOUTH · BEYONDERS', M, w.y);
  w.doc.setFont('helvetica', 'normal');
  w.doc.setFontSize(9);
  setText(w.doc, C.muted);
  w.doc.text('Divisi Didaskalia — GMIM Eben Haezer Cikarang', M, w.y + 5);
}

/** Label deliverer berdasarkan jenis ibadah. */
export function delivererLabel(serviceType?: string | null): string {
  const t = String(serviceType || '').toUpperCase();
  if (t.includes('MENTORING')) return 'Perwakilan Tim Didaskalia';
  if (t.includes('SERVING')) return 'Perwakilan yang akan Berkhotbah';
  return 'Pengkhotbah / Deliverer';
}

function buildCommon(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions, label: string) {
  const w = new Writer(`Didaskalia · ${label} · Minggu ke-${week.index}${week.date ? ` · ${week.date}` : ''}`);
  return w;
}

/**
 * Modul Pembekalan (01) — 2 fokus:
 *   A. Untuk deliverer ibadah: garis besar 4 komponen (ekstrak verbatim) +
 *      panduan deliver & checklist. Detail penuh ada di Ringkasan Khotbah (02).
 *   B. Untuk mentor & co-mentor: alur pola-aware + gambaran 7 hari (ringkas).
 */
export function buildPembekalanPdf(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions = {}): { filename: string; blob: Blob } {
  const w = buildCommon(week, studio, opts, 'Modul Pembekalan');
  const sermon = studio.sermon || defaultSermon();
  cover(w, week, studio, opts, 'Modul Pembekalan Mentor & Co-Mentor');

  // Inti Pesan & Fundamental Firman
  w.newPage();
  w.y = 22;
  w.label('Inti Pesan & Fundamental Firman', C.accent);
  w.title('Big Idea & Arah Tema', 20);
  w.callout(
    studio.fundamentalFirman?.ref ? `Fundamental Firman — ${studio.fundamentalFirman.ref}` : 'Fundamental Firman',
    studio.fundamentalFirman?.text || ''
  );
  if (studio.kitabFokus) w.field('Kitab / Bagian Fokus', studio.kitabFokus);
  if (sermon.teksUtama?.ref) w.field('Teks Utama Khotbah', sermon.teksUtama.text ? `${sermon.teksUtama.ref}\n${sermon.teksUtama.text}` : sermon.teksUtama.ref);
  if (studio.methodMix?.length) {
    w.field('Analisa Metode (%)', studio.methodMix.map((m) => `${m.method} — ${m.percent}%${m.note ? ` (${m.note})` : ''}`).join('\n'));
  }

  // BAGIAN A — garis besar 4 komponen (BUKAN salinan literal penuh) + panduan deliver.
  w.newPage();
  w.y = 22;
  w.label(`Bagian A · Untuk ${delivererLabel(opts.serviceType)}`, C.accent);
  w.title('Garis Besar Khotbah (4 Komponen)', 20);
  const garis = extractGarisBesar(sermon.outline);
  garis.forEach((g, i) => {
    w.numbered(i + 1, g.title);
    w.richParagraph(g.sentence);
  });
  const ym = String(week.date || '').slice(0, 7);
  w.callout(
    'Detail Penuh — Ringkasan Khotbah (02)',
    /^\d{4}-\d{2}$/.test(ym)
      ? `Uraian tiap komponen ada di dokumen Ringkasan Khotbah pekan ini:\n#/materi/khutbah/${ym}/${week.index}`
      : 'Uraian tiap komponen ada di dokumen Ringkasan Khotbah (doc 02) pekan ini.'
  );
  const plan = sermon.deliveryPlan || [];
  if (plan.length) w.field('Panduan Deliver per Metode', plan.map((d) => `${d.method}: ${d.how}`).join('\n'));
  const checklist = sermon.prepChecklist || [];
  if (checklist.length) w.field('Checklist Persiapan Khotbah', checklist.map((x, i) => `${i + 1}) ${x}`).join('\n'));

  // BAGIAN B — untuk mentor & co-mentor (pola-aware + tugas operasional).
  w.newPage();
  w.y = 22;
  w.label('Bagian B · Untuk Mentor & Co-Mentor', C.accent);
  const isFgd = !opts.patternCode || String(opts.patternCode).toUpperCase() === 'MONOLOG';
  w.title(isFgd ? 'Alur FGD Hari Minggu' : `Alur ${opts.patternName || 'Ibadah'} Hari Minggu`, 20);
  const flow = sermon.discussionFlow || [];
  const tech = patternTechnicalBullets(opts.patternCode, opts.patternName);
  const ops = mentorOpsBullets();
  if (isFgd) {
    if (flow.length) w.field('Pertanyaan FGD (jawab 1–2 perwakilan bergiliran)', flow.map((q, i) => `Q${i + 1}. ${q}`).join('\n'));
    else {
      w.paragraph(
        'Buka dengan pertanyaan pemanasan yang dekat dengan tema, gali teks bersama, lalu tutup dengan penerapan nyata dan doa.'
      );
    }
    w.bullets([...tech, ...ops]);
  } else {
    const steps = flow.length
      ? flow
      : [`Ikuti skenario pola ${opts.patternName || 'ibadah pekan ini'} di atas, sesuaikan dengan tema dan audiens minggu ini, lalu tutup dengan komitmen dan doa.`];
    w.bullets([...tech, ...steps, ...ops]);
  }
  const pathLines = penutupDayFields(studio.paths).map((d) => `${d.label} — ${d.value}`);
  if (pathLines.length) w.field('Gambaran 7 Hari (Minggu–Sabtu)', pathLines.join('\n'));
  const rhbYm = String(week.date || '').slice(0, 7);
  w.callout(
    'Lanjut — RHB 7 Hari (03)',
    /^\d{4}-\d{2}$/.test(rhbYm)
      ? `Renungan harian Senin–Sabtu ada di dokumen RHB pekan ini:\n#/materi/rhb/${rhbYm}/${week.index}`
      : 'Renungan harian Senin–Sabtu ada di dokumen RHB 7 Hari (doc 03) pekan ini.'
  );

  w.finishFooters();
  const v = opts.version || 1;
  return { filename: `W${week.index}-MODUL-${week.date || ''}-v${v}.pdf`, blob: w.blob() };
}

export function buildKhutbahPdf(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions = {}): { filename: string; blob: Blob } {
  // Standar literal-MD: 4 bagian outline MD Service verbatim (bukan summary AI).
  const w = buildCommon(week, studio, opts, 'Ringkasan Khotbah');
  cover(w, week, studio, opts, 'Ringkasan Khotbah');
  const outline = studio.sermon?.outline || { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' };
  const sections = [
    { key: 'pengantar', no: '1', title: 'Pengantar', heading: 'Pengantar' },
    { key: 'bedahTeologis', no: '2', title: 'Bedah Teologis', heading: 'Bedah Teologis' },
    { key: 'jembatan', no: '3', title: 'Jembatan', heading: 'Jembatan ke Tema Mingguan' },
    { key: 'kesimpulan', no: '4', title: 'Kesimpulan', heading: 'Kesimpulan (Siap-Baca)' },
  ] as const;
  if (studio.sermon?.teksUtama?.ref) {
    w.newPage();
    w.y = 22;
    w.label('Teks Utama Khotbah', C.accent);
    w.title(studio.sermon.teksUtama.ref, 20);
    if (studio.sermon.teksUtama.text) w.paragraph(studio.sermon.teksUtama.text);
  }
  for (const s of sections) {
    const body = String(outline[s.key] || '').trim();
    if (!body) continue;
    w.newPage();
    w.y = 22;
    w.label(`Outline · ${s.no} ${s.title}`, C.accent);
    w.title(s.heading, 20);
    w.image(opts.khutbahSectionImages?.[s.key], 40);
    w.mdBlocks(body, { speech: s.key === 'kesimpulan' });
  }
  w.finishFooters();
  const v = opts.version || 1;
  return { filename: `W${week.index}-KHUTBAH-${week.date || ''}-v${v}.pdf`, blob: w.blob() };
}

export function buildRhbPdfs(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions = {}): Array<{ filename: string; blob: Blob; pathIndex: number }> {
  const out: Array<{ filename: string; blob: Blob; pathIndex: number }> = [];
  const v = opts.version || 1;
  for (const p of studio.paths.slice(0, 7)) {
    const w = buildCommon(week, studio, opts, `RHB Path ${p.pathIndex}`);
    // Standar khutbah: 1 gambar harian full-bleed di SEMUA halaman + teks terang.
    // Tanpa gambar → fallback terang (hemat tinta).
    const bg = opts.rhbDayImages?.[p.pathIndex];
    if (bg) {
      w.bgEachPage = bg;
      w.darkPage(bg);
    } else {
      w.gradientBar(0, 10);
    }
    w.y = 26;
    w.label(`RHB · Week ${week.index} · ${p.dayLabel}`, C.accent);
    w.title(p.title, 24);
    w.subtitle([studio.chapterNo, studio.fundamentalFirman?.ref].filter(Boolean).join(' · '));
    w.divider(7);
    if (p.bacaanRef) w.field('Bacaan Alkitab', p.bacaanRef, 10);
    if (p.scriptureRef) w.field('Nats Pembimbing', p.scriptureRef, 10);
    if (p.scriptureText) w.callout(p.scriptureRef || 'Nats Pembimbing', p.scriptureText);

    for (const s of effectiveRhbSections(p)) {
      if (s.body) w.field(s.title, s.body);
    }

    if (p.bridge) w.callout('Besok', p.bridge);
    w.finishFooters();
    out.push({ filename: `W${week.index}-D${p.pathIndex}-${p.dayLabel}-${week.date || ''}-v${v}.pdf`, blob: w.blob(), pathIndex: p.pathIndex });
  }
  return out;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
