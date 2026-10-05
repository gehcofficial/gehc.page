import { describe, expect, it } from 'vitest';
import { syncPetugasAttendance } from '../../server/lib/petugas-attendance.mjs';

function fakeDb(seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  const byKey = new Map(rows.map((r) => [`${r.eventId}:${r.userId}`, r]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const api = {
    eventAttendee: {
      findUnique: async ({ where }) => {
        const k = where.eventId_userId;
        return byKey.get(`${k.eventId}:${k.userId}`) || null;
      },
      create: async ({ data }) => {
        const row = { ...data };
        byKey.set(`${row.eventId}:${row.userId}`, row);
        byId.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = byId.get(where.id);
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }) => {
        const row = byId.get(where.id);
        byKey.delete(`${row.eventId}:${row.userId}`);
        byId.delete(where.id);
        return row;
      },
    },
  };
  return { db: api, byKey };
}

const SCHED = { id: 'ss-1', eventId: 'ev-1', userId: 'u-1', roleName: 'Tuan Rumah', status: 'CONFIRMED' };

describe('petugas-attendance: konfirmasi', () => {
  it('baris baru → auto (daftar + hadir + penanda)', async () => {
    const { db, byKey } = fakeDb();
    const out = await syncPetugasAttendance(db, { schedule: SCHED, from: 'SCHEDULED', actorId: 'koord' });
    expect(out.action).toBe('auto');
    const row = byKey.get('ev-1:u-1');
    expect(row.checkedInAt).toBeTruthy();
    expect(row.checkedInById).toBe('koord');
    expect(row.metadata.autoPetugas.registeredByAuto).toBe(true);
    expect(row.metadata.autoPetugas.scheduleId).toBe('ss-1');
  });

  it('sudah daftar manual (belum hadir) → auto-filled, bukan registeredByAuto', async () => {
    const { db, byKey } = fakeDb([{ id: 'ea-1', eventId: 'ev-1', userId: 'u-1', checkedInAt: null, metadata: {} }]);
    const out = await syncPetugasAttendance(db, { schedule: SCHED, from: 'SCHEDULED', actorId: 'koord' });
    expect(out.action).toBe('auto-filled');
    expect(byKey.get('ev-1:u-1').metadata.autoPetugas.registeredByAuto).toBe(false);
  });

  it('sudah scan manual → kept-manual (tidak tertimpa)', async () => {
    const at = new Date('2026-10-04T10:00:00Z');
    const { db } = fakeDb([{ id: 'ea-1', eventId: 'ev-1', userId: 'u-1', checkedInAt: at, metadata: {} }]);
    const out = await syncPetugasAttendance(db, { schedule: SCHED, from: 'SCHEDULED', actorId: 'koord' });
    expect(out.action).toBe('kept-manual');
  });

  it('tanpa eventId → dilewati (ibadah mingguan)', async () => {
    const { db } = fakeDb();
    const out = await syncPetugasAttendance(db, {
      schedule: { ...SCHED, eventId: null },
      from: 'SCHEDULED',
      actorId: 'koord',
    });
    expect(out.action).toBe('skipped-no-event');
  });
});

describe('petugas-attendance: batal / kembalikan', () => {
  it('baris auto → dihapus (revoked)', async () => {
    const { db, byKey } = fakeDb([{
      id: 'ea-1', eventId: 'ev-1', userId: 'u-1', checkedInAt: new Date(),
      metadata: { autoPetugas: { scheduleId: 'ss-1', registeredByAuto: true } },
    }]);
    const out = await syncPetugasAttendance(db, {
      schedule: { ...SCHED, status: 'CANCELLED' }, from: 'CONFIRMED', actorId: 'koord',
    });
    expect(out.action).toBe('revoked');
    expect(byKey.has('ev-1:u-1')).toBe(false);
  });

  it('baris manual + hadir auto (tanpa scan) → hadir dibersihkan', async () => {
    const { db, byKey } = fakeDb([{
      id: 'ea-1', eventId: 'ev-1', userId: 'u-1', checkedInAt: new Date(), checkedInById: 'koord',
      metadata: { autoPetugas: { scheduleId: 'ss-1', registeredByAuto: false } },
    }]);
    const out = await syncPetugasAttendance(db, {
      schedule: { ...SCHED, status: 'SCHEDULED' }, from: 'CONFIRMED', actorId: 'koord',
    });
    expect(out.action).toBe('revoked-hadir');
    expect(byKey.get('ev-1:u-1').checkedInAt).toBeNull();
    expect(byKey.get('ev-1:u-1').metadata.autoPetugas).toBeUndefined();
  });

  it('sudah scan manual setelah auto → dipertahankan', async () => {
    const at = new Date('2026-10-04T10:05:00Z');
    const { db, byKey } = fakeDb([{
      id: 'ea-1', eventId: 'ev-1', userId: 'u-1', checkedInAt: at,
      metadata: { autoPetugas: { scheduleId: 'ss-1', registeredByAuto: false }, manualScan: true },
    }]);
    const out = await syncPetugasAttendance(db, {
      schedule: { ...SCHED, status: 'CANCELLED' }, from: 'CONFIRMED', actorId: 'koord',
    });
    expect(out.action).toBe('kept-manual-scan');
    expect(byKey.get('ev-1:u-1').checkedInAt).toEqual(at);
  });

  it('jadwal lain / tanpa penanda → none', async () => {
    const { db } = fakeDb([{ id: 'ea-1', eventId: 'ev-1', userId: 'u-1', checkedInAt: new Date(), metadata: {} }]);
    const out = await syncPetugasAttendance(db, {
      schedule: { ...SCHED, status: 'SCHEDULED' }, from: 'CONFIRMED', actorId: 'koord',
    });
    expect(out.action).toBe('none');
  });
});
