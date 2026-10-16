/**
 * Caption terima kasih Koinonia (dipakai panel Koinonia tab Syukur).
 * Diekstrak dari halaman arsip agar teks panel & publik tak divergen.
 */

export type ThanksCaptionInput = {
  eventName: string;
  eventDateLabel: string;
  eventId: string;
  host?: string | null;
  responsible?: string | null;
  verseRef?: string | null;
  bigIdea?: string | null;
  origin?: string | null;
};

export function buildThanksCaption(input: ThanksCaptionInput): string {
  const host = input.host ? `tuan rumah ${input.host}` : '';
  const resp = input.responsible ? `penanggung jawab ${input.responsible}` : '';
  const who = [host, resp].filter(Boolean).join(' & ');
  const origin = (input.origin || '').replace(/\/$/, '');
  return [
    `Terima kasih Tuhan untuk ibadah "${input.eventName}" (${input.eventDateLabel}).`,
    who ? `Terima kasih ${who} dan semua petugas yang melayani.` : 'Terima kasih semua petugas yang melayani.',
    input.verseRef ? `Firman: ${input.verseRef}.` : '',
    input.bigIdea || '',
    origin ? `${origin}#/arsip/${input.eventId}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
