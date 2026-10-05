/**
 * Rekap pribadi Mentoring Day (F5.2) — PDF deterministik (jsPDF).
 * Isi: identitas peserta, topik prioritas + lantai, tabel Likert,
 * catatan per pos + kesimpulan, chip terpilih.
 */
import { jsPDF } from 'jspdf';
import type { MentoringMyResult, MentoringRoom, MentoringSessionPayload } from './mentoring';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const CONTENT_W = PAGE_W - M * 2;

const C = {
  bg: [250, 249, 245] as const,
  ink: [27, 27, 27] as const,
  muted: [140, 136, 128] as const,
  line: [217, 215, 208] as const,
  accent: [126, 34, 206] as const,
  soft: [243, 232, 255] as const,
};

export type MentoringRecapInput = {
  session: MentoringSessionPayload['session'];
  participantName: string;
  values: Record<string, number>;
  items: MentoringSessionPayload['likert']['items'];
  notes: Record<string, string>;
  chips: { code: string; label: string }[];
  result: MentoringMyResult | null;
  rooms: MentoringRoom[];
  generatedAt?: Date;
};

export function buildMentoringRecapPdf(input: MentoringRecapInput): { filename: string; blob: Blob } {
  const { session, participantName, values, items, notes, chips, result, rooms } = input;
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
  const paragraph = (text: string, size = 9.5, color: readonly [number, number, number] = C.ink) => {
    setText(color);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    ensure(lines.length * 4.6 + 2);
    doc.text(lines, M, y);
    y += lines.length * 4.6;
  };
  const heading = (text: string, size = 11) => {
    ensure(12);
    y += 3;
    setText(C.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(text, M, y);
    y += 6;
  };

  page();
  y = M + 4;

  // Header
  setText(C.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GEHC YOUTH — MENTORING DAY', M, y);
  y += 7;
  setText(C.ink);
  doc.setFontSize(16);
  const title = doc.splitTextToSize(session.title, CONTENT_W) as string[];
  doc.text(title, M, y);
  y += title.length * 7 + 1;
  setText(C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const meta = [
    participantName,
    session.sessionDate ? new Date(session.sessionDate).toLocaleDateString('id-ID') : null,
    session.pattern?.name || null,
  ]
    .filter(Boolean)
    .join(' · ');
  doc.text(meta, M, y);
  y += 8;
  setDraw(C.line);
  doc.line(M, y, PAGE_W - M, y);
  y += 2;

  // Prioritas
  if (result) {
    heading('Topik prioritas kamu');
    setFill(C.soft);
    doc.roundedRect(M, y - 4, CONTENT_W, 16, 3, 3, 'F');
    setText(C.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(result.topicLabel, M + 4, y + 4);
    setText(C.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Silakan menuju ${result.floorLabel}`, M + 4, y + 9.5);
    y += 20;
    if (result.affirmations.length) {
      for (const a of result.affirmations) paragraph(`• ${a}`, 9, C.muted);
      y += 2;
    }
  }

  // Rute kunjungan
  if (rooms.length) {
    heading('Rute kunjungan (berurutan)');
    const ordered = [...rooms].sort((a, b) => (a.rank || 0) - (b.rank || 0));
    ordered.forEach((room, idx) => {
      paragraph(`${idx + 1}. ${room.floorLabel} — ${room.label}`, 9.5);
    });
    y += 2;
  }

  // Likert
  heading('Jawaban Likert (1 = sangat tidak setuju, 5 = sangat setuju)');
  const byTopic = new Map<string, typeof items>();
  for (const item of items) {
    if (!byTopic.has(item.topicCode)) byTopic.set(item.topicCode, []);
    byTopic.get(item.topicCode)!.push(item);
  }
  for (const [topic, list] of byTopic) {
    const label = session.topics.find((t) => t.code === topic)?.label || topic;
    paragraph(label, 9.5, C.accent);
    for (const item of list) {
      const score = values[item.id];
      paragraph(`${score ? `[${score}]` : '[—]'}  ${item.text}`, 9);
    }
    y += 1;
  }

  // Catatan
  const noteEntries = [
    ...session.topics
      .map((t) => ({ label: `Catatan ${t.label}`, value: notes[t.code] }))
      .filter((n) => n.value),
    { label: 'Kesimpulan / doa', value: notes.KESIMPULAN },
  ].filter((n) => n.value);
  if (noteEntries.length) {
    heading('Catatanmu');
    for (const entry of noteEntries) {
      paragraph(entry.label, 9.5, C.accent);
      paragraph(String(entry.value), 9.5);
      y += 1;
    }
  }

  // Chips
  if (chips.length) {
    heading('Lesson learned (chip words)');
    paragraph(chips.map((c) => c.label).join('   '), 10);
  }

  // Footer
  const stamp = (input.generatedAt || new Date()).toLocaleString('id-ID');
  doc.setFontSize(8);
  setText(C.muted);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.text(`Dibuat ${stamp} · GEHC Youth`, M, PAGE_H - 10);
    doc.text(`${p}/${pages}`, PAGE_W - M, PAGE_H - 10, { align: 'right' });
  }

  const slugSafe = session.slug.replace(/[^a-zA-Z0-9-]+/g, '-');
  const nameSafe = participantName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return { filename: `mentoring-${slugSafe}-${nameSafe}.pdf`, blob: doc.output('blob') };
}

export type SessionRecapSection = { heading: string; lines: { label?: string; body: string }[] };

export type SessionRecapInput = {
  kicker: string;
  title: string;
  meta: string;
  participantName: string;
  sections: SessionRecapSection[];
  generatedAt?: Date;
};

/**
 * Rekap pribadi generik semua pola (FGD, deep sharing, film, misi, ...).
 * buildMentoringRecapPdf tetap untuk post-to-post (kompatibel mundur).
 */
export function buildSessionRecapPdf(input: SessionRecapInput): { filename: string; blob: Blob } {
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
  const paragraph = (text: string, size = 9.5, color: readonly [number, number, number] = C.ink) => {
    setText(color);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    ensure(lines.length * 4.6 + 2);
    doc.text(lines, M, y);
    y += lines.length * 4.6;
  };
  const heading = (text: string, size = 11) => {
    ensure(12);
    y += 3;
    setText(C.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(text, M, y);
    y += 6;
  };

  page();
  y = M + 4;
  setText(C.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(input.kicker, M, y);
  y += 7;
  setText(C.ink);
  doc.setFontSize(16);
  const title = doc.splitTextToSize(input.title, CONTENT_W) as string[];
  doc.text(title, M, y);
  y += title.length * 7 + 1;
  setText(C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text([input.participantName, input.meta].filter(Boolean).join(' · '), M, y);
  y += 8;
  setDraw(C.line);
  doc.line(M, y, PAGE_W - M, y);
  y += 2;

  for (const sec of input.sections) {
    const filled = sec.lines.filter((l) => String(l.body || '').trim());
    if (!filled.length) continue;
    heading(sec.heading);
    for (const line of filled) {
      if (line.label) paragraph(line.label, 9.5, C.accent);
      paragraph(String(line.body), 9.5);
      y += 1;
    }
  }

  const stamp = (input.generatedAt || new Date()).toLocaleString('id-ID');
  doc.setFontSize(8);
  setText(C.muted);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.text(`Dibuat ${stamp} · GEHC Youth`, M, PAGE_H - 10);
    doc.text(`${p}/${pages}`, PAGE_W - M, PAGE_H - 10, { align: 'right' });
  }
  const slugSafe = input.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().slice(0, 40);
  const nameSafe = input.participantName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return { filename: `rekap-${slugSafe}-${nameSafe}.pdf`, blob: doc.output('blob') };
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
