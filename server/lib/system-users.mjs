/**
 * Akun teknis di tabel users — bukan orang jemaat.
 */
export const SYSTEM_USER_IDS = ['usr-platform-ops', 'usr-tech'];

export function isSystemAccount(user) {
  if (!user) return false;
  if (SYSTEM_USER_IDS.includes(user.id)) return true;
  if (user.accountKind === 'SYSTEM_LEGACY') return true;
  if (String(user.loginUsername || '').toLowerCase() === 'platform.ops') return true;
  return false;
}

/** Prisma `where` untuk daftar/hitungan jemaat. */
export function congregationUserWhere() {
  return {
    AND: [
      { id: { notIn: SYSTEM_USER_IDS } },
      { accountKind: { not: 'SYSTEM_LEGACY' } },
    ],
  };
}
