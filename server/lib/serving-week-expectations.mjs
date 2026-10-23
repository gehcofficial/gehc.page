/**
 * Minggu GESER yang sudah dipindah ke tanggal lain tetap menghabiskan satu slot rotasi 10 grup.
 */
export function geserConsumesRotationSlot(override, movedAssignment) {
  if (!override || String(override.condition || '').toUpperCase() !== 'GESER') return false;
  if (!override.newEventDate || !movedAssignment) return false;
  return true;
}
