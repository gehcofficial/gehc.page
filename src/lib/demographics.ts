export function ageFromBirthDate(birthDate: string | Date | null | undefined, asOf = new Date()): number | null {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

export function daysUntilBirthday(birthDate: string | Date | null | undefined, asOf = new Date()): number | null {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const next = new Date(asOf.getFullYear(), d.getMonth(), d.getDate());
  if (next < asOf) next.setFullYear(asOf.getFullYear() + 1);
  return Math.ceil((next.getTime() - asOf.getTime()) / 86400000);
}

export function suggestBipra(birthDate: string | Date | null | undefined, gender?: string | null) {
  const age = ageFromBirthDate(birthDate);
  if (age === null) return { suggested: null as string | null, reason: 'Tanggal lahir belum diisi.', needsConfirm: false };
  if (age <= 12) return { suggested: 'ANAK', reason: `Usia ${age} tahun`, needsConfirm: false };
  if (age <= 17) return { suggested: 'REMAJA', reason: `Usia ${age} tahun`, needsConfirm: false };
  if (age <= 35) return { suggested: 'PEMUDA', reason: `Usia ${age} tahun`, needsConfirm: false };
  if (gender === 'LAKI-LAKI') return { suggested: 'BAPAK', reason: `Usia ${age} tahun`, needsConfirm: true };
  if (gender === 'PEREMPUAN') return { suggested: 'IBU', reason: `Usia ${age} tahun`, needsConfirm: true };
  return { suggested: 'PEMUDA', reason: `Usia ${age} tahun — lengkapi gender`, needsConfirm: true };
}

export function formatBirthDateInput(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
