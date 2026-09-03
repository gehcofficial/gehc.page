/** Strip ACL tags from Drive folder names for UI. Keep real names in Drive. */

const TAG_CHUNK = /\s*\[[A-Za-z][A-Za-z0-9-]*(?::[^\]]+)?\]/gi;

export function displayFolderName(folderName: string | null | undefined): string {
  const raw = String(folderName || '');
  const cleaned = raw.replace(TAG_CHUNK, '').replace(/\s{2,}/g, ' ').trim();
  return cleaned || raw;
}
