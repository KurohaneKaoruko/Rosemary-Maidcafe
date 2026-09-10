'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { GameState, GameAction } from '@/types';
import { gameReducer } from '@/systems/gameReducer';
import { initialGameState } from '@/data/initialState';
import { loadGame, saveGame } from '@/utils/storage';

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [saveReady, setSaveReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrapLoad = async () => {
      try {
        const loaded = await loadGame();
        if (!cancelled && loaded.success && loaded.data) {
          dispatch({ type: 'LOAD_GAME', state: loaded.data });
        }
      } catch (error) {
        console.error('[GameProvider] Initial load error:', error);
      } finally {
        if (!cancelled) {
          setSaveReady(true);
        }
      }
    };

    void bootstrapLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  const stateRef = React.useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined' || !saveReady) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const result = await saveGame(stateRef.current);
          if (!result.success) {
            console.warn('[GameProvider] Auto-save failed:', result.error);
          }
        } catch (error) {
          console.error('[GameProvider] Auto-save error:', error);
        }
      })();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [saveReady]);

  useEffect(() => {
    if (!saveReady) {
      return;
    }

    const handleBeforeUnload = () => {
      void (async () => {
        try {
          const result = await saveGame(stateRef.current);
          if (!result.success) {
            console.warn('[GameProvider] Save on exit failed:', result.error);
          }
        } catch (error) {
          console.error('[GameProvider] Save on exit error:', error);
        }
      })();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveReady]);

  const contextValue: GameContextValue = {
    state,
    dispatch,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }

  return context;
}

export function useGameState(): GameState {
  const { state } = useGame();
  return state;
}

export function useGameDispatch(): React.Dispatch<GameAction> {
  const { dispatch } = useGame();
  return dispatch;
}

export default GameProvider;
