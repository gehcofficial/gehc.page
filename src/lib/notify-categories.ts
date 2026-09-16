export const NOTIFY_CATEGORIES = [
  'announcement',
  'warta',
  'kegiatan',
  'penatalayan',
  'tugas',
  'pengingat',
  'birthday',
  'materi',
] as const;

export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number];

export const NOTIFY_CATEGORY_LABEL: Record<string, string> = {
  announcement: 'Pengumuman',
  warta: 'Warta',
  kegiatan: 'Kegiatan',
  penatalayan: 'Penatalayan',
  tugas: 'Tugas & persetujuan',
  pengingat: 'Pengingat',
  birthday: 'Ulang tahun',
  materi: 'Materi ibadah',
};

export const PRIORITY_LABEL: Record<string, string> = {
  INFO: 'Info',
  TASK: 'Tugas',
  URGENT: 'Penting',
};
