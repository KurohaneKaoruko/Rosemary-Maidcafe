import {
  DesktopUIState,
  FloatingWindowId,
  FloatingWindowState,
  PanelType,
} from '@/types';

export const FLOATING_WINDOW_IDS: FloatingWindowId[] = [
  'tasks',
  'achievements',
  'finance',
  'settings',
];

export const FLOATING_WINDOW_TITLES: Record<FloatingWindowId, string> = {
  tasks: '任务中心',
  achievements: '成就档案',
  finance: '财务报表',
  settings: '系统设置',
};

const FLOATING_WINDOW_LAYOUT: Record<
  FloatingWindowId,
  Pick<FloatingWindowState, 'x' | 'y' | 'width' | 'height' | 'minWidth' | 'minHeight'>
> = {
  tasks: { x: 36, y: 20, width: 460, height: 460, minWidth: 360, minHeight: 280 },
  achievements: { x: 124, y: 48, width: 520, height: 500, minWidth: 420, minHeight: 320 },
  finance: { x: 220, y: 28, width: 540, height: 520, minWidth: 420, minHeight: 320 },
  settings: { x: 320, y: 72, width: 500, height: 520, minWidth: 400, minHeight: 300 },
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
    },
    activeWindowId: null,
    nextZIndex: 24,
  };
}

export function isFloatingWindowPanel(panel: PanelType): panel is FloatingWindowId {
  return FLOATING_WINDOW_IDS.includes(panel as FloatingWindowId);
}
