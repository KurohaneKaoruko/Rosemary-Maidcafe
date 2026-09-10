'use client';

import React, { useState } from 'react';
import { Achievement } from '@/types';
import { useGame } from '@/components/game/GameProvider';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

type FilterType = 'all' | 'unlocked' | 'locked';

const conditionTypeLabels: Record<string, string> = {
  totalCustomersServed: '服务顾客',
  totalRevenue: '累计收入',
  totalDaysPlayed: '经营天数',
  maidsHired: '雇佣女仆',
  totalTipsEarned: '累计小费',
  perfectServicesCount: '完美服务',
};

const conditionTypeIcons: Record<string, string> = {
  totalCustomersServed: '👥',
  totalRevenue: '💰',
  totalDaysPlayed: '📅',
  maidsHired: '👧',
  totalTipsEarned: '💵',
  perfectServicesCount: '⭐',
};

export function AchievementPanel() {
  const { state } = useGame();
  const [filter, setFilter] = useState<FilterType>('all');

  const { achievements, statistics } = state;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  const filteredAchievements = achievements.filter((achievement) => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return achievement.unlocked;
    if (filter === 'locked') return !achievement.unlocked;
    return true;
  });

  // Group achievements by condition type
  const groupedAchievements = filteredAchievements.reduce((groups, achievement) => {
    const type = achievement.condition.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(achievement);
    return groups;
  }, {} as Record<string, Achievement[]>);

  // Get current value for a condition type
  const getCurrentValue = (type: string): number => {
    const statsMap: Record<string, number> = {
      totalCustomersServed: statistics.totalCustomersServed,
      totalRevenue: statistics.totalRevenue,
      totalDaysPlayed: statistics.totalDaysPlayed,
      totalTipsEarned: statistics.totalTipsEarned,
      perfectServicesCount: statistics.perfectServicesCount,
      maidsHired: statistics.maidsHired,
    };
    return statsMap[type] || 0;
  };

  return (
    <div className="min-h-full flex min-w-0 flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      {/* Top Meta: title comes from floating window frame */}
      <div className="flex items-center justify-end">
        <div className="text-xs text-gray-500 sm:text-sm">
          已解锁 {unlockedCount} / {totalCount}
        </div>
      </div>
      {/* Progress Overview */}
      <Card>
        <CardBody>
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <div className="shrink-0 text-3xl sm:text-4xl">🏆</div>
            <div className="min-w-[160px] flex-1">
              <div className="text-sm text-gray-500 mb-1">成就进度</div>
              <ProgressBar
                value={unlockedCount}
                max={totalCount}
                color="yellow"
                size="lg"
                showLabel
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2 sm:gap-3">
        <AchievementStatItem label="服务顾客" value={statistics.totalCustomersServed} icon="👥" />
        <AchievementStatItem label="累计收入" value={statistics.totalRevenue} icon="💰" />
        <AchievementStatItem label="经营天数" value={statistics.totalDaysPlayed} icon="📅" />
        <AchievementStatItem label="雇佣女仆" value={statistics.maidsHired} icon="👧" />
        <AchievementStatItem label="累计小费" value={statistics.totalTipsEarned} icon="💵" />
        <AchievementStatItem label="完美服务" value={statistics.perfectServicesCount} icon="⭐" />
      </div>

      {/* Filter Buttons */}
      <div className="grid min-w-0 grid-cols-3 gap-2">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`全部 (${totalCount})`}
        />
        <FilterButton
          active={filter === 'unlocked'}
          onClick={() => setFilter('unlocked')}
          label={`已解锁 (${unlockedCount})`}
          color="green"
        />
        <FilterButton
          active={filter === 'locked'}
          onClick={() => setFilter('locked')}
          label={`未解锁 (${totalCount - unlockedCount})`}
          color="gray"
        />
      </div>

      {/* Achievements List */}
      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-4">
        {Object.entries(groupedAchievements).map(([type, typeAchievements]) => (
          <Card key={type}>
            <CardHeader>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0">{conditionTypeIcons[type] || '🎯'}</span>
                <span className="min-w-0 truncate">{conditionTypeLabels[type] || type}</span>
                <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500 sm:text-sm">
                  ({typeAchievements.filter((a) => a.unlocked).length}/{typeAchievements.length})
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
                {typeAchievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    currentValue={getCurrentValue(achievement.condition.type)}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        ))}

        {filteredAchievements.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🏆</div>
            <p>没有符合条件的成就</p>
          </div>
        )}
      </div>
    </div>
  );
}


function AchievementStatItem({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2.5 py-2.5 sm:px-3 sm:py-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-base text-pink-600">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] text-gray-500 sm:text-xs">{label}</div>
          <div className="truncate text-base font-bold text-gray-800 sm:text-lg">{value}</div>
        </div>
      </div>
    </div>
  );
}


// Filter Button Component
interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: 'pink' | 'green' | 'gray';
}

function FilterButton({ active, onClick, label, color = 'pink' }: FilterButtonProps) {
  const activeColors = {
    pink: 'bg-pink-500 text-white',
    green: 'bg-green-500 text-white',
    gray: 'bg-gray-500 text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex h-full w-full min-w-0 items-center justify-center rounded-lg px-2.5 py-1.5 text-center text-xs font-medium leading-tight transition-colors sm:px-3 sm:py-2 sm:text-sm
        ${active
          ? activeColors[color]
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }
      `}
    >
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}

// Achievement Card Component
interface AchievementCardProps {
  achievement: Achievement;
  currentValue: number;
}

function AchievementCard({ achievement, currentValue }: AchievementCardProps) {
  const { unlocked, name, description, reward, condition, unlockedDate } = achievement;
  const progress = Math.min((currentValue / condition.target) * 100, 100);

  return (
    <div
      className={`
        min-w-0 rounded-xl border-2 p-3 transition-all sm:p-4
        ${unlocked
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-gray-100 bg-gray-50'
        }
      `}
    >
      <div className="flex min-w-0 items-start gap-3">
        {/* Icon */}
        <div className={`
          shrink-0 rounded-xl p-2 text-2xl
          ${unlocked
            ? 'bg-yellow-100'
            : 'bg-gray-200 grayscale'
          }
        `}>
          {unlocked ? '🏆' : '🔒'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className={`font-medium truncate ${
              unlocked
                ? 'text-yellow-700'
                : 'text-gray-700'
            }`}>
              {name}
            </h4>
            {unlocked && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800">
                ✓
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-0.5">
            {description}
          </p>

          {/* Progress */}
          {!unlocked && (
            <div className="mt-2">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>进度</span>
                <span>{currentValue} / {condition.target}</span>
              </div>
              <ProgressBar
                value={currentValue}
                max={condition.target}
                color={progress >= 100 ? 'green' : 'blue'}
                size="sm"
              />
            </div>
          )}

          {/* Reward */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
            <span className={`text-sm ${
              unlocked ? 'text-yellow-600' : 'text-gray-500'
            }`}>
              奖励: 💰 {reward}
            </span>
            {unlocked && unlockedDate && (
              <span className="shrink-0 text-xs text-gray-400">
                {new Date(unlockedDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AchievementPanel;


