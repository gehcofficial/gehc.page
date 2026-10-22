/**
 * Rencana folder foto Creative Lab.
 * Tidak pernah me-rename atau memindahkan folder bertag ([MENTOR], [GROUP:], [EV:]).
 */

export const LAB_PHOTO_BUCKET = {
  GROUP: 'Foto Kelompok',
  ART: 'Hasil Karya',
};

export function bucketForPhotoKind(kind) {
  return String(kind || '').toUpperCase() === 'GROUP' ? LAB_PHOTO_BUCKET.GROUP : LAB_PHOTO_BUCKET.ART;
}

/** Nama folder polos. Tag ACL di nama masukan dibuang supaya tidak ikut tercipta. */
export function plainFolderName(name) {
  return String(name || '')
    .replace(/\s*\[[^\]]+\]/g, '')
    .replace(/[\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function pickFolderByName(folders, name) {
  const want = String(name || '').trim().toLowerCase();
  if (!want) return null;
  const matches = (Array.isArray(folders) ? folders : [])
    .filter((f) => String(f?.name || '').trim().toLowerCase() === want);
  return matches[0] || null;
}

/** Folder event yang namanya memuat tag [EV:<slug>:DIDASKALIA]. Yang pertama dipakai; tidak ada rename. */
export function pickEventFolder(folders, slug) {
  const tag = `[ev:${String(slug || '').trim().toLowerCase()}:didaskalia]`;
  if (tag === '[ev::didaskalia]') return null;
  const matches = (Array.isArray(folders) ? folders : [])
    .filter((f) => String(f?.name || '').toLowerCase().includes(tag));
  return matches[0] || null;
}
