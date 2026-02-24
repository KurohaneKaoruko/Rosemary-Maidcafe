'use client';

import { useCallback, useEffect, useState } from 'react';
import { isTauriDesktop } from '@/utils/platform';

type AppWindow = {
  isFullscreen: () => Promise<boolean>;
  setFullscreen: (fullscreen: boolean) => Promise<void>;
  onResized: (handler: () => void) => Promise<() => void>;
};

async function getTauriWindow(): Promise<AppWindow | null> {
  if (!isTauriDesktop()) {
    return null;
  }

  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

function isElementFullscreen(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return Boolean(document.fullscreenElement);
}

export function useFullscreenMode() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    const init = async () => {
      const tauriWindow = await getTauriWindow();
      if (!mounted) {
        return;
      }

      if (tauriWindow) {
        const syncFullscreenState = async () => {
          try {
            const fullscreen = await tauriWindow.isFullscreen();
            if (mounted) {
              setIsFullscreen(fullscreen);
            }
          } catch {
            // Ignore transient Tauri state query errors.
          }
        };

        await syncFullscreenState();
        const unlistenResized = await tauriWindow.onResized(() => {
          void syncFullscreenState();
        });
        cleanup = () => {
          unlistenResized();
        };

        return;
      }

      const handleFullscreenChange = () => {
        if (mounted) {
          setIsFullscreen(isElementFullscreen());
        }
      };

      setIsFullscreen(isElementFullscreen());
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      cleanup = () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    };

    void init();

    return () => {
      mounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const tauriWindow = await getTauriWindow();
      if (tauriWindow) {
        const next = !(await tauriWindow.isFullscreen());
        await tauriWindow.setFullscreen(next);
        setIsFullscreen(next);
        return;
      }

      if (typeof document === 'undefined') {
        return;
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // Ignore fullscreen API failures and keep current UI state.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      const tauriWindow = await getTauriWindow();
      if (tauriWindow) {
        await tauriWindow.setFullscreen(false);
        setIsFullscreen(false);
        return;
      }

      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen API failures and keep current UI state.
    }
  }, []);

  return {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
  };
}

export default useFullscreenMode;
