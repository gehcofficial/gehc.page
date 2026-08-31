export const BAKU_TAU_SOURCE_EVENT = 'BAKU TAU 4.0';
export const BAKU_TAU_EVENT_ID = 'evt-baku-tau-4-0';
export const BAKU_TAU_EVENT_DATE_ISO = '2026-09-12T15:00:00+07:00';
export const BAKU_TAU_VENUE_NAME = 'GMIM Eben Haezer Cikarang';
export const BAKU_TAU_VENUE_TIME = '15.00 WIB';
export const BAKU_TAU_LOCATION_DETAIL = `${BAKU_TAU_VENUE_NAME} · ${BAKU_TAU_VENUE_TIME}`;
export const BAKU_TAU_MAP_URL = 'https://share.google/Ro2jBSuGfrzfg49nP';
export const BAKU_TAU_MAP_EMBED_QUERY = 'GMIM Eben Haezer Cikarang, Cikarang, Bekasi';

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export function isValidWhatsAppUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/(chat\.whatsapp\.com\/|wa\.me\/)/i.test(url.trim());
}

export function whatsappGroupUrlFromEnv() {
  const url = process.env.BAKU_TAU_WA_GROUP_URL?.trim();
  return isValidWhatsAppUrl(url) ? url : null;
}
