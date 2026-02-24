'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { resolveMaidImage } from '@/assets/maid-image';

export type MaidAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface MaidAvatarProps {
  src: string;
  name: string;
  size?: MaidAvatarSize;
  className?: string;
  showFallback?: boolean;
}

const sizeConfig: Record<MaidAvatarSize, { container: string; width: number; height: number; fallbackText: string }> = {
  sm: { container: 'w-10 h-10', width: 40, height: 40, fallbackText: 'text-lg' },
  md: { container: 'w-16 h-16', width: 64, height: 64, fallbackText: 'text-2xl' },
  lg: { container: 'w-24 h-24', width: 96, height: 96, fallbackText: 'text-4xl' },
  xl: { container: 'w-32 h-32', width: 128, height: 128, fallbackText: 'text-5xl' },
};

/**
 * MaidAvatar - 女仆头像组件
 * 使用 Next.js Image 组件优化加载
 * 支持多种尺寸 (sm, md, lg, xl)
 * 添加圆角和阴影效果
 * 添加加载失败回退显示
 * 使用 loading="lazy" 实现图片懒加载
 * 
 * Requirements: 1.4, 1.5, 7.2
 */
export function MaidAvatar({
  src,
  name,
  size = 'md',
  className = '',
  showFallback = true,
}: MaidAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const config = sizeConfig[size];

  // Resolve legacy avatar path (e.g. /maid-image/xxxx.jpg) to a static import for Next optimization.
  const optimizedSource = src ? resolveMaidImage(src) : null;

  // Show fallback emoji if no valid image or error occurred
  if (!optimizedSource || hasError) {
    return (
      <div
        className={`
          ${config.container}
          rounded-full
          bg-gradient-to-br from-pink-100 to-pink-200
          flex items-center justify-center
          shadow-md
          border-2 border-white
          ${className}
        `}
        title={name}
      >
        <span className={config.fallbackText}>👧</span>
      </div>
    );
  }

  return (
    <div
      className={`
        ${config.container}
        relative
        rounded-full
        overflow-hidden
        shadow-md
        border-2 border-white
        bg-pink-50
        ${className}
      `}
      title={name}
    >
      {/* Loading placeholder */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-pink-50 animate-pulse">
          <span className={`${config.fallbackText} opacity-50`}>👧</span>
        </div>
      )}
      
      <Image
        src={optimizedSource}
        alt={name}
        width={config.width}
        height={config.height}
        className={`
          object-cover
          w-full h-full
          transition-opacity duration-300
          ${isLoading ? 'opacity-0' : 'opacity-100'}
        `}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        loading="lazy"
        placeholder="blur"
        sizes={`${config.width}px`}
      />
    </div>
  );
}

export default MaidAvatar;
