import {
  DesktopUIState,
  FloatingWindowId,
  FloatingWindowState,
  PanelType,
} from '@/types';

export type PanelFloatingWindowId = 'tasks' | 'achievements' | 'finance' | 'settings';

// Panel pages now render in the main stage instead of floating windows.
export const PANEL_FLOATING_WINDOW_IDS: PanelFloatingWindowId[] = [];

// Keep only detail windows as floating overlays.
export const FLOATING_WINDOW_IDS: FloatingWindowId[] = [
  'maidDetail',
  'customerDetail',
];

export const DESKTOP_TOOLBAR_WINDOW_IDS: PanelFloatingWindowId[] = [
  ...PANEL_FLOATING_WINDOW_IDS,
];

export const FLOATING_WINDOW_TITLES: Record<FloatingWindowId, string> = {
  tasks: '任务中心',
  achievements: '成就档案',
  finance: '财务报表',
  settings: '系统设置',
  maidDetail: '女仆详情',
  customerDetail: '顾客详情',
};

const FLOATING_WINDOW_LAYOUT: Record<
  FloatingWindowId,
  Pick<FloatingWindowState, 'x' | 'y' | 'width' | 'height' | 'minWidth' | 'minHeight'>
> = {
  tasks: { x: 36, y: 20, width: 500, height: 500, minWidth: 420, minHeight: 320 },
  achievements: { x: 124, y: 48, width: 560, height: 520, minWidth: 460, minHeight: 340 },
  finance: { x: 220, y: 28, width: 620, height: 560, minWidth: 520, minHeight: 360 },
  settings: { x: 320, y: 72, width: 560, height: 540, minWidth: 460, minHeight: 340 },
  maidDetail: { x: 460, y: 112, width: 520, height: 540, minWidth: 460, minHeight: 360 },
  customerDetail: { x: 520, y: 140, width: 500, height: 460, minWidth: 440, minHeight: 320 },
};

function createInitialFloatingWindowState(
  id: FloatingWindowId,
  zIndex: number
): FloatingWindowState {
  const layout = FLOATING_WINDOW_LAYOUT[id];
  return {
    id,
    title: FLOATING_WINDOW_TITLES[id],
    open: false,
    minimized: false,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    minWidth: layout.minWidth,
    minHeight: layout.minHeight,
    zIndex,
  };
}

export function createInitialDesktopUIState(): DesktopUIState {
  return {
    floatingWindows: {
      tasks: createInitialFloatingWindowState('tasks', 20),
      achievements: createInitialFloatingWindowState('achievements', 21),
      finance: createInitialFloatingWindowState('finance', 22),
      settings: createInitialFloatingWindowState('settings', 23),
      maidDetail: createInitialFloatingWindowState('maidDetail', 24),
      customerDetail: createInitialFloatingWindowState('customerDetail', 25),
    },
    activeWindowId: null,
    nextZIndex: 26,
  };
}

export function isFloatingWindowPanel(panel: PanelType): panel is PanelFloatingWindowId {
  return (PANEL_FLOATING_WINDOW_IDS as readonly string[]).includes(panel);
}
