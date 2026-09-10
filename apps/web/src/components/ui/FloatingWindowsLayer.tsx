'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { CustomerDetailPanel } from '@/components/cafe/CustomerDetailPanel';
import { MaidDetailPanel } from '@/components/cafe/MaidDetailPanel';
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

function toPixel(value: number): number {
  return Math.round(value);
}

const FLOATING_WINDOW_TITLEBAR_HEIGHT = 42;
const FLOATING_WINDOW_VISIBLE_TITLE_MIN_WIDTH = 140;
const FLOATING_WINDOW_MIN_VIEWPORT_WIDTH = 320;
const FLOATING_WINDOW_MIN_VIEWPORT_HEIGHT = 260;

function getFloatingDragBounds(
  windowWidth: number,
  windowHeight: number,
  containerWidth: number,
  containerHeight: number
) {
  const visibleTitleWidth = Math.min(
    windowWidth,
    FLOATING_WINDOW_VISIBLE_TITLE_MIN_WIDTH,
    Math.max(32, containerWidth)
  );
  const visibleTitleHeight = Math.min(
    FLOATING_WINDOW_TITLEBAR_HEIGHT,
    Math.max(24, containerHeight)
  );

  return {
    minX: -Math.max(0, windowWidth - visibleTitleWidth),
    maxX: Math.max(0, containerWidth - visibleTitleWidth),
    minY: -Math.max(0, windowHeight - visibleTitleHeight),
    maxY: Math.max(0, containerHeight - visibleTitleHeight),
  };
}

function FloatingWindowEmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="floating-window-empty">
      <div className="floating-window-empty__icon" aria-hidden>
        {icon}
      </div>
      <div className="floating-window-empty__title">{title}</div>
      <div className="floating-window-empty__desc">{description}</div>
    </div>
  );
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
        const dragBounds = getFloatingDragBounds(
          currentWindow.width,
          currentWindow.height,
          width,
          height
        );

        const nextX = toPixel(
          clamp(dragStart.originX + deltaX, dragBounds.minX, dragBounds.maxX)
        );
        const nextY = toPixel(
          clamp(dragStart.originY + deltaY, dragBounds.minY, dragBounds.maxY)
        );
        if (nextX !== toPixel(currentWindow.x) || nextY !== toPixel(currentWindow.y)) {
          onMoveRef.current(currentWindow.id, nextX, nextY);
        }
        return;
      }

      if (interactionModeRef.current === 'resize' && resizeStartRef.current) {
        const resizeStart = resizeStartRef.current;
        const deltaX = event.clientX - resizeStart.pointerX;
        const deltaY = event.clientY - resizeStart.pointerY;
        const { width, height } = getContainerBounds();
        const availableWidth = Math.max(FLOATING_WINDOW_MIN_VIEWPORT_WIDTH, width - 20);
        const availableHeight = Math.max(FLOATING_WINDOW_MIN_VIEWPORT_HEIGHT, height - 20);
        const effectiveMinWidth = Math.min(currentWindow.minWidth, availableWidth);
        const effectiveMinHeight = Math.min(currentWindow.minHeight, availableHeight);

        const nextWidth = toPixel(clamp(
          resizeStart.originWidth + deltaX,
          effectiveMinWidth,
          availableWidth
        ));
        const nextHeight = toPixel(clamp(
          resizeStart.originHeight + deltaY,
          effectiveMinHeight,
          availableHeight
        ));

        if (
          nextWidth !== toPixel(currentWindow.width) ||
          nextHeight !== toPixel(currentWindow.height)
        ) {
          onResizeRef.current(currentWindow.id, nextWidth, nextHeight);
        }
      }
    },
    [getContainerBounds]
  );

  const handlePointerUp = useCallback(
    (event?: PointerEvent) => {
      if (event && activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }

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

      interactionModeRef.current = null;
      activePointerIdRef.current = null;
      dragStartRef.current = null;
      resizeStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = '';
    },
    [handlePointerMove]
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
      if (event.detail > 1) {
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

  const handleTitlebarDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const currentWindow = latestWindowStateRef.current;
      if (currentWindow.minimized) {
        return;
      }

      const { width, height } = getContainerBounds();
      const dragBounds = getFloatingDragBounds(
        currentWindow.width,
        currentWindow.height,
        width,
        height
      );

      const targetX = toPixel(clamp(
        (width - currentWindow.width) / 2,
        dragBounds.minX,
        dragBounds.maxX
      ));
      const targetY = toPixel(clamp(
        (height - currentWindow.height) / 2,
        dragBounds.minY,
        dragBounds.maxY
      ));

      onMoveRef.current(currentWindow.id, targetX, targetY);
      onFocus(currentWindow.id);
    },
    [getContainerBounds, onFocus]
  );

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
      <header
        className="floating-window__titlebar"
        onPointerDown={startDrag}
        onDoubleClick={handleTitlebarDoubleClick}
      >
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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const hasSelectedMaid =
      !!state.selectedMaidId && state.maids.some((maid) => maid.id === state.selectedMaidId);
    if (windows.maidDetail.open && !hasSelectedMaid) {
      dispatch({ type: 'CLOSE_FLOATING_WINDOW', windowId: 'maidDetail' });
      if (state.selectedMaidId) {
        dispatch({ type: 'SELECT_MAID', maidId: null });
      }
    }

    const hasSelectedCustomer =
      !!state.selectedCustomerId && state.customers.some((customer) => customer.id === state.selectedCustomerId);
    if (windows.customerDetail.open && !hasSelectedCustomer) {
      dispatch({ type: 'CLOSE_FLOATING_WINDOW', windowId: 'customerDetail' });
      if (state.selectedCustomerId) {
        dispatch({ type: 'SELECT_CUSTOMER', customerId: null });
      }
    }
  }, [
    dispatch,
    enabled,
    state.customers,
    state.maids,
    state.selectedCustomerId,
    state.selectedMaidId,
    windows.customerDetail.open,
    windows.maidDetail.open,
  ]);

  const handleFocus = useCallback(
    (windowId: FloatingWindowId) => {
      dispatch({ type: 'FOCUS_FLOATING_WINDOW', windowId });
    },
    [dispatch]
  );

  const handleClose = useCallback(
    (windowId: FloatingWindowId) => {
      if (windowId === 'maidDetail') {
        dispatch({ type: 'SELECT_MAID', maidId: null });
      }
      if (windowId === 'customerDetail') {
        dispatch({ type: 'SELECT_CUSTOMER', customerId: null });
      }
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

  const renderWindowContent = useCallback(
    (windowId: FloatingWindowId): React.ReactNode => {
      switch (windowId) {
        case 'tasks':
          return <TaskPanel />;
        case 'achievements':
          return <AchievementPanel />;
        case 'finance':
          return <FinancePanel />;
        case 'settings':
          return <SettingsPanel />;
        case 'maidDetail': {
          const maid = state.selectedMaidId
            ? state.maids.find((item) => item.id === state.selectedMaidId) ?? null
            : null;
          if (!maid) {
            return (
              <FloatingWindowEmptyState
                icon="👧"
                title="未选中女仆"
                description="在咖啡厅中点击任意女仆卡片即可查看详情。"
              />
            );
          }
          return (
            <div className="floating-window-detail">
              <MaidDetailPanel
                maid={maid}
                onRoleChange={(maidId, role) => dispatch({ type: 'ASSIGN_ROLE', maidId, role })}
                onToggleRest={(maidId) => dispatch({ type: 'TOGGLE_MAID_REST', maidId })}
              />
            </div>
          );
        }
        case 'customerDetail': {
          const customer = state.selectedCustomerId
            ? state.customers.find((item) => item.id === state.selectedCustomerId) ?? null
            : null;
          if (!customer) {
            return (
              <FloatingWindowEmptyState
                icon="👤"
                title="未选中顾客"
                description="在咖啡厅中点击任意顾客卡片即可查看详情。"
              />
            );
          }
          return (
            <div className="floating-window-detail">
              <CustomerDetailPanel customer={customer} />
            </div>
          );
        }
        default:
          return null;
      }
    },
    [dispatch, state.customers, state.maids, state.selectedCustomerId, state.selectedMaidId]
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
        // If viewport becomes smaller than configured minimums, allow temporary shrink-to-fit.
        const availableWidth = Math.max(FLOATING_WINDOW_MIN_VIEWPORT_WIDTH, viewportWidth - 20);
        const availableHeight = Math.max(FLOATING_WINDOW_MIN_VIEWPORT_HEIGHT, viewportHeight - 20);
        const effectiveMinWidth = Math.min(windowState.minWidth, availableWidth);
        const effectiveMinHeight = Math.min(windowState.minHeight, availableHeight);
        const nextWidth = toPixel(clamp(windowState.width, effectiveMinWidth, availableWidth));
        const nextHeight = toPixel(clamp(windowState.height, effectiveMinHeight, availableHeight));
        const dragBounds = getFloatingDragBounds(
          nextWidth,
          nextHeight,
          viewportWidth,
          viewportHeight
        );
        const nextX = toPixel(clamp(windowState.x, dragBounds.minX, dragBounds.maxX));
        const nextY = toPixel(clamp(windowState.y, dragBounds.minY, dragBounds.maxY));
        const currentWidth = toPixel(windowState.width);
        const currentHeight = toPixel(windowState.height);
        const currentX = toPixel(windowState.x);
        const currentY = toPixel(windowState.y);

        if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
          dispatch({
            type: 'RESIZE_FLOATING_WINDOW',
            windowId: windowState.id,
            width: nextWidth,
            height: nextHeight,
          });
        }

        if (nextX !== currentX || nextY !== currentY) {
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
