'use client';

import React from 'react';
import { GameSpeed } from '@/types';

interface SpeedControlProps {
  currentSpeed: GameSpeed;
  onSpeedChange: (speed: GameSpeed) => void;
  compact?: boolean;
}

const speedOptions: { value: GameSpeed; label: string; icon: string }[] = [
  { value: 0.5, label: '0.5x', icon: '🐢' },
  { value: 1, label: '1x', icon: '🚶' },
  { value: 2, label: '2x', icon: '🚀' },
  { value: 4, label: '4x', icon: '⚡' },
];

export function SpeedControl({ currentSpeed, onSpeedChange, compact = false }: SpeedControlProps) {
  const currentIndex = speedOptions.findIndex((option) => option.value === currentSpeed);
  const safeIndex = currentIndex >= 0 ? currentIndex : 1;
  const currentOption = speedOptions[safeIndex];
  const nextOption = speedOptions[(safeIndex + 1) % speedOptions.length];

  const handleToggleSpeed = () => {
    onSpeedChange(nextOption.value);
  };

  return (
    <button
      type="button"
      onClick={handleToggleSpeed}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors ${
        compact
          ? 'px-2 py-1 text-xs border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
          : 'px-3 py-2 text-sm border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
      aria-label={`游戏速度 ${currentOption.label}，点击切换到 ${nextOption.label}`}
      title={`当前 ${currentOption.label}，点击切换到 ${nextOption.label}`}
    >
      <span>{currentOption.icon}</span>
      <span>{currentOption.label}</span>
    </button>
  );
}

export default SpeedControl;
