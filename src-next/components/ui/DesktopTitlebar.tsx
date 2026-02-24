'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { formatDay, formatGameTime } from '@/utils/formatters';
import { isTauriDesktop } from '@/utils/platform';

type TauriWindowModule = typeof import('@tauri-apps/api/window');
type AppWindow = ReturnType<TauriWindowModule['getCurrentWindow']>;

export function DesktopTitlebar() {
  const { state } = useGame();
  const [enabled, setEnabled] = useState(false);
  const [appWindow, setAppWindow] = useState<AppWindow | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setEnabled(isTauriDesktop());
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;
    let unlisten: (() => void) | undefined;

    (async () => {
      const windowModule = await import('@tauri-apps/api/window');
      const currentWindow = windowModule.getCurrentWindow();
      if (!mounted) {
        return;
      }

      setAppWindow(currentWindow);

      try {
        const maximized = await currentWindow.isMaximized();
        if (mounted) {
          setIsMaximized(maximized);
        }
      } catch {
        // Ignore state sync failures on non-tauri preview targets.
      }

      unlisten = await currentWindow.onResized(async () => {
        try {
          const maximized = await currentWindow.isMaximized();
          if (mounted) {
            setIsMaximized(maximized);
          }
        } catch {
          // Ignore transient resize query errors.
        }
      });
    })();

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [enabled]);

  const titleMeta = useMemo(() => {
    return `${formatDay(state.day)} · ${formatGameTime(state.time)}`;
  }, [state.day, state.time]);

  const handleMinimize = useCallback(async () => {
    if (!appWindow) {
      return;
    }
    await appWindow.minimize();
  }, [appWindow]);

  const handleToggleMaximize = useCallback(async () => {
    if (!appWindow) {
      return;
    }
    await appWindow.toggleMaximize();
    const maximized = await appWindow.isMaximized();
    setIsMaximized(maximized);
  }, [appWindow]);

  const handleClose = useCallback(async () => {
    if (!appWindow) {
      return;
    }
    await appWindow.close();
  }, [appWindow]);

  if (!enabled) {
    return null;
  }

  return (
    <header className="desktop-titlebar">
      <div className="desktop-titlebar__drag" data-tauri-drag-region>
        <span className="desktop-titlebar__dot" />
        <span className="desktop-titlebar__name">迷迭香咖啡厅</span>
      </div>

      <div className="desktop-titlebar__meta" data-tauri-drag-region>
        {titleMeta}
      </div>

      <div className="desktop-titlebar__controls" aria-label="窗口控制">
        <button type="button" onClick={handleMinimize} className="desktop-control" aria-label="最小化">
          -
        </button>
        <button type="button" onClick={handleToggleMaximize} className="desktop-control" aria-label="最大化">
          {isMaximized ? '◱' : '□'}
        </button>
        <button type="button" onClick={handleClose} className="desktop-control desktop-control--danger" aria-label="关闭">
          x
        </button>
      </div>
    </header>
  );
}

export default DesktopTitlebar;
