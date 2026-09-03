export const initialsAvatar = (name: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || '?')}&backgroundColor=1b1b1b`;

export function displayAvatar(name?: string | null, avatar?: string | null) {
  const url = String(avatar || '').trim();
  if (url) return url;
  return initialsAvatar(name || '?');
}
