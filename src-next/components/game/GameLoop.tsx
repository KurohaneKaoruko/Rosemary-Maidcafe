'use client';

import { useEffect, useCallback } from 'react';
import { useGame } from './GameProvider';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useDesktopFloatingMode } from '@/hooks/useDesktopFloatingMode';
import { isFloatingWindowPanel } from '@/data/desktopUI';
import { PanelType } from '@/types';

interface GameLoopProps {
  speedMultiplier?: number;
  tickInterval?: number;
  onDayEnd?: () => void;
  onNewDay?: () => void;
}

export function GameLoop({
  speedMultiplier = 1,
  tickInterval = 1000,
}: GameLoopProps) {
  const { state, dispatch } = useGame();
  const desktopFloatingMode = useDesktopFloatingMode();

  const { resetTimers } = useGameLoop(state, dispatch, {
    speedMultiplier,
    tickInterval,
  });

  const togglePause = useCallback(() => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, [dispatch]);

  const openDesktopPanel = useCallback(
    (panel: PanelType) => {
      if (desktopFloatingMode && isFloatingWindowPanel(panel)) {
        dispatch({ type: 'OPEN_FLOATING_WINDOW', windowId: panel });
        if (state.activePanel === panel) {
          dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'cafe' });
        }
        return;
      }

      dispatch({ type: 'SET_ACTIVE_PANEL', panel });
    },
    [desktopFloatingMode, dispatch, state.activePanel]
  );

  useEffect(() => {
    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        togglePause();
        return;
      }

      if (desktopFloatingMode && event.ctrlKey && !event.repeat) {
        const shortcutPanelMap: Record<string, PanelType> = {
          Digit1: 'cafe',
          Digit2: 'maids',
          Digit3: 'menu',
          Digit4: 'facility',
          Digit5: 'finance',
          Digit6: 'tasks',
          Digit7: 'achievements',
          Digit8: 'settings',
        };
        const panel = shortcutPanelMap[event.code];
        if (panel) {
          event.preventDefault();
          openDesktopPanel(panel);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desktopFloatingMode, openDesktopPanel, togglePause]);

  void resetTimers;

  return null;
}

export function useGameLoopControls() {
  const { state, dispatch } = useGame();

  const togglePause = useCallback(() => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, [dispatch]);

  const endDay = useCallback(() => {
    dispatch({ type: 'END_DAY' });
  }, [dispatch]);

  const startNewDay = useCallback(() => {
    dispatch({ type: 'START_NEW_DAY' });
  }, [dispatch]);

  return {
    isPaused: state.isPaused,
    isBusinessHours: state.isBusinessHours,
    currentTime: state.time,
    currentDay: state.day,
    togglePause,
    endDay,
    startNewDay,
  };
}

export default GameLoop;
