/** Role yang menampilkan kartu selamat datang kelompok (Beyonders). */
export const WELCOME_ROLES = ['MENTEE', 'CO_MENTOR', 'MENTOR'] as const;

export function isWelcomeRole(role?: string | null): boolean {
  return WELCOME_ROLES.includes(String(role || '').toUpperCase() as (typeof WELCOME_ROLES)[number]);
}

export function welcomeDismissKey(userId: string, groupId: string): string {
  return `gehc_welcome_${userId}_${groupId}`;
}

/** Tampilkan kartu bila role Beyonders + punya grup + belum di-dismiss. */
export function shouldShowWelcome(opts: {
  role?: string | null;
  groupId?: string | null;
  dismissed?: boolean;
}): boolean {
  return isWelcomeRole(opts.role) && Boolean(opts.groupId) && !opts.dismissed;
}
