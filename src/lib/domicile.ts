export const DOMICILE_KINDS = ['KOSTAN', 'SBH', 'NBH', 'ELVIS', 'MONROE', 'KGR', 'OTHER'] as const;
export type DomicileKind = (typeof DOMICILE_KINDS)[number];

export const DOMICILE_OPTIONS: { value: DomicileKind; label: string }[] = [
  { value: 'KOSTAN', label: 'Kostan' },
  { value: 'SBH', label: 'SBH (Student Boarding House)' },
  { value: 'NBH', label: 'NBH (New Beverly Hills)' },
  { value: 'ELVIS', label: 'Elvis Tower' },
  { value: 'MONROE', label: 'Monroe Tower' },
  { value: 'KGR', label: 'Kawana Golf Residence' },
  { value: 'OTHER', label: 'Lainnya' },
];

/** Domisili yang wajib isi perincian */
export const DOMICILE_DETAIL_REQUIRED = new Set<DomicileKind>(['KOSTAN', 'OTHER']);

/** Domisili yang boleh isi blok/lantai (opsional) */
export const DOMICILE_BLOCK_OPTIONAL = new Set<DomicileKind>(['SBH', 'NBH', 'ELVIS', 'MONROE', 'KGR']);

export function domicileLabel(kind: string | null | undefined, detail?: string | null): string {
  if (!kind) return detail || '—';
  const opt = DOMICILE_OPTIONS.find((o) => o.value === kind);
  const base = opt?.label || kind;
  return detail ? `${base} · ${detail}` : base;
}

export function isValidDomicileKind(kind: string): kind is DomicileKind {
  return (DOMICILE_KINDS as readonly string[]).includes(kind);
}

export function domicileDetailConfig(kind: DomicileKind | ''): {
  show: boolean;
  required: boolean;
  label: string;
  placeholder: string;
} | null {
  if (!kind) return null;
  if (DOMICILE_DETAIL_REQUIRED.has(kind as DomicileKind)) {
    return {
      show: true,
      required: true,
      label: kind === 'KOSTAN' ? 'Nama kost / area *' : 'Detail domisili *',
      placeholder: kind === 'KOSTAN' ? 'Kost Melati Dekat PU' : 'Rumah Orang Tua Cikarang',
    };
  }
  if (DOMICILE_BLOCK_OPTIONAL.has(kind as DomicileKind)) {
    return {
      show: true,
      required: false,
      label: 'Blok / lantai / unit (opsional)',
      placeholder: 'Blok B Lantai 3',
    };
  }
  return null;
}
