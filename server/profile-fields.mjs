export const LIFE_STATUSES = ['SCHOOL', 'UNIVERSITY', 'WORK', 'HOMEMAKER', 'UNEMPLOYED', 'CHILD'];

export const WORK_INDUSTRIES = [
  'Manufaktur',
  'Logistik & Supply Chain',
  'Retail & FMCG',
  'F&B / Hospitality',
  'Kesehatan',
  'Pendidikan',
  'IT & Teknologi',
  'Konstruksi',
  'Perbankan & Keuangan',
  'Otomotif',
  'Properti & Real Estate',
  'Pemerintahan & BUMN',
  'Wirausaha / UMKM',
  'Lainnya',
];

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

export function composeAddress(p) {
  const scope = p.addressScope === 'INTL' ? 'INTL' : 'ID';
  if (scope === 'INTL') {
    const parts = [p.addressLine, p.city, p.addressCountry, p.postalCode].filter(Boolean);
    return parts.join(', ') || p.address || null;
  }
  const parts = [p.addressLine, p.village, p.district, p.city, p.province, p.postalCode].filter(Boolean);
  return parts.join(', ') || p.address || null;
}

export function reminderDue(user) {
  if (!user?.lastProfileUpdate) return true;
  const days = Number(user.profileReminderDays || 60);
  return Date.now() - new Date(user.lastProfileUpdate).getTime() > days * 86400000;
}

function contactComplete(user) {
  if (!user?.phone || !user?.gender) return false;
  const scope = user.addressScope === 'INTL' ? 'INTL' : 'ID';
  if (scope === 'INTL') {
    return Boolean(user.addressCountry && user.addressCountry !== 'ID' && user.city && user.addressLine);
  }
  return Boolean(
    (user.province || user.provinceCode) &&
      (user.city || user.cityCode) &&
      (user.addressLine || user.address)
  );
}

export function profileSegments(user) {
  const statuses = Array.isArray(user?.lifeStatuses) ? user.lifeStatuses : [];
  const contact = contactComplete(user);
  const life = statuses.length > 0;
  const majorVal = user?.major === 'Lainnya' ? user?.majorOther : user?.major;
  const uniOk = !statuses.includes('UNIVERSITY') || Boolean((user?.institutionId || user?.origin) && majorVal);
  const workOk = !statuses.includes('WORK') || Boolean(user?.workplaceName && user?.workIndustry);
  const schoolOk = !statuses.includes('SCHOOL') || Boolean(user?.schoolName);
  const gifts = Array.isArray(user?.giftsTop5) && user.giftsTop5.length > 0;
  const rec = Array.isArray(user?.recreationalIds)
    ? user.recreationalIds.length > 0
    : (user?.recreational || []).length > 0;
  const emergency = Boolean(user?.emergencyContactName && user?.emergencyContactPhone);
  return {
    contact: contact && uniOk && workOk && schoolOk,
    life,
    gifts,
    recreational: rec,
    emergency,
    identityChurch: Boolean(user?.bipra),
  };
}

export function applyLifeAddressFields(body, data) {
  const str = (v) => (v === null || v === '' ? null : String(v));
  const num = (v) => (v === null || v === '' || v === undefined ? null : Number(v));
  if (body.address !== undefined) data.address = str(body.address);
  if (body.addressLine !== undefined) data.addressLine = str(body.addressLine);
  if (body.village !== undefined) data.village = str(body.village);
  if (body.district !== undefined) data.district = str(body.district);
  if (body.city !== undefined) data.city = str(body.city);
  if (body.province !== undefined) data.province = str(body.province);
  if (body.postalCode !== undefined) data.postalCode = str(body.postalCode);
  if (body.lat !== undefined) data.lat = Number.isFinite(num(body.lat)) ? num(body.lat) : null;
  if (body.lng !== undefined) data.lng = Number.isFinite(num(body.lng)) ? num(body.lng) : null;
  if (body.placeId !== undefined) data.placeId = str(body.placeId);
  if (body.addressNote !== undefined) data.addressNote = str(body.addressNote);
  if (body.provinceCode !== undefined) data.provinceCode = str(body.provinceCode);
  if (body.cityCode !== undefined) data.cityCode = str(body.cityCode);
  if (body.districtCode !== undefined) data.districtCode = str(body.districtCode);
  if (body.villageCode !== undefined) data.villageCode = str(body.villageCode);
  if (body.addressScope !== undefined) {
    const scope = String(body.addressScope).toUpperCase() === 'INTL' ? 'INTL' : 'ID';
    data.addressScope = scope;
    if (scope === 'ID') {
      data.addressCountry = 'ID';
    }
  }
  if (body.addressCountry !== undefined) {
    const cc = String(body.addressCountry || '').toUpperCase().slice(0, 2);
    data.addressCountry = cc || null;
  }
  if (data.addressScope === 'ID') {
    data.addressCountry = 'ID';
  } else if (data.addressScope === 'INTL' && body.addressScope !== undefined) {
    data.province = null;
    data.provinceCode = null;
    data.district = null;
    data.districtCode = null;
    data.village = null;
    data.villageCode = null;
    data.cityCode = null;
  }
  if (body.origin !== undefined) data.origin = str(body.origin);
  if (body.lifeStatuses !== undefined) {
    if (!Array.isArray(body.lifeStatuses)) return 'lifeStatuses harus array.';
    const bad = body.lifeStatuses.filter((s) => !LIFE_STATUSES.includes(s));
    if (bad.length) return 'Status hidup tidak valid.';
    data.lifeStatuses = body.lifeStatuses;
  }
  if (body.schoolLevel !== undefined) data.schoolLevel = str(body.schoolLevel);
  if (body.schoolName !== undefined) data.schoolName = str(body.schoolName);
  if (body.institutionId !== undefined) data.institutionId = str(body.institutionId);
  if (body.major !== undefined) data.major = str(body.major);
  if (body.majorOther !== undefined) data.majorOther = str(body.majorOther);
  if (body.workplaceName !== undefined) data.workplaceName = str(body.workplaceName);
  if (body.workIndustry !== undefined) data.workIndustry = str(body.workIndustry);
  if (body.workRole !== undefined) data.workRole = str(body.workRole);
  if (body.workplacePlaceId !== undefined) data.workplacePlaceId = str(body.workplacePlaceId);
  if (body.emergencyContactName !== undefined) data.emergencyContactName = str(body.emergencyContactName);
  if (body.emergencyContactRelation !== undefined) data.emergencyContactRelation = str(body.emergencyContactRelation);
  if (body.emergencyContactPhone !== undefined) data.emergencyContactPhone = str(body.emergencyContactPhone);
  if (body.emergencyContactAddress !== undefined) data.emergencyContactAddress = str(body.emergencyContactAddress);
  if (data.addressLine || data.city || data.village || data.addressCountry) {
    data.address = composeAddress({ ...data, address: data.address });
  }
  return null;
}
