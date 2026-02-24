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

type InteractionMode = 'drag' | 'resize' | null;

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

  const interactionModeRef = useRef<InteractionMode>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const captureElementRef = useRef<HTMLElement | null>(null);
  const latestWindowStateRef = useRef(windowState);
  const onMoveRef = useRef(onMove);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    latestWindowStateRef.current = windowState;
  }, [windowState]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const getContainerBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerRef]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      const currentWindow = latestWindowStateRef.current;

      if (interactionModeRef.current === 'drag' && dragStartRef.current) {
        const dragStart = dragStartRef.current;
        const deltaX = event.clientX - dragStart.pointerX;
        const deltaY = event.clientY - dragStart.pointerY;
        const { width, height } = getContainerBounds();

        const maxX = Math.max(0, width - currentWindow.width);
        const maxY = Math.max(0, height - (currentWindow.minimized ? 48 : currentWindow.height));

        onMoveRef.current(
          currentWindow.id,
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
          currentWindow.minWidth,
          Math.max(currentWindow.minWidth, width - currentWindow.x)
        );
        const nextHeight = clamp(
          resizeStart.originHeight + deltaY,
          currentWindow.minHeight,
          Math.max(currentWindow.minHeight, height - currentWindow.y)
        );

        onResizeRef.current(currentWindow.id, nextWidth, nextHeight);
      }
    },
    [getContainerBounds]
  );

  const handlePointerUp = useCallback(
    (event?: PointerEvent) => {
      if (event && activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }

      const previousMode = interactionModeRef.current;
      const previousPointerId = activePointerIdRef.current;
      const captureElement = captureElementRef.current;

      if (
        captureElement &&
        previousPointerId !== null &&
        captureElement.hasPointerCapture(previousPointerId)
      ) {
        captureElement.releasePointerCapture(previousPointerId);
      }
      captureElementRef.current = null;

      if (previousMode === 'drag' && dragStartRef.current) {
        const currentWindow = latestWindowStateRef.current;
        const { width, height } = getContainerBounds();
        const maxX = Math.max(0, width - currentWindow.width);
        const maxY = Math.max(0, height - (currentWindow.minimized ? 48 : currentWindow.height));
        const snapThreshold = 14;

        let snappedX = currentWindow.x;
        let snappedY = currentWindow.y;

        if (snappedX <= snapThreshold) {
          snappedX = 0;
        } else if (snappedX >= maxX - snapThreshold) {
          snappedX = maxX;
        }

        if (snappedY <= snapThreshold) {
          snappedY = 0;
        } else if (snappedY >= maxY - snapThreshold) {
          snappedY = maxY;
        }

        if (snappedX !== currentWindow.x || snappedY !== currentWindow.y) {
          onMoveRef.current(currentWindow.id, snappedX, snappedY);
        }
      }

      interactionModeRef.current = null;
      activePointerIdRef.current = null;
      dragStartRef.current = null;
      resizeStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = '';
    },
    [getContainerBounds, handlePointerMove]
  );

  useEffect(() => {
    return () => {
      handlePointerUp();
    };
  }, [handlePointerUp]);

  const startDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('button')) {
        return;
      }

      event.preventDefault();

      const currentWindow = latestWindowStateRef.current;
      onFocus(currentWindow.id);

      interactionModeRef.current = 'drag';
      activePointerIdRef.current = event.pointerId;
      captureElementRef.current = event.currentTarget;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: currentWindow.x,
        originY: currentWindow.y,
      };

      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, onFocus]
  );

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const currentWindow = latestWindowStateRef.current;
      onFocus(currentWindow.id);

      interactionModeRef.current = 'resize';
      activePointerIdRef.current = event.pointerId;
      captureElementRef.current = event.currentTarget;
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originWidth: currentWindow.width,
        originHeight: currentWindow.height,
      };

      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, onFocus]
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
      onPointerDown={handleFocus}
    >
      <header className="floating-window__titlebar" onPointerDown={startDrag}>
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
            onPointerDown={startResize}
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

  useEffect(() => {
    if (!enabled || openWindows.length === 0) {
      return;
    }

    let rafId = 0;

    const normalizeWindowBounds = () => {
      const container = containerRef.current;
      const bounds = container?.getBoundingClientRect();
      const viewportWidth = bounds ? bounds.width : window.innerWidth;
      const viewportHeight = bounds ? bounds.height : window.innerHeight;

      for (const windowState of openWindows) {
        const maxWidth = Math.max(windowState.minWidth, viewportWidth - 20);
        const maxHeight = Math.max(windowState.minHeight, viewportHeight - 20);
        const nextWidth = clamp(windowState.width, windowState.minWidth, maxWidth);
        const nextHeight = clamp(windowState.height, windowState.minHeight, maxHeight);

        const maxX = Math.max(0, viewportWidth - nextWidth);
        const maxY = Math.max(0, viewportHeight - (windowState.minimized ? 50 : nextHeight));
        const nextX = clamp(windowState.x, 0, maxX);
        const nextY = clamp(windowState.y, 0, maxY);

        if (nextWidth !== windowState.width || nextHeight !== windowState.height) {
          dispatch({
            type: 'RESIZE_FLOATING_WINDOW',
            windowId: windowState.id,
            width: nextWidth,
            height: nextHeight,
          });
        }

        if (nextX !== windowState.x || nextY !== windowState.y) {
          dispatch({
            type: 'MOVE_FLOATING_WINDOW',
            windowId: windowState.id,
            x: nextX,
            y: nextY,
          });
        }
      }
    };

    const scheduleNormalize = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(normalizeWindowBounds);
    };

    scheduleNormalize();
    window.addEventListener('resize', scheduleNormalize);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', scheduleNormalize);
    };
  }, [dispatch, enabled, openWindows]);

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
