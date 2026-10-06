import { describe, expect, it } from 'vitest';
import { nearestUpcoming } from '../../src/lib/event-select';

// 6 Okt 2026 12:00 WIB = 05:00 UTC
const NOW = Date.UTC(2026, 9, 6, 5, 0, 0);

const ev = (id: string, eventDate: string | null, status = 'PLANNING') => ({ id, eventDate, status });

describe('nearestUpcoming', () => {
  it('6 Okt → 11 Okt Rescue Plan, bukan 25 Okt', () => {
    const list = [
      ev('e25', '2026-10-25T03:00:00Z'),
      ev('e18', '2026-10-18T03:00:00Z'),
      ev('e11', '2026-10-11T03:00:00Z'),
      ev('e04', '2026-10-04T03:00:00Z', 'DONE'),
    ];
    expect(nearestUpcoming(list, NOW)?.id).toBe('e11');
  });

  it('melewati arsip walau tanggalnya terdekat', () => {
    const list = [ev('old', '2026-10-07T03:00:00Z', 'ARCHIVED'), ev('e11', '2026-10-11T03:00:00Z')];
    expect(nearestUpcoming(list, NOW)?.id).toBe('e11');
  });

  it('H-day sore masih kepilih (toleransi 12 jam)', () => {
    const evening = Date.UTC(2026, 9, 11, 14, 0, 0); // 11 Okt 21:00 WIB
    const list = [ev('e11', '2026-10-11T03:00:00Z'), ev('e18', '2026-10-18T03:00:00Z')];
    expect(nearestUpcoming(list, evening)?.id).toBe('e11');
  });

  it('semua lewat → yang terbaru lewat; kosong → null', () => {
    const past = Date.UTC(2026, 10, 1);
    const list = [ev('e04', '2026-10-04T03:00:00Z', 'DONE'), ev('e11', '2026-10-11T03:00:00Z')];
    expect(nearestUpcoming(list, past)?.id).toBe('e11');
    expect(nearestUpcoming([], NOW)).toBeNull();
  });

  it('tanpa tanggal pakai startDate; tanpa keduanya fallback urutan', () => {
    const list = [
      { id: 'a', status: 'PLANNING', startDate: '2026-10-25T03:00:00Z' },
      { id: 'b', status: 'PLANNING', startDate: '2026-10-11T03:00:00Z' },
    ];
    expect(nearestUpcoming(list, NOW)?.id).toBe('b');
    expect(nearestUpcoming([{ id: 'x', status: 'PLANNING' }], NOW)?.id).toBe('x');
  });
});
