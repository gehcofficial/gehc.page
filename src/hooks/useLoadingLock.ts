import { useEffect } from 'react';

/**
 * Standar pengunci interaksi saat loading (anti swipe/scroll/klik ganda).
 * Aman dipakai bertumpuk (counter ref) — scroll kembali hanya bila semua
 * overlay sudah hilang.
 */
let lockCount = 0;
let prevOverflow = '';

function lock() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlock() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = prevOverflow;
}

export function useLoadingLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    // Kunci sentuh & roda pada seluruh dokumen selama overlay aktif.
    // `passive: false` agar preventDefault() diizinkan browser.
    const stop = (e: Event) => { e.preventDefault(); };
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('wheel', stop, { passive: false });
    return () => {
      document.removeEventListener('touchmove', stop);
      document.removeEventListener('wheel', stop);
      unlock();
    };
  }, [active]);
}
