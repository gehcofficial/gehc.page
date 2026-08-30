import { UserRole } from '../types';

/**
 * Precedensi peran (revision-v2-beyonders.md §1 + keputusan multi-role).
 * Semakin kecil angka = semakin tinggi wewenang. Akun rangkap memakai
 * peran tertinggi secara default; pengguna bisa mengganti "topeng" aktif.
 */
export const ROLE_PRECEDENCE: Record<UserRole, number> = {
  SUPERADMIN: 1,
  BPMJ: 2,
  KOMISI: 3,
  COMMITTEE: 4,
  MENTOR: 5,
  CO_MENTOR: 6,
  MENTEE: 7,
  ALUMNI: 8,
};

export function uniqueRolesByName<T extends { role: UserRole }>(roles: T[]): T[] {
  const byRole = new Map<UserRole, T>();
  for (const r of roles) {
    if (!byRole.has(r.role)) byRole.set(r.role, r);
  }
  return [...byRole.values()];
}

export function sortRoles<T extends { role: UserRole }>(roles: T[]): T[] {
  return [...roles].sort((a, b) => ROLE_PRECEDENCE[a.role] - ROLE_PRECEDENCE[b.role]);
}

export function highestRole(roles: UserRole[]): UserRole | null {
  if (!roles.length) return null;
  return [...roles].sort((a, b) => ROLE_PRECEDENCE[a] - ROLE_PRECEDENCE[b])[0];
}

/** Role efektif: override bila valid, kalau tidak pakai precedensi tertinggi. */
export function effectiveRole(owned: UserRole[], override: UserRole | null): UserRole {
  const ownedSorted = highestRole(owned);
  if (override && owned.includes(override)) return override;
  return ownedSorted ?? 'MENTEE';
}

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: 'Superadmin',
  BPMJ: 'BPMJ',
  KOMISI: 'Komisi Pemuda',
  COMMITTEE: 'Tim Kerja',
  MENTOR: 'Mentor',
  CO_MENTOR: 'Co-Mentor',
  MENTEE: 'Mentee',
  ALUMNI: 'Alumni',
};
