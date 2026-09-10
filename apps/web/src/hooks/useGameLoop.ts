'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GameState, GameAction } from '@/types';
import { GAME_CONSTANTS } from '@/data/initialState';
import { requestNativeStaffingPatch } from '@/systems/nativeStaffingBridge';

interface GameLoopConfig {
  speedMultiplier?: number;
  tickInterval?: number;
}

export function useGameLoop(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  config: GameLoopConfig = {}
) {
  const { speedMultiplier = 1, tickInterval = 2000 } = config;

  const stateRef = useRef(state);
  const configRef = useRef({ speedMultiplier, tickInterval });
  const dispatchRef = useRef(dispatch);
  const nativePatchInFlightRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    configRef.current = { speedMultiplier, tickInterval };
  }, [speedMultiplier, tickInterval]);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  const resetTimers = useCallback(() => {}, []);

  useEffect(() => {
    let frameId: number;
    let lastTime = 0;
    let accumulated = 0;

    const loop = (currentTime: number) => {
      if (lastTime === 0) {
        lastTime = currentTime;
      }

      const currentState = stateRef.current;
      const { speedMultiplier: speed, tickInterval: interval } = configRef.current;

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (!currentState.isPaused && currentState.isBusinessHours) {
        accumulated += deltaTime * speed * currentState.gameSpeed;

        if (accumulated >= interval) {
          const tickCount = Math.floor(accumulated / interval);
          accumulated %= interval;

          if (tickCount > 0 && !nativePatchInFlightRef.current) {
            nativePatchInFlightRef.current = true;
            const snapshot = stateRef.current;
            void requestNativeStaffingPatch(snapshot, GAME_CONSTANTS.TIME_INCREMENT)
              .then((patch) => {
                if (patch) {
                  dispatchRef.current({ type: 'APPLY_NATIVE_STAFFING_PATCH', patch });
                }
              })
              .finally(() => {
                nativePatchInFlightRef.current = false;
              });
          }

          for (let i = 0; i < tickCount; i++) {
            dispatchRef.current({ type: 'TICK', deltaTime: interval });
          }
        }
      } else {
        accumulated = 0;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  const startLoop = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  const stopLoop = useCallback(() => {
    // loop lifetime is controlled by hook mount; pause is controlled by state
  }, []);

  return {
    startLoop,
    stopLoop,
    resetTimers,
  };
}

export default useGameLoop;
