import { describe, expect, it } from 'vitest';
import {
  registrationFromWaitingPool,
  registrationFromAttendee,
  summarizeRegistrations,
  registrationsToCsv,
} from '../../server/lib/event-registrations.mjs';

describe('event registrations mapper', () => {
  it('maps counter waiting-pool rows without a portal account', () => {
    const row = registrationFromWaitingPool({
      id: 'wp-1',
      userId: null,
      name: 'Ayu Counter',
      email: null,
      phone: '081234',
      origin: 'Sulut · Manado',
      status: 'REGISTERED',
      registeredAt: '2026-09-01T00:00:00.000Z',
    });
    expect(row.hasAccount).toBe(false);
    expect(row.name).toBe('Ayu Counter');
    expect(row.phone).toBe('081234');
    expect(row.statusLabel).toBe('Counter (nama & WA)');
    expect(row.source).toBe('waiting_pool');
  });

  it('prefers linked user profile over waiting-pool snapshot', () => {
    const row = registrationFromWaitingPool({
      id: 'wp-2',
      userId: 'u-1',
      name: 'Nama Lama',
      email: 'lama@example.com',
      phone: '080000',
      status: 'WAITING_POOL',
      user: { name: 'Nama Baru', email: 'baru@example.com', phone: '081111' },
    });
    expect(row.hasAccount).toBe(true);
    expect(row.name).toBe('Nama Baru');
    expect(row.email).toBe('baru@example.com');
    expect(row.phone).toBe('081111');
    expect(row.statusLabel).toBe('Menunggu profil');
  });

  it('maps EventAttendee rows for non-BAKU TAU events', () => {
    const row = registrationFromAttendee({
      id: 'ea-1',
      userId: 'u-2',
      registeredAt: '2026-09-02T00:00:00.000Z',
      user: { name: 'Budi', email: 'budi@gehc.demo', phone: null, origin: null },
    });
    expect(row.source).toBe('event_attendee');
    expect(row.hasAccount).toBe(true);
    expect(row.status).toBe('ATTENDEE');
  });

  it('summarizes account vs counter the same way public QR count works', () => {
    const rows = [
      registrationFromWaitingPool({ id: 'a', userId: 'u1', name: 'A', status: 'ROLE_ASSIGNED' }),
      registrationFromWaitingPool({ id: 'b', userId: null, name: 'B', status: 'REGISTERED' }),
      registrationFromWaitingPool({ id: 'c', userId: null, name: 'C', status: 'REGISTERED' }),
    ];
    expect(summarizeRegistrations(rows)).toEqual({ total: 3, withAccount: 1, counterOnly: 2 });
  });

  it('exports CSV with counter rows included', () => {
    const csv = registrationsToCsv([
      registrationFromWaitingPool({
        id: 'wp-csv',
        userId: null,
        name: 'Nama, Koma',
        phone: '0812',
        origin: 'Sulut · Minahasa Selatan',
        status: 'REGISTERED',
        registeredAt: '2026-09-01T00:00:00.000Z',
      }),
    ]);
    expect(csv).toContain('nama,email,wa,asal');
    expect(csv).toContain('"Nama, Koma"');
    expect(csv).toContain('tidak');
    expect(csv).toContain('Counter (nama & WA)');
  });
});
