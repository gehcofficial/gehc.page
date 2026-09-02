import { useEffect, useState } from 'react';

const KEY = 'gehc_our_people_unlocked';
const EVENT = 'gehc:our-people-unlocked';

export function isOurPeopleUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(KEY) === '1';
}

export function unlockOurPeople(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, '1');
  window.dispatchEvent(new Event(EVENT));
}

export function useOurPeopleUnlock() {
  const [unlocked, setUnlocked] = useState(isOurPeopleUnlocked);

  useEffect(() => {
    const sync = () => setUnlocked(isOurPeopleUnlocked());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return { unlocked, unlock: unlockOurPeople };
}
