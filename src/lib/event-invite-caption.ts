/**
 * Caption ajakan Koinonia: siap-tempel ke grup WhatsApp.
 * Isi: sapaan + event + link daftar publik + 3 langkah + absensi QR
 * (bukan QRIS) + 4 manfaat + penutup. Tanpa login untuk pembaca.
 */

export type InviteCaptionInput = {
  eventName: string;
  eventDate?: string | null;
  venueName?: string | null;
  slug?: string | null;
  origin?: string;
  /** Titik jemput carpool dari Diakonia Logistik (D3) — opsional. */
  transport?: string[];
};

function dateLabelID(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

/** Link pendaftaran publik (tanpa login). */
export function inviteLink(input: Pick<InviteCaptionInput, 'slug' | 'origin'>): string {
  const origin = (input.origin || '').replace(/\/$/, '') || 'https://youth.gehc.page';
  if (!input.slug) return `${origin}/#/register`;
  return `${origin}/#/event/${encodeURIComponent(input.slug)}`;
}

export function buildInviteCaption(input: InviteCaptionInput): string {
  const date = dateLabelID(input.eventDate);
  const points = (input.transport || []).map((t) => String(t).trim()).filter(Boolean);
  const lines = [
    `Shalom! 🙌 Yuk hadir ${input.eventName || 'ibadah pemuda'}${date ? ` — ${date}` : ''}${input.venueName ? ` di ${input.venueName}` : ''}.`,
    '',
    `Daftar dulu di sini (tanpa login, gratis):`,
    inviteLink(input),
    '',
    'Caranya gampang:',
    '1. Buka link di atas.',
    '2. Masuk dengan Google, atau isi nama & WhatsApp.',
    '3. Simpan QR daftar ulang yang muncul.',
    '',
    'Hari-H: tunjukkan QR ke Tuan Rumah untuk absensi (cukup dipindai — ini BUKAN QRIS pembayaran, jadi tidak ada yang dibayar).',
    '',
    ...(points.length ? ['Butuh barengan? Titik jemput carpool (Diakonia):', ...points.map((p) => `• ${p}`), ''] : []),
    'Kenapa daftar + absensi?',
    '• QR daftar ulang — masuk cepat tanpa antre tulis nama.',
    '• Grup WhatsApp peserta — info terbaru, carpool, dan pengumuman.',
    '• Kehadiran tercatat panitia.',
    '• Kartu terima kasih personal yang bisa diunduh setelah acara.',
    '',
    'Ajak juga temanmu — sampai jumpa! Tuhan Yesus memberkati. ✝️',
  ];
  return lines.join('\n').trim();
}
