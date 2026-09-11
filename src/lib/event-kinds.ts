export const EVENT_KIND_DETAILS = {
  UMUM: {
    id: 'UMUM' as const,
    label: 'Umum',
    tooltip: 'Ibadah rutin mingguan pemuda. Terbuka untuk seluruh pemuda. Materi by event: pembekalan, ringkasan, RHB.',
  },
  KHUSUS: {
    id: 'KHUSUS' as const,
    label: 'Khusus',
    tooltip: 'Kegiatan tematik musiman berskala besar dengan kepanitiaan dan pendaftaran khusus. Terbuka untuk seluruh pemuda.',
  },
  INTERNAL: {
    id: 'INTERNAL' as const,
    label: 'Internal',
    tooltip: 'Kegiatan kerja internal komisi dan tim kerja. Hanya staf terkait.',
  },
  REKREASIONAL: {
    id: 'REKREASIONAL' as const,
    label: 'Rekreasional',
    tooltip: 'Kegiatan komunitas minat yang berulang untuk persekutuan. Terbuka untuk seluruh pemuda.',
  },
  // legacy DB value — UI treats as Rekreasional, BE migrates
  RECURRING: {
    id: 'RECURRING' as const,
    label: 'Rekreasional',
    tooltip: 'Kegiatan komunitas minat yang berulang untuk persekutuan. Terbuka untuk seluruh pemuda.',
  },
} as const;

export type EventKindId = 'UMUM' | 'KHUSUS' | 'INTERNAL' | 'REKREASIONAL';

export const EVENT_KINDS = [
  EVENT_KIND_DETAILS.UMUM,
  EVENT_KIND_DETAILS.KHUSUS,
  EVENT_KIND_DETAILS.INTERNAL,
  EVENT_KIND_DETAILS.REKREASIONAL,
] as const;

export const EVENT_KIND_IDS = EVENT_KINDS.map((k) => k.id) as unknown as EventKindId[];

export function normalizeEventKind(raw: unknown): EventKindId {
  const s = String(raw || '').toUpperCase().trim();
  if (s === 'RECURRING' || s === 'REKREASIONAL' || s === 'REKREASI') return 'REKREASIONAL';
  if (s === 'UMUM') return 'UMUM';
  if (s === 'KHUSUS') return 'KHUSUS';
  if (s === 'INTERNAL') return 'INTERNAL';
  return 'KHUSUS';
}

export function eventKindLabel(kind: string): string {
  const k = String(kind || '').toUpperCase();
  if (k === 'RECURRING') return 'Rekreasional';
  return EVENT_KIND_DETAILS[k as keyof typeof EVENT_KIND_DETAILS]?.label || k;
}

export function eventKindTooltip(kind: string): string {
  const k = String(kind || '').toUpperCase();
  return EVENT_KIND_DETAILS[k as keyof typeof EVENT_KIND_DETAILS]?.tooltip || '';
}
