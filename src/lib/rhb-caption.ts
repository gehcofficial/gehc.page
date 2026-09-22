/**
 * Caption siap-kirim untuk RHB (WhatsApp/grup) dengan link presentasi tertaut.
 */
import { DAY_LABELS } from './didaskalia';
import {
  MATERIAL_DOC_LABEL,
  materialAbsoluteUrl,
  type MaterialDoc,
  type ParsedMaterialHash,
  type PresentationContent,
} from './didaskalia-presentation';

const HASHTAG = '#Beyonders #GEHCYouth';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

export type CaptionInput = {
  doc: MaterialDoc;
  yearMonth: string;
  weekIndex: number;
  dayIndex?: number;
  content: PresentationContent;
  origin?: string;
};

/** Caption satu hari RHB (atau dokumen lain). */
export function buildDayCaption(input: CaptionInput): string {
  const { content } = input;
  const dayIndex = input.dayIndex || 1;
  const path = content.paths[dayIndex - 1];
  const route: ParsedMaterialHash = {
    doc: input.doc,
    yearMonth: input.yearMonth,
    weekIndex: input.weekIndex,
    ...(input.doc === 'rhb' ? { dayIndex } : {}),
  };
  const url = materialAbsoluteUrl(route, input.origin);
  const title = input.doc === 'rhb'
    ? `RHB Pekan ${input.weekIndex} — ${path?.dayLabel || DAY_LABELS[dayIndex - 1]}`
    : `${MATERIAL_DOC_LABEL[input.doc]} — Pekan ${input.weekIndex}`;
  const theme = path?.title || content.theme || content.kitabFokus || '';
  const ref = [content.chapterNo, path?.scriptureRef].filter(Boolean).join(' · ');

  return [
    `📖 *${title}*`,
    theme ? `*${theme}*` : '',
    content.date ? `🗓️ ${fmtDate(content.date)}` : '',
    ref ? `📌 ${ref}` : '',
    '',
    input.doc === 'rhb'
      ? 'RHB hari ini sudah siap dibaca. Yuk mulai dari Pengantar, lalu Refleksi Pribadi & Diskusi Kelompok 👇'
      : `${MATERIAL_DOC_LABEL[input.doc]} sudah siap 👇`,
    url,
    '',
    HASHTAG,
  ].filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Caption rekap sepekan RHB (7 link harian). */
export function buildWeekCaption(input: CaptionInput): string {
  const { content } = input;
  const lines = content.paths.map((p, i) => {
    const url = materialAbsoluteUrl({ doc: 'rhb', yearMonth: input.yearMonth, weekIndex: input.weekIndex, dayIndex: i + 1 }, input.origin);
    return `• ${p.dayLabel || DAY_LABELS[i]} — ${p.title}\n${url}`;
  });
  return [
    `📖 *RHB Pekan ${input.weekIndex} — ${content.theme || content.kitabFokus || ''}*`,
    content.date ? `🗓️ ${fmtDate(content.date)}` : '',
    '',
    'Perjalanan RHB 7 hari sudah siap 👇',
    ...lines,
    '',
    HASHTAG,
  ].filter(Boolean).join('\n').trim();
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback di bawah */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
