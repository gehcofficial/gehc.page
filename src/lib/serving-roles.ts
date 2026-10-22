/**
 * Usulan peran pelayanan mengikuti urutan pola ibadah Creative Lab.
 * Musik tidak wajib. Nama orang tidak menempel di nama peran.
 */

export function displayServiceRoleName(name: string): string {
  const n = String(name || '').trim();
  if (/^liturgist\s*[-–—]\s*shyllo$/i.test(n)) return 'Liturgos';
  return n;
}

export type ProposedServingRole = {
  order: number;
  segment: string;
  name: string;
  division: string;
  optional: boolean;
  note: string;
};

export const WORSHIP_ORDER_ROLES: ProposedServingRole[] = [
  { order: 1, segment: 'Kedatangan', name: 'Koordinator Tuan Rumah', division: 'KOINONIA', optional: false, note: 'Bahan aktivitas dibagikan ke mentor dan co-mentor saat kedatangan.' },
  { order: 2, segment: 'Kedatangan', name: 'Penerima Tamu', division: 'KOINONIA', optional: false, note: '' },
  { order: 3, segment: 'Kedatangan', name: 'Absensi Tamu', division: 'KOINONIA', optional: false, note: '' },
  { order: 4, segment: 'Kedatangan', name: 'Kebersihan & Penataan Ruang', division: 'DIAKONIA', optional: false, note: '' },
  { order: 5, segment: 'Praise & Worship', name: 'Liturgos', division: 'LITURGIA', optional: false, note: 'Koordinasi pendekatan dan jadwal dengan Liturgia, termasuk anggota di luar kelompok yang bertugas.' },
  { order: 6, segment: 'Praise & Worship', name: 'Pemimpin Pujian', division: 'LITURGIA', optional: true, note: 'Musik tidak wajib; tergantung kesediaan.' },
  { order: 7, segment: 'Praise & Worship', name: 'Penyanyi', division: 'LITURGIA', optional: true, note: 'Musik tidak wajib; tergantung kesediaan.' },
  { order: 8, segment: 'Praise & Worship', name: 'Pemusik', division: 'LITURGIA', optional: true, note: 'Hanya bila ada yang bersedia.' },
  { order: 9, segment: 'Firman & Briefing', name: 'Pembaca Firman', division: 'DIDASKALIA', optional: false, note: '' },
  { order: 10, segment: 'Firman & Briefing', name: 'Pembawa Acara', division: 'LITURGIA', optional: false, note: 'Mengumumkan pencatat dan pengundian.' },
  { order: 11, segment: 'Presentasi', name: 'Operator Multimedia / Siaran Langsung', division: 'MARTURIA', optional: false, note: '' },
  { order: 12, segment: 'Presentasi', name: 'Operator Tata Suara', division: 'MARTURIA', optional: false, note: '' },
  { order: 13, segment: 'Presentasi', name: 'Fotografer', division: 'MARTURIA', optional: true, note: '' },
  { order: 14, segment: 'Persembahan & Doa', name: 'Pengumpul Persembahan', division: 'LITURGIA', optional: false, note: '' },
  { order: 15, segment: 'Persembahan & Doa', name: 'Doa Persembahan', division: 'LITURGIA', optional: false, note: '' },
  { order: 16, segment: 'Lagu & Doa Penutup', name: 'Doa Syafaat', division: 'LITURGIA', optional: false, note: '' },
];

/** Caption siap kirim untuk mentor kelompok penanggung. Tuan rumah mengisi nama. */
export function buildResponsibleGroupCaption(opts: {
  dateLabel: string;
  responsibleGroup?: string | null;
  hostGroup?: string | null;
}): string {
  const lines = [
    `Shalom mentor dan co-mentor ${opts.responsibleGroup || 'kelompok penanggung'}.`,
    `Ibadah ${opts.dateLabel}. Tuan rumah: ${opts.hostGroup || '—'}.`,
    '',
    'Peran mengikuti urutan pola ibadah. Musik tidak wajib dan tergantung kesediaan.',
    'Koordinasikan pendekatan serta jadwal dengan Liturgia, termasuk anggota di luar kelompok yang bertugas.',
    'Tuan rumah mengisi nama pada tiap peran. Mentor dan co-mentor setiap kelompok melihat daftar yang sama.',
    '',
  ];
  let segment = '';
  for (const role of WORSHIP_ORDER_ROLES) {
    if (role.segment !== segment) {
      lines.push(role.segment);
      segment = role.segment;
    }
    lines.push(`• ${role.name}${role.optional ? ' (opsional)' : ''} — ${role.division}: ____`);
  }
  return lines.join('\n').trim();
}
