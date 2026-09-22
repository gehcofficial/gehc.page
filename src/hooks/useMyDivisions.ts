import { useEffect, useState } from 'react';

/** Divisi pengguna (dari struktur/role assignment) untuk gating nav per-divisi. */
export function useMyDivisions(): { divisions: string[]; loading: boolean } {
  const [divisions, setDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/divisions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.divisions)) setDivisions(d.divisions.map(String).map((x: string) => x.toUpperCase()));
      })
      .catch(() => { /* abaikan */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { divisions, loading };
}
