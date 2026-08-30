export const initialsAvatar = (name: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || '?')}&backgroundColor=1b1b1b`;
