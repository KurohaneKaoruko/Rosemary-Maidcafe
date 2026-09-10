'use client';

import React, { useCallback } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { isFloatingWindowPanel } from '@/data/desktopUI';
import { PanelType } from '@/types';

interface DockItem {
  id: PanelType;
  label: string;
  icon: string;
}

const dockItems: DockItem[] = [
  { id: 'cafe', label: '咖啡厅', icon: '☕' },
  { id: 'maids', label: '女仆', icon: '👧' },
  { id: 'menu', label: '菜单', icon: '📋' },
  { id: 'facility', label: '设施', icon: '🏗' },
  { id: 'finance', label: '财务', icon: '💰' },
  { id: 'tasks', label: '任务', icon: '🎯' },
  { id: 'achievements', label: '成就', icon: '🏆' },
  { id: 'settings', label: '设置', icon: '⚙' },
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

  return (
    <aside className="desktop-dock" aria-label="桌面导航栏">
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
          icon={state.isPaused ? '▶' : '⏸'}
          label={state.isPaused ? '继续' : '暂停'}
          active={state.isPaused}
          onClick={handleTogglePause}
        />
      </div>
    </aside>
  );
}

export default DesktopDock;
