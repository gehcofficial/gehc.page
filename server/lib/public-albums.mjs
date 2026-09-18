/**
 * Album kelompok yang boleh tampil publik.
 * Aturan (ketat & eksplisit): hanya album berstatus SELESAI **dan** sudah
 * ditandai `showOnLanding` oleh mentor kelompok/Komisi. Default: privat.
 */

export const PUBLIC_ALBUM_STATUS = 'SELESAI';

export function isAlbumPublic(row) {
  if (!row) return false;
  return String(row.status || '') === PUBLIC_ALBUM_STATUS && row.showOnLanding === true;
}

export function filterPublicAlbums(rows) {
  return (rows || []).filter(isAlbumPublic);
}

/** Urutkan album publik: terbaru dulu. */
export function sortPublicAlbums(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = a?.occurredOn ? new Date(a.occurredOn).getTime() : 0;
    const tb = b?.occurredOn ? new Date(b.occurredOn).getTime() : 0;
    return tb - ta;
  });
}

/** Serialize ringkas untuk konsumsi publik (tanpa Drive folder / data internal). */
export function serializePublicAlbum(row, { groupName = null, coverUrl = null, previews = [] } = {}) {
  return {
    id: row.id,
    groupId: row.groupId,
    groupName,
    title: row.title,
    kind: row.kind || 'ADHOC',
    occurredOn: row.occurredOn || null,
    location: row.location || null,
    publishedAt: row.publishedAt || null,
    coverUrl,
    previews,
  };
}
