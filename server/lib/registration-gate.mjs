import { tenantForWrite } from './tenant-scope.mjs';

export const REGISTRATION_CLOSED_MESSAGE = 'Pendaftaran akun baru sedang ditutup untuk unit ini. Ikuti waitlist event terdekat ya!';

/** Env global: `REGISTRATION_OPEN=false` menutup semua unit. */
export function envRegistrationOpen() {
  return process.env.REGISTRATION_OPEN !== 'false';
}

/**
 * Registrasi akun baru hanya bila env mengizinkan DAN baris Tenant host
 * `isActive` + `registrationOpen`. Tanpa baris tenant = tertutup (default skema).
 */
export async function tenantRegistrationOpen(prisma, req) {
  if (!envRegistrationOpen()) return false;
  const tenantId = tenantForWrite(req);
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { registrationOpen: true, isActive: true },
  }).catch(() => null);
  if (!row || row.isActive === false) return false;
  return Boolean(row.registrationOpen);
}
