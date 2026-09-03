import {
  BAKU_TAU_EVENT_DATE_ISO,
  BAKU_TAU_VENUE_NAME,
  BAKU_TAU_LOCATION_DETAIL,
  BAKU_TAU_MAP_URL,
  BAKU_TAU_MAP_EMBED_QUERY,
} from './baku-tau.mjs';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const BAKU_TAU_FALLBACK = {
  eventDate: BAKU_TAU_EVENT_DATE_ISO,
  venueName: BAKU_TAU_VENUE_NAME,
  locationDetail: BAKU_TAU_LOCATION_DETAIL,
  mapUrl: BAKU_TAU_MAP_URL,
  mapEmbedQuery: BAKU_TAU_MAP_EMBED_QUERY,
};

const EMPTY_VENUE = {
  eventDate: null,
  venueName: null,
  locationDetail: null,
  mapUrl: null,
  mapEmbedQuery: null,
};

/** Format instant sebagai ISO wall-clock WIB, mis. 2026-09-12T15:00:00+07:00. */
export function toWibIso(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const wib = new Date(d.getTime() + WIB_OFFSET_MS);
  return `${wib.toISOString().slice(0, 19)}+07:00`;
}

/** Tanggal kalender WIB (YYYY-MM-DD) dari instant — untuk kolom DATE content_items. */
export function wibDateOnly(value) {
  const iso = toWibIso(value);
  return iso ? iso.slice(0, 10) : null;
}

/**
 * Venue & waktu acara: DB lebih dulu, konstanta BAKU TAU sebagai fallback.
 *
 * Fallback dipertahankan supaya mengosongkan kolom di DB otomatis memulihkan
 * tampilan lama tanpa perlu deploy — jalur rollback termurah.
 */
export function venueOf(event, isBakutau = false) {
  const fallback = isBakutau ? BAKU_TAU_FALLBACK : EMPTY_VENUE;
  return {
    eventDate: toWibIso(event?.eventDate) || fallback.eventDate,
    venueName: event?.venueName || fallback.venueName,
    locationDetail: event?.locationDetail || fallback.locationDetail,
    mapUrl: event?.mapUrl || fallback.mapUrl,
    mapEmbedQuery: event?.mapEmbedQuery || fallback.mapEmbedQuery,
  };
}
