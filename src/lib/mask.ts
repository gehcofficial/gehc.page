/**
 * Utilitas privasi & format teks untuk dibaca/dicetak di ibadah.
 * Dipakai Portal Doa (Doa Minggu) dan panel Ulang Tahun kalender Kegiatan.
 */

export const PRAYER_KIND_LABEL: Record<string, string> = {
  SAKIT: 'Sakit',
  DUKA: 'Duka',
  YUDISIUM: 'Yudisium',
  WISUDA: 'Wisuda',
  KERJA: 'Kerja / pindah',
  LAINNYA: 'Lainnya',
  UMUM: 'Umum',
};

export const prayerKindLabel = (kind?: string | null) =>
  PRAYER_KIND_LABEL[String(kind || '').toUpperCase()] || String(kind || '—');

/** Nama depan saja — untuk mode sembunyi detail / cetak. */
export function firstNameOnly(name?: string | null): string {
  const s = String(name || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0];
}

/** Nama tampil: penuh atau nama depan saja. */
export function displayName(name?: string | null, hideDetail = false): string {
  const full = String(name || '').trim();
  if (!full) return '—';
  return hideDetail ? firstNameOnly(full) : full;
}

/** 2026-09-03 → "3 Sep 2026" (UTC, agar tidak bergeser sehari di WIB). */
export function formatDayShort(iso?: string | null): string {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** 2026-09-03 → "3 Sep". */
export function formatDayMonth(iso?: string | null): string {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export type PrayerListItem = {
  kind: string;
  note?: string | null;
  subject?: { name?: string | null } | null;
  subjectName?: string | null;
  occurredOn?: string | null;
  isExpired?: boolean;
  lateRecordedDays?: number;
  prayedThisWeek?: boolean;
};

/** Teks daftar doa untuk disalin/dicetak. */
export function formatPrayerList(
  items: PrayerListItem[],
  opts: { title?: string; hideDetail?: boolean; includeNote?: boolean } = {},
): string {
  const hide = Boolean(opts.hideDetail);
  const includeNote = opts.includeNote !== false && !hide;
  const lines: string[] = [];
  if (opts.title) lines.push(opts.title, '');
  if (!items.length) {
    lines.push('(belum ada konteks doa)');
    return lines.join('\n');
  }
  items.forEach((it, i) => {
    const name = displayName(it.subject?.name || it.subjectName, hide);
    const when = formatDayShort(it.occurredOn);
    const marks = [
      when ? `kejadian ${when}` : '',
      it.lateRecordedDays ? `baru dicatat H+${it.lateRecordedDays}` : '',
      it.isExpired ? 'kedaluwarsa' : '',
      it.prayedThisWeek ? 'sudah didoakan' : '',
    ].filter(Boolean);
    lines.push(`${i + 1}. [${prayerKindLabel(it.kind)}] ${name}${marks.length ? ` — ${marks.join(', ')}` : ''}`);
    if (includeNote && it.note) lines.push(`   ${String(it.note).replace(/\s+/g, ' ').trim()}`);
  });
  return lines.join('\n');
}

export type BirthdayListItem = { name: string; day: number; age?: number | null; date?: string };

/** Teks daftar ulang tahun bulanan untuk disalin/dicetak. */
export function formatBirthdayList(
  items: BirthdayListItem[],
  opts: { title?: string; hideDetail?: boolean; monthLabel?: string } = {},
): string {
  const hide = Boolean(opts.hideDetail);
  const lines: string[] = [];
  if (opts.title) lines.push(opts.title, '');
  if (opts.monthLabel) lines.push(opts.monthLabel, '');
  if (!items.length) {
    lines.push('(belum ada ulang tahun bulan ini)');
    return lines.join('\n');
  }
  items.forEach((it, i) => {
    const age = !hide && typeof it.age === 'number' ? ` (${it.age} th)` : '';
    lines.push(`${i + 1}. ${displayName(it.name, hide)}${age} — ${it.day}`);
  });
  return lines.join('\n');
}

/** Salin teks ke clipboard tanpa melempar (aman untuk WebView lama). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Buka jendela cetak berisi teks polos (tanpa mencetak seluruh halaman portal). */
export function printText(title: string, body: string): boolean {
  const w = window.open('', '_blank', 'width=760,height=920');
  if (!w) return false;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>`
    + '<style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:28px;white-space:pre-wrap;font-size:14px;line-height:1.55;color:#1B1B1B}</style>'
    + `</head><body>${esc(body)}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
  return true;
}
