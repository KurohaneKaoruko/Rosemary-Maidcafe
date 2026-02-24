import { Maid } from '@/types';
import { maidImagePaths } from '@/assets/maid-image';

/**
 * 女仆图片池
 * 使用 assets 目录中的静态导入清单，供 Next Image 优化管线使用。
 */
export const maidImagePool: string[] = [...maidImagePaths];

/**
 * 获取随机未使用的女仆图片
 * @param excludeImages 要排除的图片路径数组（已被使用的图片）
 * @returns 随机选择的图片路径
 * Requirements: 1.2
 */
export function getRandomMaidImage(excludeImages: string[] = []): string {
  const available = maidImagePool.filter((img) => !excludeImages.includes(img));

  if (available.length === 0) {
    // 如果所有图片都用完了，从头开始随机选择
    return maidImagePool[Math.floor(Math.random() * maidImagePool.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * 获取所有已使用的女仆图片
 * @param maids 女仆数组
 * @returns 已使用的图片路径数组
 * Requirements: 1.3
 */
export function getAllUsedImages(maids: Maid[]): string[] {
  return maids.map((maid) => maid.avatar);
}
