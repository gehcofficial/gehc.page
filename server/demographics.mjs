/** Age, BIPRA suggestion, birthday helpers for GEHC portal. */

const BIPRA_BANDS = {
  ANAK: { min: 0, max: 12 },
  REMAJA: { min: 13, max: 17 },
  PEMUDA: { min: 18, max: 35 },
};

export function ageFromBirthDate(birthDate, asOf = new Date()) {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

export function daysUntilBirthday(birthDate, asOf = new Date()) {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const next = new Date(asOf.getFullYear(), d.getMonth(), d.getDate());
  if (next < asOf) next.setFullYear(asOf.getFullYear() + 1);
  return Math.ceil((next.getTime() - asOf.getTime()) / 86400000);
}

export function isBirthdayWithinDays(birthDate, days = 30, asOf = new Date()) {
  const until = daysUntilBirthday(birthDate, asOf);
  return until !== null && until <= days;
}

export function suggestBipra({ birthDate, gender }) {
  const age = ageFromBirthDate(birthDate);
  if (age === null) return { suggested: null, confidence: 0, reason: 'Tanggal lahir belum diisi.' };

  if (age <= BIPRA_BANDS.ANAK.max) {
    return { suggested: 'ANAK', confidence: 0.95, reason: `Usia ${age} tahun → kategorial Anak.` };
  }
  if (age >= BIPRA_BANDS.REMAJA.min && age <= BIPRA_BANDS.REMAJA.max) {
    return { suggested: 'REMAJA', confidence: 0.95, reason: `Usia ${age} tahun → kategorial Remaja.` };
  }
  if (age >= BIPRA_BANDS.PEMUDA.min && age <= BIPRA_BANDS.PEMUDA.max) {
    return { suggested: 'PEMUDA', confidence: 0.9, reason: `Usia ${age} tahun → kategorial Pemuda.` };
  }
  if (age >= 36) {
    if (gender === 'LAKI-LAKI') {
      return { suggested: 'BAPAK', confidence: 0.7, reason: `Usia ${age} tahun → usulan Bapak (perlu konfirmasi admin).`, needsConfirm: true };
    }
    if (gender === 'PEREMPUAN') {
      return { suggested: 'IBU', confidence: 0.7, reason: `Usia ${age} tahun → usulan Ibu (perlu konfirmasi admin).`, needsConfirm: true };
    }
    return { suggested: 'PEMUDA', confidence: 0.5, reason: `Usia ${age} tahun — lengkapi gender untuk usulan Bapak/Ibu.`, needsConfirm: true };
  }
  return { suggested: 'PEMUDA', confidence: 0.5, reason: `Usia ${age} tahun.` };
}

export function suggestLifeStatuses(birthDate) {
  const age = ageFromBirthDate(birthDate);
  if (age === null) return [];
  if (age < 6) return ['CHILD'];
  if (age <= 12) return ['SCHOOL'];
  if (age <= 17) return ['SCHOOL'];
  if (age <= 24) return ['UNIVERSITY'];
  if (age <= 35) return ['WORK', 'UNIVERSITY'];
  return ['WORK', 'HOMEMAKER'];
}

export function enrichUserDemographics(user) {
  const age = ageFromBirthDate(user?.birthDate);
  const bipraSuggest = suggestBipra({ birthDate: user?.birthDate, gender: user?.gender });
  const daysToBirthday = daysUntilBirthday(user?.birthDate);
  return {
    age,
    daysToBirthday,
    bipraSuggest,
    lifeStatusHints: suggestLifeStatuses(user?.birthDate),
    bipraMismatch: user?.bipra && bipraSuggest.suggested && user.bipra !== bipraSuggest.suggested,
  };
}

export function parseBirthDateInput(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  if (d > now) return null;
  if (ageFromBirthDate(d) > 120) return null;
  return d;
}
