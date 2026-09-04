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

export function useUpcomingBirthdays(days = 7, enabled = true) {
  return useQuery({
    queryKey: ['birthdays-upcoming', days],
    enabled,
    queryFn: async () => {
      const r = await fetch(`/api/portal/birthdays/upcoming?days=${days}`, { credentials: 'include' });
      if (!r.ok) return [];
      const d = await r.json();
      return d.birthdays || [];
    },
  });
}
