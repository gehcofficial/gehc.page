export const LIFE_STATUSES = ['SCHOOL', 'UNIVERSITY', 'WORK', 'HOMEMAKER', 'UNEMPLOYED', 'CHILD'] as const;
export type LifeStatus = (typeof LIFE_STATUSES)[number];

export const LIFE_STATUS_LABEL: Record<LifeStatus, string> = {
  SCHOOL: 'Sekolah',
  UNIVERSITY: 'Kuliah',
  WORK: 'Bekerja',
  HOMEMAKER: 'Mengurus rumah',
  UNEMPLOYED: 'Belum bekerja',
  CHILD: 'Anak / belum sekolah',
};

export const COMMON_MAJORS = [
  'Teknik Informatika / Ilmu Komputer',
  'Sistem Informasi',
  'Teknik Industri',
  'Teknik Sipil',
  'Teknik Mesin',
  'Teknik Elektro',
  'Manajemen',
  'Akuntansi',
  'Hukum',
  'Psikologi',
  'Kedokteran',
  'Keperawatan',
  'Farmasi',
  'Desain Komunikasi Visual',
  'Ilmu Komunikasi',
  'Hubungan Internasional',
  'Pendidikan',
  'Teologi',
  'Lainnya',
];

export const PROVINCES_ID = [
  'Jawa Barat',
  'DKI Jakarta',
  'Banten',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Sumatera Utara',
  'Sulawesi Utara',
  'Maluku',
  'Lainnya',
];

export function reminderDue(user: {
  lastProfileUpdate?: string | Date | null;
  profileReminderDays?: number | null;
}): boolean {
  if (!user?.lastProfileUpdate) return true;
  const days = Number(user.profileReminderDays || 60);
  return Date.now() - new Date(user.lastProfileUpdate).getTime() > days * 86400000;
}

export function profileSegments(user: Record<string, unknown>) {
  const statuses = Array.isArray(user?.lifeStatuses) ? (user.lifeStatuses as string[]) : [];
  const scope = user?.addressScope === 'INTL' ? 'INTL' : 'ID';
  const contactBase = Boolean(user?.phone && user?.gender);
  const contactAddr =
    scope === 'INTL'
      ? Boolean(user?.addressCountry && user.addressCountry !== 'ID' && user?.city && user?.addressLine)
      : Boolean(
          (user?.province || user?.provinceCode) &&
            (user?.city || user?.cityCode) &&
            (user?.addressLine || user?.address)
        );
  const contact = contactBase && contactAddr;
  const life = statuses.length > 0;
  const uniOk = !statuses.includes('UNIVERSITY') || Boolean(user?.institutionId || user?.origin);
  const workOk = !statuses.includes('WORK') || Boolean(user?.workplaceName);
  const schoolOk = !statuses.includes('SCHOOL') || Boolean(user?.schoolName);
  const gifts = Array.isArray(user?.giftsTop5) && (user.giftsTop5 as unknown[]).length > 0;
  const rec = Array.isArray(user?.recreational)
    ? (user.recreational as unknown[]).length > 0
    : Array.isArray(user?.recreationalIds) && (user.recreationalIds as unknown[]).length > 0;
  const emergency = Boolean(user?.emergencyContactName && user?.emergencyContactPhone);
  return { contact: contact && uniOk && workOk && schoolOk, life, gifts, recreational: rec, emergency };
}
