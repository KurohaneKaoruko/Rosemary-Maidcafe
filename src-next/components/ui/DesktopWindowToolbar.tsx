'use client';

import React, { useCallback, useMemo } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { DESKTOP_TOOLBAR_WINDOW_IDS, FLOATING_WINDOW_TITLES } from '@/data/desktopUI';
import { FloatingWindowId } from '@/types';

interface DesktopWindowToolbarProps {
  enabled: boolean;
}

function getWindowIcon(windowId: FloatingWindowId): string {
  switch (windowId) {
    case 'tasks':
      return 'M';
    case 'achievements':
      return 'A';
    case 'finance':
      return 'F';
    case 'settings':
      return 'S';
    default:
      return '?';
  }
}

export function DesktopWindowToolbar({ enabled }: DesktopWindowToolbarProps) {
  const { state, dispatch } = useGame();

  const windowStates = state.desktopUI.floatingWindows;

  const windowItems = useMemo(
    () =>
      DESKTOP_TOOLBAR_WINDOW_IDS.map((windowId) => ({
        windowId,
        title: FLOATING_WINDOW_TITLES[windowId],
        icon: getWindowIcon(windowId),
        state: windowStates[windowId],
      })),
    [windowStates]
  );

  const handleWindowClick = useCallback(
    (windowId: FloatingWindowId) => {
      const windowState = windowStates[windowId];
      if (!windowState.open) {
        dispatch({ type: 'OPEN_FLOATING_WINDOW', windowId });
        return;
      }
      if (windowState.minimized) {
        dispatch({ type: 'RESTORE_FLOATING_WINDOW', windowId });
        return;
      }
      dispatch({ type: 'FOCUS_FLOATING_WINDOW', windowId });
    },
    [dispatch, windowStates]
  );

  const handleArrangeWindows = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const shellOffsetTop = 116;
    const shellPadding = 22;

    let offsetX = 0;
    let offsetY = 0;

    for (const { windowId, state: windowState } of windowItems) {
      if (!windowState.open) {
        continue;
      }

      const maxWidth = Math.max(windowState.minWidth, viewportWidth - shellPadding * 2);
      const maxHeight = Math.max(windowState.minHeight, viewportHeight - shellOffsetTop - 40);
      const targetWidth = Math.min(windowState.width, maxWidth);
      const targetHeight = Math.min(windowState.height, maxHeight);

      const targetX = Math.max(0, Math.min(shellPadding + offsetX, viewportWidth - targetWidth));
      const targetY = Math.max(
        0,
        Math.min(shellOffsetTop + offsetY, viewportHeight - targetHeight - shellPadding)
      );

      dispatch({ type: 'RESIZE_FLOATING_WINDOW', windowId, width: targetWidth, height: targetHeight });
      dispatch({ type: 'MOVE_FLOATING_WINDOW', windowId, x: targetX, y: targetY });
      dispatch({ type: 'FOCUS_FLOATING_WINDOW', windowId });

      offsetX += 34;
      offsetY += 26;
    }
  }, [dispatch, windowItems]);

  const handleMinimizeAll = useCallback(() => {
    for (const { windowId, state: windowState } of windowItems) {
      if (windowState.open && !windowState.minimized) {
        dispatch({ type: 'MINIMIZE_FLOATING_WINDOW', windowId });
      }
    }
  }, [dispatch, windowItems]);

  if (!enabled) {
    return null;
  }

  return (
    <section className="desktop-window-toolbar" aria-label="窗口管理">
      <div className="desktop-window-toolbar__group">
        {windowItems.map(({ windowId, title, icon, state: windowState }) => {
          const isActive =
            windowState.open &&
            !windowState.minimized &&
            state.desktopUI.activeWindowId === windowId;
          const isMinimized = windowState.open && windowState.minimized;

          return (
            <button
              key={windowId}
              type="button"
              className={`desktop-window-toolbar__item ${isActive ? 'active' : ''} ${isMinimized ? 'minimized' : ''}`}
              onClick={() => handleWindowClick(windowId)}
              title={title}
            >
              <span className="desktop-window-toolbar__icon">{icon}</span>
              <span className="desktop-window-toolbar__text">{title}</span>
            </button>
          );
        })}
      </div>

      <div className="desktop-window-toolbar__actions">
        <button type="button" className="desktop-window-toolbar__arrange" onClick={handleArrangeWindows}>
          整理窗口
        </button>
        <button type="button" className="desktop-window-toolbar__arrange" onClick={handleMinimizeAll}>
          全部收起
        </button>
      </div>
    </section>
  );
}

export default DesktopWindowToolbar;
