/** Shared role and status chip colors */
export const ROLE_CHIP_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-gray-900 text-white',
  KOMISI: 'bg-indigo-100 text-indigo-700',
  COMMITTEE: 'bg-cyan-100 text-cyan-700',
  BPMJ: 'bg-blue-100 text-blue-700',
  MENTOR: 'bg-emerald-100 text-emerald-700',
  CO_MENTOR: 'bg-emerald-100 text-emerald-700',
  MENTEE: 'bg-emerald-100 text-emerald-700',
  ALUMNI: 'bg-slate-100 text-slate-500',
  neutral: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-100 text-amber-800',
  success: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REVISED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  INDIVIDU: 'bg-purple-100 text-purple-700',
};
