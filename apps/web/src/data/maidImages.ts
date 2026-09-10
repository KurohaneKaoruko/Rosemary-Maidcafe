import { maidImagePaths, normalizeMaidImagePath } from '@/assets/maid-image';
import { Maid } from '@/types';

export const maidImagePool: string[] = [...maidImagePaths];

export function normalizeMaidAvatarPath(path: string): string {
  return normalizeMaidImagePath(path);
}

export function getRandomMaidImage(excludeImages: string[] = []): string {
  const excluded = new Set(excludeImages.map(normalizeMaidAvatarPath).filter(Boolean));
  const available = maidImagePool.filter((img) => !excluded.has(img));

  if (available.length === 0) {
    return maidImagePool[Math.floor(Math.random() * maidImagePool.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

export function getAllUsedImages(maids: Maid[]): string[] {
  return maids
    .map((maid) => normalizeMaidAvatarPath(maid.avatar))
    .filter((avatar): avatar is string => Boolean(avatar));
}
