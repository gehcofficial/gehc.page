/** Akun tanpa status eksplisit dianggap ACTIVE (baris lama / objek sesi parsial). */
export function isActiveAccount(user) {
  const status = user?.accountStatus;
  if (status == null || status === '') return true;
  return String(status).toUpperCase() === 'ACTIVE';
}
