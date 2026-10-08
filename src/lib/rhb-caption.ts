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
  if (input.doc === 'pembekalan') return buildPembekalanCaption(input);
  if (input.doc === 'khutbah') return buildKhutbahCaption(input);
  const title = `RHB Pekan ${input.weekIndex} — ${path?.dayLabel || DAY_LABELS[dayIndex - 1]}`;
  const theme = path?.title || content.theme || content.kitabFokus || '';
  const ref = [content.chapterNo, path?.scriptureRef].filter(Boolean).join(' · ');

  return [
    `📖 *${title}*`,
    theme ? `*${theme}*` : '',
    content.date ? `🗓️ ${fmtDate(content.date)}` : '',
    ref ? `📌 ${ref}` : '',
    '',
    'RHB hari ini sudah siap dibaca. Yuk mulai dari Pengantar, lalu Refleksi Pribadi & Diskusi Kelompok 👇',
    url,
    '',
    HASHTAG,
  ].filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Caption Pembekalan — audiens mentor & co-mentor (arahan teknis pekan). */
export function buildPembekalanCaption(input: CaptionInput): string {
  const { content } = input;
  const url = materialAbsoluteUrl({ doc: 'pembekalan', yearMonth: input.yearMonth, weekIndex: input.weekIndex }, input.origin);
  const khutbahUrl = materialAbsoluteUrl({ doc: 'khutbah', yearMonth: input.yearMonth, weekIndex: input.weekIndex }, input.origin);
  const methods = (content.sermon?.methods || []).slice(0, 3).join(' + ');
  const ref = [content.fundamentalFirman?.ref, content.kitabFokus].filter(Boolean).join(' · ');
  const teksUtama = content.sermon?.teksUtama?.ref || '';
  return [
    `🛡️ *Pembekalan Mentor & Co-Mentor — Pekan ${input.weekIndex}*`,
    content.theme ? `*${content.theme}*` : '',
    content.date ? `🗓️ ${fmtDate(content.date)}` : '',
    ref ? `📌 ${ref}` : '',
    teksUtama ? `📖 Teks utama: ${teksUtama}` : '',
    methods ? `🎙️ Metode: ${methods}` : '',
    '',
    'Mentor & Co-Mentor, bekali diri sebelum hari Minggu: baca garis besar 4 komponen + arahan teknis pola ibadah pekan ini 👇',
    url,
    '',
    `Detail khotbah penuh ada di Ringkasan Khotbah 👇\n${khutbahUrl}`,
    '',
    HASHTAG,
  ].filter((l) => l !== null && l !== '').join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Caption Ringkasan Khotbah — audiens pembawa firman. */
export function buildKhutbahCaption(input: CaptionInput): string {
  const { content } = input;
  const url = materialAbsoluteUrl({ doc: 'khutbah', yearMonth: input.yearMonth, weekIndex: input.weekIndex }, input.origin);
  const teks = content.sermon?.teksUtama?.ref || content.fundamentalFirman?.ref || '';
  const bigIdea = content.sermon?.bigIdea || '';
  return [
    `🎙️ *Ringkasan Khotbah — Pekan ${input.weekIndex}*`,
    content.theme ? `*${content.theme}*` : '',
    content.date ? `🗓️ ${fmtDate(content.date)}` : '',
    teks ? `📌 ${teks}` : '',
    bigIdea ? `💡 Inti pesan: ${bigIdea}` : '',
    '',
    'Acuan khotbah pekan ini (4 outline + kerangka slide) sudah siap. Tuhan memberkati pelayanan firman 👇',
    url,
    '',
    HASHTAG,
  ].filter((l) => l !== null && l !== '').join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
