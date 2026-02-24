'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { AchievementPanel } from '@/components/panels/AchievementPanel';
import { FinancePanel } from '@/components/panels/FinancePanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { TaskPanel } from '@/components/panels/TaskPanel';
import { FLOATING_WINDOW_IDS } from '@/data/desktopUI';
import { FloatingWindowId, FloatingWindowState } from '@/types';

interface FloatingWindowsLayerProps {
  enabled: boolean;
}

interface FloatingWindowCardProps {
  windowState: FloatingWindowState;
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onFocus: (windowId: FloatingWindowId) => void;
  onClose: (windowId: FloatingWindowId) => void;
  onMinimize: (windowId: FloatingWindowId) => void;
  onMove: (windowId: FloatingWindowId, x: number, y: number) => void;
  onResize: (windowId: FloatingWindowId, width: number, height: number) => void;
  children: React.ReactNode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function FloatingWindowCard({
  windowState,
  active,
  containerRef,
  onFocus,
  onClose,
  onMinimize,
  onMove,
  onResize,
  children,
}: FloatingWindowCardProps) {
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);
  const interactionModeRef = useRef<'drag' | 'resize' | null>(null);

  const getContainerBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerRef]);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (interactionModeRef.current === 'drag' && dragStartRef.current) {
        const dragStart = dragStartRef.current;
        const deltaX = event.clientX - dragStart.pointerX;
        const deltaY = event.clientY - dragStart.pointerY;
        const { width, height } = getContainerBounds();

        const maxX = Math.max(0, width - windowState.width);
        const maxY = Math.max(0, height - (windowState.minimized ? 48 : windowState.height));

        onMove(
          windowState.id,
          clamp(dragStart.originX + deltaX, 0, maxX),
          clamp(dragStart.originY + deltaY, 0, maxY)
        );
        return;
      }

      if (interactionModeRef.current === 'resize' && resizeStartRef.current) {
        const resizeStart = resizeStartRef.current;
        const deltaX = event.clientX - resizeStart.pointerX;
        const deltaY = event.clientY - resizeStart.pointerY;
        const { width, height } = getContainerBounds();

        const nextWidth = clamp(
          resizeStart.originWidth + deltaX,
          windowState.minWidth,
          Math.max(windowState.minWidth, width - windowState.x)
        );
        const nextHeight = clamp(
          resizeStart.originHeight + deltaY,
          windowState.minHeight,
          Math.max(windowState.minHeight, height - windowState.y)
        );

        onResize(windowState.id, nextWidth, nextHeight);
      }
    },
    [
      getContainerBounds,
      onMove,
      onResize,
      windowState.height,
      windowState.id,
      windowState.minHeight,
      windowState.minWidth,
      windowState.minimized,
      windowState.width,
      windowState.x,
      windowState.y,
    ]
  );

  const handleMouseUp = useCallback(() => {
    interactionModeRef.current = null;
    dragStartRef.current = null;
    resizeStartRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      handleMouseUp();
    };
  }, [handleMouseUp]);

  const startDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      onFocus(windowState.id);
      interactionModeRef.current = 'drag';
      dragStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: windowState.x,
        originY: windowState.y,
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp, onFocus, windowState.id, windowState.x, windowState.y]
  );

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onFocus(windowState.id);
      interactionModeRef.current = 'resize';
      resizeStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originWidth: windowState.width,
        originHeight: windowState.height,
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp, onFocus, windowState.height, windowState.id, windowState.width]
  );

  const handleFocus = useCallback(() => {
    onFocus(windowState.id);
  }, [onFocus, windowState.id]);

  return (
    <section
      className={`floating-window ${active ? 'floating-window--active' : ''}`}
      style={{
        left: `${windowState.x}px`,
        top: `${windowState.y}px`,
        width: `${windowState.width}px`,
        height: windowState.minimized ? 'auto' : `${windowState.height}px`,
        zIndex: windowState.zIndex,
      }}
      onMouseDown={handleFocus}
    >
      <header className="floating-window__titlebar" onMouseDown={startDrag}>
        <div className="floating-window__title">
          <span className="floating-window__title-dot" />
          <span>{windowState.title}</span>
        </div>
        <div className="floating-window__actions">
          <button
            type="button"
            className="floating-window__action"
            onClick={(event) => {
              event.stopPropagation();
              onMinimize(windowState.id);
            }}
            aria-label="最小化窗口"
          >
            _
          </button>
          <button
            type="button"
            className="floating-window__action floating-window__action--danger"
            onClick={(event) => {
              event.stopPropagation();
              onClose(windowState.id);
            }}
            aria-label="关闭窗口"
          >
            x
          </button>
        </div>
      </header>

      {!windowState.minimized && (
        <>
          <div className="floating-window__body">{children}</div>
          <button
            type="button"
            className="floating-window__resizer"
            onMouseDown={startResize}
            aria-label="调整窗口大小"
          />
        </>
      )}
    </section>
  );
}

function renderWindowContent(windowId: FloatingWindowId): React.ReactNode {
  switch (windowId) {
    case 'tasks':
      return <TaskPanel />;
    case 'achievements':
      return <AchievementPanel />;
    case 'finance':
      return <FinancePanel />;
    case 'settings':
      return <SettingsPanel />;
    default:
      return null;
  }
}

export function FloatingWindowsLayer({ enabled }: FloatingWindowsLayerProps) {
  const { state, dispatch } = useGame();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const windows = state.desktopUI.floatingWindows;
  const openWindows = useMemo(
    () =>
      FLOATING_WINDOW_IDS.map((windowId) => windows[windowId])
        .filter((windowState) => windowState.open)
        .sort((a, b) => a.zIndex - b.zIndex),
    [windows]
  );

  const minimizedWindows = openWindows.filter((windowState) => windowState.minimized);

  const handleFocus = useCallback(
    (windowId: FloatingWindowId) => {
      dispatch({ type: 'FOCUS_FLOATING_WINDOW', windowId });
    },
    [dispatch]
  );

  const handleClose = useCallback(
    (windowId: FloatingWindowId) => {
      dispatch({ type: 'CLOSE_FLOATING_WINDOW', windowId });
    },
    [dispatch]
  );

  const handleMinimize = useCallback(
    (windowId: FloatingWindowId) => {
      dispatch({ type: 'MINIMIZE_FLOATING_WINDOW', windowId });
    },
    [dispatch]
  );

  const handleMove = useCallback(
    (windowId: FloatingWindowId, x: number, y: number) => {
      dispatch({ type: 'MOVE_FLOATING_WINDOW', windowId, x, y });
    },
    [dispatch]
  );

  const handleResize = useCallback(
    (windowId: FloatingWindowId, width: number, height: number) => {
      dispatch({ type: 'RESIZE_FLOATING_WINDOW', windowId, width, height });
    },
    [dispatch]
  );

  const handleRestore = useCallback(
    (windowId: FloatingWindowId) => {
      dispatch({ type: 'RESTORE_FLOATING_WINDOW', windowId });
    },
    [dispatch]
  );

  if (!enabled || openWindows.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="floating-window-layer">
      {openWindows.map((windowState) => (
        <FloatingWindowCard
          key={windowState.id}
          windowState={windowState}
          active={windowState.id === state.desktopUI.activeWindowId}
          containerRef={containerRef}
          onFocus={handleFocus}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onMove={handleMove}
          onResize={handleResize}
        >
          {renderWindowContent(windowState.id)}
        </FloatingWindowCard>
      ))}

      {minimizedWindows.length > 0 && (
        <div className="floating-window-dock" aria-label="最小化窗口栏">
          {minimizedWindows.map((windowState) => (
            <button
              key={windowState.id}
              type="button"
              className="floating-window-dock__item"
              onClick={() => handleRestore(windowState.id)}
            >
              {windowState.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FloatingWindowsLayer;
