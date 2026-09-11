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
import type { DidaskaliaPath, DidaskaliaStudio, DidaskaliaWeek } from './didaskalia';

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

  newPage() {
    this.doc.addPage();
    this.paintBg();
    this.y = M;
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
    this.doc.text(String(text || '').toUpperCase(), M, this.y, { charSpace: 0.6 });
    this.y += 5;
  }

  title(text: string, size = 24) {
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(size);
    setText(this.doc, C.ink);
    const lines = this.doc.splitTextToSize(String(text || ''), CONTENT_W);
    this.ensure(lines.length * (size * 0.42) + 4);
    this.doc.text(lines, M, this.y);
    this.y += lines.length * (size * 0.42) + 3;
  }

  subtitle(text: string) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    setText(this.doc, C.muted);
    const lines = this.doc.splitTextToSize(String(text || ''), CONTENT_W);
    this.ensure(lines.length * 5 + 3);
    this.doc.text(lines, M, this.y);
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
    setText(this.doc, C.ink);
    for (const para of String(text).split(/\n+/)) {
      const lines = this.doc.splitTextToSize(para.trim(), CONTENT_W);
      this.ensure(lines.length * lineH + 2);
      this.doc.text(lines, M, this.y);
      this.y += lines.length * lineH + 1.5;
    }
  }

  field(label: string, value: string, size = 10.5) {
    if (!value) return;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    setText(this.doc, C.accent);
    this.ensure(6);
    this.doc.text(String(label || '').toUpperCase(), M, this.y, { charSpace: 0.4 });
    this.y += 4.5;
    this.paragraph(value, size);
    this.y += 1.5;
  }

  callout(title: string, body: string) {
    if (!title && !body) return;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    const titleLines = title ? this.doc.splitTextToSize(title, CONTENT_W - 10) : [];
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    const bodyLines = body ? this.doc.splitTextToSize(body, CONTENT_W - 10) : [];
    const h = 8 + titleLines.length * 4.6 + bodyLines.length * 5 + 4;
    this.ensure(h + 4);
    setFill(this.doc, C.accentSoft);
    setDraw(this.doc, C.accent);
    this.doc.setLineWidth(0.4);
    this.doc.roundedRect(M, this.y, CONTENT_W, h, 2.5, 2.5, 'FD');
    let ty = this.y + 6;
    if (title) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      setText(this.doc, C.accent);
      this.doc.text(titleLines, M + 5, ty);
      ty += titleLines.length * 4.6;
    }
    if (body) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      setText(this.doc, C.ink);
      this.doc.text(bodyLines, M + 5, ty);
    }
    this.y += h + 4;
  }

  bullets(items: string[], bullet = '•') {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    setText(this.doc, C.ink);
    for (const it of items) {
      const lines = this.doc.splitTextToSize(String(it || ''), CONTENT_W - 6);
      this.ensure(lines.length * 5 + 2);
      this.doc.text(bullet, M, this.y);
      this.doc.text(lines, M + 4, this.y);
      this.y += lines.length * 5 + 1.2;
    }
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
    setText(this.doc, C.ink);
    const lines = this.doc.splitTextToSize(String(title || ''), CONTENT_W - 12);
    this.doc.text(lines, M + 11, this.y + 1);
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
      setText(this.doc, C.muted);
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
  pathImages?: Record<number, string>;
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
  if (opts.coverImage) {
    w.y = Math.min(w.y + 4, PAGE_H - 90);
    w.image(opts.coverImage, 60);
  }
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

function pathPage(w: Writer, path: DidaskaliaPath, opts: PdfOptions, mode: 'modul' | 'rhb') {
  w.newPage();
  w.gradientBar(0, 1.5);
  w.y = 20;
  w.label(`Path ${path.pathIndex} · ${path.dayLabel}`, C.accent);
  w.title(path.title, 20);
  if (path.scriptureRef) w.field('Ayat', path.scriptureRef, 10);
  if (path.homileticLens.length) w.field('Lensa', path.homileticLens.join(' · '), 9.5);
  w.image(opts.pathImages?.[path.pathIndex], 42);
  if (path.scriptureText) w.callout('Nats', path.scriptureText);
  if (mode === 'modul') {
    w.field('Pertanyaan Pembuka', path.hookQuestion);
    w.field('Ilustrasi', path.illustration);
  }
  w.field('Perenungan', path.reflection);
  if (mode === 'modul') {
    w.field('Pertanyaan Diskusi', [path.observeQ, path.interpretQ, path.applyQ].filter(Boolean).join('\n'));
    if (path.fgdQuestions?.length) {
      w.doc.setFont('helvetica', 'bold');
      w.doc.setFontSize(8.5);
      setText(w.doc, C.accent);
      w.doc.text('PERTANYAAN FGD', M, w.y);
      w.y += 4.5;
      w.bullets(path.fgdQuestions);
    }
  } else if (path.fgdQuestions?.length) {
    w.field('Renungkan & Diskusikan', path.fgdQuestions.join('\n'));
  }
  if (path.bridge) w.callout('Jembatan ke Path Berikutnya', path.bridge);
}

function buildCommon(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions, label: string) {
  const w = new Writer(`Didaskalia · ${label} · Minggu ke-${week.index}${week.date ? ` · ${week.date}` : ''}`);
  return w;
}

export function buildPembekalanPdf(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions = {}): { filename: string; blob: Blob } {
  const w = buildCommon(week, studio, opts, 'Modul Pembekalan');
  cover(w, week, studio, opts, 'Modul Pembekalan Mentor & Co-Mentor');
  w.newPage();
  w.y = 22;
  w.label('Panduan Pembekalan', C.accent);
  w.title('Cara Mendampingi Diskusi', 20);
  w.paragraph(
    'Modul ini memandu mentor dan co-mentor membimbing diskusi grup/sate: membuka dengan pertanyaan mudah, ' +
      'menggunakan ilustrasi yang dekat dengan dunia anak muda, lalu menuntun diskusi bertingkat dari pengamatan teks ' +
      'sampai penerapan praktis. Jangan menggurui — ajak peserta menemukan sendiri.'
  );
  w.callout('Alur Diskusi (30–45 menit)', '1) Hook · 2) Ilustrasi · 3) Amati teks (observe) · 4) Pahami makna (interpret) · 5) Terapkan (apply) · 6) Jembatan ke path berikutnya.');
  for (const p of studio.paths) pathPage(w, p, opts, 'modul');
  w.newPage();
  w.y = 24;
  w.label('Penutup', C.accent);
  w.title('Sintesis & Doa', 20);
  w.paragraph(
    studio.sermon?.summary ||
      'Rangkum perjalanan 7 Path minggu ini, lalu tutup dengan doa syafaat untuk tiap anggota kelompok.'
  );
  w.finishFooters();
  const v = opts.version || 1;
  return { filename: `W${week.index}-MODUL-${week.date || ''}-v${v}.pdf`, blob: w.blob() };
}

export function buildKhutbahPdf(week: DidaskaliaWeek, studio: DidaskaliaStudio, opts: PdfOptions = {}): { filename: string; blob: Blob } {
  const w = buildCommon(week, studio, opts, 'Ringkasan Khotbah');
  cover(w, week, studio, opts, 'Ringkasan Khotbah');
  w.newPage();
  w.y = 22;
  w.label('Ringkasan', C.accent);
  w.title('Inti Khotbah', 20);
  w.paragraph(studio.sermon?.summary || '');
  if (studio.sermon?.rationale) w.callout('Pendekatan & Metode', studio.sermon.rationale);
  const slides = studio.sermon?.slideOutline || [];
  for (const s of slides) {
    w.newPage();
    w.gradientBar(0, 1.5);
    w.y = 24;
    w.label('Slide', C.pink);
    w.title(s.title, 22);
    w.image(opts.pathImages?.[1], 40);
    if (s.bullets?.length) w.bullets(s.bullets);
    if (s.visualNote) w.field('Arahan Visual', s.visualNote, 9.5);
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
    w.gradientBar(0, 10);
    w.y = 26;
    w.label(`RHB · Week ${week.index} · ${p.dayLabel}`, C.accent);
    w.title(p.title, 24);
    w.subtitle([studio.chapterNo, studio.fundamentalFirman?.ref].filter(Boolean).join(' · '));
    w.divider(7);
    w.image(opts.pathImages?.[p.pathIndex], 52);
    if (p.scriptureText) w.callout(p.scriptureRef || 'Nats', p.scriptureText);
    w.field('Perenungan', p.reflection);
    if (p.hookQuestion) w.field('Tanya Dirimu', p.hookQuestion);
    if (p.fgdQuestions?.length) {
      w.doc.setFont('helvetica', 'bold');
      w.doc.setFontSize(8.5);
      setText(w.doc, C.accent);
      w.doc.text('RENUNGKAN & DISKUSIKAN', M, w.y);
      w.y += 4.5;
      w.bullets(p.fgdQuestions);
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
