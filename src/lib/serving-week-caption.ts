/**
 * Caption siap-tempel grup WA temporer serving week.
 * Pola mengikuti event-invite-caption.ts (teks Editable → Salin → wa.me).
 */

export type WeekInvite = {
  serving?: {
    responsibleGroup?: { name?: string | null } | null;
    hostGroup?: { name?: string | null } | null;
    cycleIndex?: number | null;
    event?: { name?: string | null } | null;
  } | null;
  officers?: Array<{ name?: string | null; component?: string | null }>;
  mentors?: Array<{ name?: string | null; groupName?: string | null }>;
  hods?: Array<{ name?: string | null; division?: string | null }>;
};

export function fmtDateID(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Daftar nama undangan (tanpa nomor HP) untuk ditempel setelah link. */
export function buildServingRosterText(invite: WeekInvite): string {
  const lines: string[] = [];
  const s = invite.serving;
  if (s?.responsibleGroup?.name || s?.hostGroup?.name) {
    lines.push(`Penanggung: ${s?.responsibleGroup?.name || '—'} → Tuan rumah: ${s?.hostGroup?.name || '—'}`);
  }
  if (invite.mentors?.length) {
    lines.push('', 'Mentor/perwakilan:');
    for (const m of invite.mentors) lines.push(`• ${m.name || '?'} (${m.groupName || ''})`);
  }
  if (invite.officers?.length) {
    lines.push('', 'Petugas:');
    for (const o of invite.officers) lines.push(`• ${o.name || '?'} — ${o.component || 'petugas'}`);
  }
  if (invite.hods?.length) {
    lines.push('', 'HOD/perwakilan divisi:');
    for (const h of invite.hods) lines.push(`• ${h.name || '?'}${h.division ? ` (${h.division})` : ''}`);
  }
  return lines.join('\n').trim();
}

export function buildServingInviteCaption(opts: {
  date: string;
  waUrl: string;
  repDayText?: string;
  invite: WeekInvite;
}): string {
  const s = opts.invite.serving;
  return [
    `Shalom! Grup koordinasi ibadah Minggu ${fmtDateID(opts.date)} telah dibuka.`,
    s?.event?.name ? `Ibadah: ${s.event.name}` : null,
    s?.responsibleGroup?.name || s?.hostGroup?.name
      ? `Penanggung: ${s?.responsibleGroup?.name || '—'} → Tuan rumah: ${s?.hostGroup?.name || '—'}`
      : null,
    '',
    'Masuk grup di sini:',
    opts.waUrl,
    '',
    opts.repDayText ? `Representative Day: ${opts.repDayText}` : null,
    opts.repDayText ? '' : null,
    'Harap konfirmasi tugas masing-masing di portal (menu Penatalayan → tugas saya → Konfirmasi).',
    'Grup ini TEMPORER — ditutup Senin pagi setelah ibadah. Terima kasih melayani!',
  ]
    .filter((x) => x !== null)
    .join('\n');
}

export function buildServingCloseCaption(opts: { date: string; invite: WeekInvite }): string {
  return [
    `Terima kasih untuk pelayanan Minggu ${fmtDateID(opts.date)}! Tuhan memberkati.`,
    '',
    'Grup koordinasi minggu ini DITUTUP dan DIARSIPKAN. Silakan keluar dari grup ini.',
    'Evaluasi & masukan: sampaikan ke mentor atau BOD Tim Kerja.',
    'Sampai jumpa di pelayanan berikutnya!',
  ].join('\n');
}

export function waShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Katalog video panduan singkat (30–60 dtk, rekam sekali pakai HP).
 * Hosting = Drive (folder ibadah per divisi); url diisi Marturia/BOD.
 */
export type ToolVideo = { id: string; title: string; forRoles: string; url: string };

export const TOOL_VIDEOS: ToolVideo[] = [
  { id: 'konfirmasi-tugas', title: 'Cara konfirmasi tugas di portal', forRoles: 'Semua petugas', url: '' },
  { id: 'checklist', title: 'Cara centang checklist persiapan', forRoles: 'Semua petugas', url: '' },
  { id: 'scan-qr', title: 'Cara scan QR absensi & bedakan dengan QRIS', forRoles: 'Koinonia + semua', url: '' },
  { id: 'materi-pembekalan', title: 'Cara buka materi pembekalan', forRoles: 'Pembaca Firman (Didaskalia)', url: '' },
  { id: 'slide-isu', title: 'Lapor cepat bila slide/proyektor bermasalah', forRoles: 'Marturia + MC', url: '' },
];

export function buildToolHowtoCaption(opts: { videos?: ToolVideo[] }): string {
  const list = (opts.videos || TOOL_VIDEOS).filter((v) => v.url);
  return [
    'Panduan kilat alat portal (wajib sebelum hari-H):',
    '1) Buka portal → Penatalayan → tugas saya → Konfirmasi.',
    '2) Centang checklist persiapan per tugas (mis. latihan, gladi, cek sound).',
    '3) Absensi jemaat pakai SCAN QR di lokasi — QR absensi BUKAN QRIS.',
    '4) Pembaca Firman: buka materi pembekalan dari notifikasi portal.',
    'Butuh bantuan? Tanya di grup ini, sebut @BOD.',
    list.length ? '' : null,
    ...list.map((v) => `• ${v.title}: ${v.url}`),
  ]
    .filter((x) => x !== null)
    .join('\n');
}
