export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'success' | 'celebrate';

export const DEFAULT_AVATAR_GLB = '/avatars/worksyzo-bot.glb';

/** Kept for API compatibility — mascot is built-in, no GLB required. */
export function resolveAvatarUrl(url?: string): string {
  return DEFAULT_AVATAR_GLB;
}
