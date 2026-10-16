/**
 * PDF ringkasan khotbah (dibuat di HP, instan) — pola jsPDF deterministik
 * seperti mentoringPdf (teks, bukan screenshot).
 * Isi: sampul (opsional) + ide besar + ayat + 4 seksi + lampiran petugas.
 */
import { jsPDF } from 'jspdf';
import { stripMd } from './md-lite';

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
};

export type RingkasanPdfSection = { label: string; body: string };
export type RingkasanPdfDuty = { name: string; role?: string | null; division?: string | null };

export type RingkasanPdfInput = {
  title: string;
  dateLabel?: string | null;
  bigIdea?: string | null;
  verseRef?: string | null;
  verseText?: string | null;
  sections?: RingkasanPdfSection[];
  duties?: RingkasanPdfDuty[];
  link?: string | null;
  /** Cover opsional (data URL JPEG/PNG) — best-effort, tanpanya PDF tetap jadi. */
  coverDataUrl?: string | null;
};

/** Ambil gambar → data URL (gagal = null; CORS Drive dsb. tidak menggagalkan PDF). */
export async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || '') || null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().slice(0, 48).replace(/^-+|-+$/g, '') || 'ringkasan';
}

export function buildRingkasanPdf(input: RingkasanPdfInput): { filename: string; blob: Blob } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

  const setFill = (rgb: readonly [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: readonly [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: readonly [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const page = () => {
    setFill(C.bg);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };
  const ensure = (needed: number) => {
    if (y + needed < PAGE_H - 16) return;
    doc.addPage();
    page();
    y = M;
  };
  const paragraph = (text: string, size = 9.5, color: readonly [number, number, number] = C.ink, bold = false) => {
    const clean = stripMd(text).trim();
    if (!clean) return;
    setText(color);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean, CONTENT_W) as string[];
    ensure(lines.length * 4.6 + 2);
    doc.text(lines, M, y);
    y += lines.length * 4.6;
  };
  const heading = (text: string) => {
    ensure(12);
    y += 3;
    setText(C.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(stripMd(text).toUpperCase(), M, y);
    y += 6;
  };

  // Sampul: cover bila ada, lalu judul.
  page();
  y = M + 4;
  if (input.coverDataUrl) {
    try {
      doc.addImage(input.coverDataUrl, 'JPEG', M, M, CONTENT_W, 90, undefined, 'FAST');
      y = M + 96;
    } catch {
      /* tanpa cover — lanjut teks */
    }
  }

  setText(C.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GEHC YOUTH — RINGKASAN KHOTBAH', M, y);
  y += 7;
  setText(C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(input.title, CONTENT_W) as string[];
  ensure(titleLines.length * 7 + 10);
  doc.text(titleLines, M, y);
  y += titleLines.length * 7 + 1;
  if (input.dateLabel) {
    setText(C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(input.dateLabel, M, y);
    y += 8;
  }
  setDraw(C.line);
  doc.line(M, y, PAGE_W - M, y);
  y += 4;

  // Ide besar.
  if (input.bigIdea?.trim()) {
    setFill(C.accentSoft);
    const ideaLines = doc.splitTextToSize(stripMd(input.bigIdea), CONTENT_W - 8) as string[];
    ensure(ideaLines.length * 5 + 12);
    doc.roundedRect(M, y - 4, CONTENT_W, ideaLines.length * 5 + 8, 3, 3, 'F');
    setText(C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(ideaLines, M + 4, y + 3);
    y += ideaLines.length * 5 + 10;
  }

  // Ayat.
  if (input.verseRef) {
    heading('Ayat');
    paragraph(`${input.verseRef}${input.verseText?.trim() ? ` — "${stripMd(input.verseText)}"` : ''}`, 9.5, C.ink, true);
    y += 2;
  }

  // 4 seksi.
  for (const s of input.sections || []) {
    if (!s.body?.trim()) continue;
    heading(s.label);
    paragraph(s.body, 9.5);
    y += 2;
  }

  // Lampiran petugas (Divisi → Role → Orang, teks).
  const duties = (input.duties || []).filter((d) => d.name?.trim());
  if (duties.length) {
    heading('Petugas yang melayani');
    const byDiv = new Map<string, Map<string, string[]>>();
    for (const d of duties) {
      const div = String(d.division || '').trim().toUpperCase() || 'LAINNYA';
      const role = String(d.role || '').trim() || 'Petugas';
      if (!byDiv.has(div)) byDiv.set(div, new Map());
      const roles = byDiv.get(div)!;
      if (!roles.has(role)) roles.set(role, []);
      roles.get(role)!.push(d.name.trim());
    }
    for (const [div, roles] of byDiv) {
      paragraph(div.charAt(0) + div.slice(1).toLowerCase(), 9.5, C.accent, true);
      for (const [role, names] of roles) {
        paragraph(`${role}: ${names.join(', ')}`, 9);
      }
      y += 1;
    }
  }

  // Footer + nama file.
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setText(C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(input.link ? `${input.link}` : `Dibuat ${stamp} · GEHC Youth`, M, PAGE_H - 10);
    doc.text(`${p}/${pages}`, PAGE_W - M, PAGE_H - 10, { align: 'right' });
  }
  return { filename: `ringkasan-${slugify(input.title)}.pdf`, blob: doc.output('blob') };
}
