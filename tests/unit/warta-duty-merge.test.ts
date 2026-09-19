import { describe, expect, it } from 'vitest';
import { mergeDutiesByName } from '../../src/components/public/WartaServiceDutySection';

const duty = (name: string, role: string, timeStart?: string) => ({
  date: '2026-09-20',
  role,
  name,
  timeStart: timeStart || null,
});

describe('mergeDutiesByName', () => {
  it('menggabungkan multi-role satu nama sesuai urutan jadwal', () => {
    const out = mergeDutiesByName([
      duty('Holly Kalele', 'Liturgist', '13:00'),
      duty('Holly Kalele', 'Worship Leader', '13:00'),
    ]);
    expect(out).toEqual([{ name: 'Holly Kalele', roles: ['Liturgist', 'Worship Leader'] }]);
  });

  it('mempertahankan urutan kemunculan nama', () => {
    const out = mergeDutiesByName([
      duty('Chelsea Tjheuw', 'Pembaca Firman'),
      duty('Holly Kalele', 'Liturgist'),
      duty('Aditya Wellem', 'Worship Leader'),
      duty('Aditya Wellem', 'Liturgist'),
    ]);
    expect(out.map((p) => p.name)).toEqual(['Chelsea Tjheuw', 'Holly Kalele', 'Aditya Wellem']);
    expect(out[2].roles).toEqual(['Worship Leader', 'Liturgist']);
  });

  it('tidak menggandakan role yang sama', () => {
    const out = mergeDutiesByName([
      duty('Timothy Mewengkang', 'Pemusik'),
      duty('Timothy Mewengkang', 'Pemusik'),
    ]);
    expect(out).toEqual([{ name: 'Timothy Mewengkang', roles: ['Pemusik'] }]);
  });
});
