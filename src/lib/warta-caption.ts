/**
 * Caption siap-kirim WhatsApp untuk warta Info & Peluang + deep link per warta.
 * Route: #/portal/<ns>/internal-warta?item=<id> (panel auto-membuka detail).
 */

export const WARTA_CATEGORY_LABEL: Record<string, string> = {
  BEASISWA: 'Beasiswa',
  LOWONGAN: 'Lowongan Kerja',
  PELUANG: 'Peluang',
  KEGIATAN: 'Kegiatan',
  UMUM: 'Umum',
};

export type WartaShareInput = {
  id: string;
  title: string;
  category: string;
  summary?: string | null;
  body?: string | null;
  deadline?: string | null;
  share?: { name?: string | null } | null;
  shareNote?: string | null;
  link?: string | null;
  /** Caption kustom tersimpan (override bila diisi). */
  caption?: string | null;
};

const HASHTAG = '#InfoPeluang #GEHCYouth';

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return ''; }
}

export function wartaAbsoluteUrl(id: string, opts: { origin?: string; ns?: string } = {}): string {
  const base = opts.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const ns = opts.ns || 'superadmin';
  return `${base}/#/portal/${ns}/internal-warta?item=${encodeURIComponent(id)}`;
}

/** Caption auto (dipakai bila caption kustom kosong). */
export function buildWartaCaption(w: WartaShareInput, opts: { origin?: string; ns?: string } = {}): string {
  const custom = String(w.caption || '').trim();
  if (custom) return custom;
  const url = wartaUrlSafe(w, opts);
  const lines = [
    `📢 *${w.title}*`,
    w.category ? `🏷️ ${WARTA_CATEGORY_LABEL[w.category] || w.category}` : '',
    w.summary ? String(w.summary).trim() : '',
    w.deadline ? `🗓️ Ditutup: ${fmtDate(w.deadline)}` : '',
    w.share?.name ? `👤 ${w.share.name}${w.shareNote ? ` — ${w.shareNote}` : ''}` : (w.shareNote ? `👤 ${w.shareNote}` : ''),
    '',
    'Info lengkap 👇',
    url,
    ...(w.link ? [`🔗 ${w.link}`] : []),
    '',
    HASHTAG,
  ].filter((l) => l !== '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function wartaUrlSafe(w: WartaShareInput, opts: { origin?: string; ns?: string } = {}): string {
  return w.id ? wartaAbsoluteUrl(w.id, opts) : '';
}
