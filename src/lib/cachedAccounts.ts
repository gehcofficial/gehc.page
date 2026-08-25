/**
 * Cached accounts — daftar akun yang pernah dipakai di perangkat ini
 * (ala Microsoft login). LRU maksimal 5, disimpan localStorage.
 */
export interface CachedAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  source: 'google' | 'demo';
}

const KEY = 'gehc_recent_accounts_v1';
const MAX = 5;

export function getCachedAccounts(): CachedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushCachedAccount(acct: CachedAccount) {
  if (!acct?.id || !acct.email) return;
  const list = getCachedAccounts().filter((a) => a.id !== acct.id);
  list.unshift(acct);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}
