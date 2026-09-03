import { describe, expect, it } from 'vitest';
import { BAKU_TAU_EVENT_DATE_ISO, BAKU_TAU_VENUE_NAME } from '../../server/lib/baku-tau.mjs';
import { toWibIso, venueOf, wibDateOnly } from '../../server/lib/event-venue.mjs';

describe('zona waktu BAKU TAU', () => {
  it('ISO beroffset 15:00 WIB = instant 08:00 UTC', () => {
    expect(new Date(BAKU_TAU_EVENT_DATE_ISO).toISOString()).toBe('2026-09-12T08:00:00.000Z');
  });

  it('string DATETIME naif 15:00 dibaca Prisma sebagai UTC = 22:00 WIB', () => {
    expect(toWibIso('2026-09-12T15:00:00.000Z')).toBe('2026-09-12T22:00:00+07:00');
  });

  it('instant hasil backfill tampil lagi sebagai 15:00 WIB', () => {
    expect(toWibIso(new Date('2026-09-12T08:00:00.000Z'))).toBe('2026-09-12T15:00:00+07:00');
  });

  it('tanggal kalender WIB tidak mundur sehari', () => {
    expect(wibDateOnly(new Date('2026-09-12T08:00:00.000Z'))).toBe('2026-09-12');
    expect(wibDateOnly(new Date('2026-09-12T00:00:00+07:00'))).toBe('2026-09-12');
  });
});

describe('venueOf', () => {
  it('event kosong + BAKU TAU memakai konstanta', () => {
    const v = venueOf(null, true);
    expect(v.eventDate).toBe(BAKU_TAU_EVENT_DATE_ISO);
    expect(v.venueName).toBe(BAKU_TAU_VENUE_NAME);
    expect(v.mapUrl).toBeTruthy();
  });

  it('event non-BAKU TAU tanpa kolom tidak mengisi fallback', () => {
    expect(venueOf(null, false)).toEqual({
      eventDate: null,
      venueName: null,
      locationDetail: null,
      mapUrl: null,
      mapEmbedQuery: null,
    });
  });

  it('kolom DB mengalahkan konstanta dan JSON publik tetap +07:00', () => {
    const v = venueOf({
      eventDate: new Date('2026-09-12T08:00:00.000Z'),
      venueName: 'Aula GEHC',
      locationDetail: 'Aula · 16.00 WIB',
      mapUrl: 'https://maps.example/x',
      mapEmbedQuery: 'Aula GEHC',
    }, true);
    expect(v.eventDate).toBe('2026-09-12T15:00:00+07:00');
    expect(v.venueName).toBe('Aula GEHC');
    expect(v.locationDetail).toBe('Aula · 16.00 WIB');
    expect(v.mapUrl).toBe('https://maps.example/x');
    expect(v.mapEmbedQuery).toBe('Aula GEHC');
  });

  it('mengosongkan eventDate mengembalikan konstanta (rollback tanpa deploy)', () => {
    const v = venueOf({ eventDate: null, venueName: null }, true);
    expect(v.eventDate).toBe(BAKU_TAU_EVENT_DATE_ISO);
    expect(v.venueName).toBe(BAKU_TAU_VENUE_NAME);
  });
});
