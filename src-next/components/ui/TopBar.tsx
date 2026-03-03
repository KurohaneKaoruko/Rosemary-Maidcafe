'use client';

import React from 'react';
import { useGame } from '@/components/game/GameProvider';
import { formatGameTime, formatGold, formatDay, getSeasonIcon, formatSeason, formatReputation } from '@/utils/formatters';
import { getServiceComboMultiplier, getServiceComboTier } from '@/systems/comboSystem';
import { SpeedControl } from './SpeedControl';

export function TopBar() {
  const { state, dispatch } = useGame();
  const { day, time, season, isPaused, finance, reputation, gameSpeed, runtime } = state;
  const customerStreak = runtime.customerStreak ?? 0;
  const comboTier = getServiceComboTier(customerStreak);
  const comboMultiplier = getServiceComboMultiplier(customerStreak);
  const showCombo = customerStreak >= 3;
  const displayReputation = formatReputation(reputation);

  const handleTogglePause = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  };

  const handleSpeedChange = (speed: typeof gameSpeed) => {
    dispatch({ type: 'SET_GAME_SPEED', speed });
  };

  return (
    <header className="bg-white border-b border-pink-100 px-2 sm:px-4 py-2 sm:py-3 shadow-sm flex-shrink-0">
      <div className="hidden sm:flex items-center justify-between max-w-7xl mx-auto gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
          <span className="font-medium text-gray-700 whitespace-nowrap">{formatDay(day)}</span>
          <span className="text-pink-200">|</span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <span>{getSeasonIcon(season)}</span>
            <span>{formatSeason(season)}</span>
          </span>
          <span className="text-pink-200">|</span>
          <span className="flex items-center gap-1.5 bg-pink-50 rounded-lg px-2.5 py-1 border border-pink-100">
            <span className="text-base">🕐</span>
            <span className="font-mono text-base font-semibold text-gray-800">{formatGameTime(time)}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SpeedControl currentSpeed={gameSpeed} onSpeedChange={handleSpeedChange} />
          <button
            onClick={handleTogglePause}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isPaused
                ? 'bg-pink-500 text-white border-pink-500'
                : 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200'
            }`}
            aria-label={isPaused ? '继续游戏' : '暂停游戏'}
          >
            {isPaused ? '继续' : '暂停'}
          </button>

          <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1 rounded-lg border border-yellow-100">
            <span className="text-lg">💰</span>
            <span className="font-semibold text-yellow-700">{formatGold(finance.gold)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
            <span className="text-lg">⭐</span>
            <span className="font-semibold text-purple-700">{displayReputation}</span>
          </div>
          {showCombo && (
            <div className="flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-lg border border-rose-100">
              <span className="text-lg">🔥</span>
              <span className="font-semibold text-rose-700">{customerStreak}连击</span>
              <span className="text-xs font-semibold text-rose-500">x{comboMultiplier.toFixed(2)}</span>
              <span className="text-xs text-rose-400">T{comboTier}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex sm:hidden flex-col gap-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
            <span className="font-medium text-gray-700 whitespace-nowrap">{formatDay(day)}</span>
            <span className="text-pink-200">|</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span>{getSeasonIcon(season)}</span>
              <span>{formatSeason(season)}</span>
            </span>
            <span className="text-pink-200">|</span>
            <span className="font-mono text-sm font-semibold text-gray-800 whitespace-nowrap">{formatGameTime(time)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <SpeedControl currentSpeed={gameSpeed} onSpeedChange={handleSpeedChange} compact />
            <button
              onClick={handleTogglePause}
              className={`touch-target flex items-center justify-center rounded-lg transition-all duration-150 active:scale-95 ${
                isPaused
                  ? 'bg-pink-500 text-white'
                  : 'bg-pink-100 text-pink-700 border border-pink-200'
              }`}
              aria-label={isPaused ? '继续游戏' : '暂停游戏'}
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-1 rounded-lg border border-yellow-100 flex-1 justify-center">
            <span className="text-sm">💰</span>
            <span className="font-semibold text-yellow-700 text-sm">{formatGold(finance.gold)}</span>
          </div>

          <div className="flex items-center gap-1 bg-purple-50 px-1.5 py-1 rounded-lg border border-purple-100 flex-1 justify-center">
            <span className="text-sm">⭐</span>
            <span className="font-semibold text-purple-700 text-sm">{displayReputation}</span>
          </div>

          {showCombo ? (
            <div className="flex items-center gap-1 bg-rose-50 px-1.5 py-1 rounded-lg border border-rose-100 flex-1 justify-center">
              <span className="text-sm">🔥</span>
              <span className="text-rose-700 text-sm font-semibold">{customerStreak}</span>
              <span className="text-rose-500 text-xs">x{comboMultiplier.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-1 rounded-lg border border-gray-100 flex-1 justify-center">
              <span className="text-sm">{getSeasonIcon(season)}</span>
              <span className="text-gray-600 text-sm font-medium">D{day}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default TopBar;
