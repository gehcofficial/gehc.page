import { useQuery } from '@tanstack/react-query';

export function useWaitingPoolCount(enabled = true) {
  return useQuery({
    queryKey: ['waiting-pool-count'],
    enabled,
    queryFn: async () => {
      const r = await fetch('/api/waiting-pool', { credentials: 'include' });
      if (!r.ok) return 0;
      const d = await r.json();
      const pool = d.pool || d.entries || [];
      return Array.isArray(pool) ? pool.length : 0;
    },
  });
}

export type BirthdayWeek = {
  birthdays: Array<{ id: string; name: string; avatar?: string | null; birthDate?: string; daysToBirthday: number }>;
  weekStart: string;
  weekEnd: string;
  todayCount: number;
};

export function useUpcomingBirthdays(enabled = true) {
  return useQuery<BirthdayWeek>({
    queryKey: ['birthdays-week'],
    enabled,
    queryFn: async () => {
      const r = await fetch('/api/portal/birthdays/upcoming', { credentials: 'include' });
      if (!r.ok) return { birthdays: [], weekStart: '', weekEnd: '', todayCount: 0 };
      const d = await r.json();
      return {
        birthdays: d.birthdays || [],
        weekStart: d.weekStart || '',
        weekEnd: d.weekEnd || '',
        todayCount: d.todayCount || 0,
      };
    },
  });
}
