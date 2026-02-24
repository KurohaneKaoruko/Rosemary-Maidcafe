'use client';

import React, { useCallback } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { useFullscreenMode } from '@/hooks/useFullscreenMode';
import { isFloatingWindowPanel } from '@/data/desktopUI';
import { PanelType } from '@/types';

interface DockItem {
  id: PanelType;
  label: string;
  icon: string;
}

const dockItems: DockItem[] = [
  { id: 'cafe', label: 'Cafe', icon: 'C' },
  { id: 'maids', label: 'Maid', icon: 'M' },
  { id: 'menu', label: 'Menu', icon: 'N' },
  { id: 'facility', label: 'Build', icon: 'B' },
  { id: 'finance', label: 'Cash', icon: 'F' },
  { id: 'tasks', label: 'Task', icon: 'T' },
  { id: 'achievements', label: 'Medal', icon: 'A' },
  { id: 'settings', label: 'Config', icon: 'S' },
];

function DockButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`desktop-dock__item ${active ? 'active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <span className="desktop-dock__icon">{icon}</span>
      <span className="desktop-dock__text">{label}</span>
    </button>
  );
}

export function DesktopDock() {
  const { state, dispatch } = useGame();
  const { isFullscreen, toggleFullscreen } = useFullscreenMode();

  const handleSelectPanel = useCallback(
    (panel: PanelType) => {
      if (isFloatingWindowPanel(panel)) {
        dispatch({ type: 'OPEN_FLOATING_WINDOW', windowId: panel });
        if (state.activePanel === panel) {
          dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'cafe' });
        }
        return;
      }

      dispatch({ type: 'SET_ACTIVE_PANEL', panel });
    },
    [dispatch, state.activePanel]
  );

  const isPanelActive = useCallback(
    (panel: PanelType): boolean => {
      if (isFloatingWindowPanel(panel)) {
        return state.desktopUI.floatingWindows[panel].open;
      }
      return state.activePanel === panel;
    },
    [state.activePanel, state.desktopUI.floatingWindows]
  );

  const handleTogglePause = useCallback(() => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, [dispatch]);

  const handleToggleFullscreen = useCallback(() => {
    void toggleFullscreen();
  }, [toggleFullscreen]);

  return (
    <aside className="desktop-dock" aria-label="Desktop Dock">
      <div className="desktop-dock__group">
        {dockItems.map((item) => (
          <DockButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isPanelActive(item.id)}
            onClick={() => handleSelectPanel(item.id)}
          />
        ))}
      </div>

      <div className="desktop-dock__group desktop-dock__group--footer">
        <DockButton
          icon={state.isPaused ? 'P' : 'R'}
          label={state.isPaused ? 'Resume' : 'Pause'}
          active={state.isPaused}
          onClick={handleTogglePause}
        />
        <DockButton
          icon={isFullscreen ? 'X' : 'O'}
          label={isFullscreen ? 'Window' : 'Fullscreen'}
          active={isFullscreen}
          onClick={handleToggleFullscreen}
        />
      </div>
    </aside>
  );
}

export default DesktopDock;
