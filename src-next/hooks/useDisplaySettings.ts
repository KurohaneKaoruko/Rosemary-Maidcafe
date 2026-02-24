'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTauriDesktop } from '@/utils/platform';

export type DisplayMode = 'windowed' | 'fullscreen';

export interface DisplayResolution {
  id: string;
  label: string;
  width: number;
  height: number;
}

interface DisplaySettings {
  mode: DisplayMode;
  resolutionId: string;
}

interface DisplaySettingsHookResult {
  isDesktop: boolean;
  mode: DisplayMode;
  resolutionId: string;
  resolution: DisplayResolution;
  resolutions: DisplayResolution[];
  isApplying: boolean;
  lastError: string | null;
  applySettings: (nextSettings: DisplaySettings) => Promise<boolean>;
}

const STORAGE_KEY = 'rosemary-maid-cafe-display-settings';

const DISPLAY_RESOLUTIONS: DisplayResolution[] = [
  { id: '1280x720', label: '720p (1280x720)', width: 1280, height: 720 },
  { id: '1600x900', label: '900p (1600x900)', width: 1600, height: 900 },
  { id: '1920x1080', label: '1080p (1920x1080)', width: 1920, height: 1080 },
  { id: '2560x1440', label: '2K (2560x1440)', width: 2560, height: 1440 },
];

const DEFAULT_SETTINGS: DisplaySettings = {
  mode: 'windowed',
  resolutionId: '1920x1080',
};

function getResolutionById(resolutionId: string): DisplayResolution {
  return DISPLAY_RESOLUTIONS.find((item) => item.id === resolutionId) ?? DISPLAY_RESOLUTIONS[2];
}

function safeParseDisplaySettings(raw: string | null): DisplaySettings | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DisplaySettings>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const mode: DisplayMode = parsed.mode === 'fullscreen' ? 'fullscreen' : 'windowed';
    const resolution = getResolutionById(parsed.resolutionId ?? DEFAULT_SETTINGS.resolutionId);

    return {
      mode,
      resolutionId: resolution.id,
    };
  } catch {
    return null;
  }
}

async function applyTauriDisplaySettings(settings: DisplaySettings): Promise<void> {
  const [{ getCurrentWindow, currentMonitor, primaryMonitor }, { LogicalSize }] = await Promise.all([
    import('@tauri-apps/api/window'),
    import('@tauri-apps/api/dpi'),
  ]);
  const appWindow = getCurrentWindow();

  if (settings.mode === 'fullscreen') {
    await appWindow.setFullscreen(true);
    return;
  }

  await appWindow.setFullscreen(false);

  const maximized = await appWindow.isMaximized();
  if (maximized) {
    await appWindow.unmaximize();
  }

  const resolution = getResolutionById(settings.resolutionId);
  let nextWidth = resolution.width;
  let nextHeight = resolution.height;

  try {
    const monitor = (await currentMonitor()) ?? (await primaryMonitor());
    if (monitor) {
      const workWidth = Math.floor(monitor.workArea.size.width / monitor.scaleFactor);
      const workHeight = Math.floor(monitor.workArea.size.height / monitor.scaleFactor);

      const availableWidth = Math.max(320, workWidth - 48);
      const availableHeight = Math.max(240, workHeight - 56);
      const scale = Math.min(
        1,
        availableWidth / resolution.width,
        availableHeight / resolution.height
      );

      nextWidth = Math.max(320, Math.floor(resolution.width * scale));
      nextHeight = Math.max(240, Math.floor(resolution.height * scale));
    }
  } catch {
    // If monitor probing fails, fallback to requested logical size.
  }

  await appWindow.setSize(new LogicalSize(nextWidth, nextHeight));
  await appWindow.center();
}

async function applyBrowserDisplaySettings(settings: DisplaySettings): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  if (settings.mode === 'fullscreen') {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
}

export function useDisplaySettings(): DisplaySettingsHookResult {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mode, setMode] = useState<DisplayMode>(DEFAULT_SETTINGS.mode);
  const [resolutionId, setResolutionId] = useState<string>(DEFAULT_SETTINGS.resolutionId);
  const [isApplying, setIsApplying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsDesktop(isTauriDesktop());

    const stored = safeParseDisplaySettings(window.localStorage.getItem(STORAGE_KEY));
    const initial = stored ?? DEFAULT_SETTINGS;

    setMode(initial.mode);
    setResolutionId(initial.resolutionId);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const settings: DisplaySettings = { mode, resolutionId };
    void (async () => {
      try {
        if (isDesktop) {
          await applyTauriDisplaySettings(settings);
        } else {
          await applyBrowserDisplaySettings(settings);
        }
      } catch {
        // Ignore startup apply failures. User can re-apply from settings.
      }
    })();
  }, [initialized, isDesktop, mode, resolutionId]);

  const applySettings = useCallback(
    async (nextSettings: DisplaySettings): Promise<boolean> => {
      const normalizedSettings: DisplaySettings = {
        mode: nextSettings.mode === 'fullscreen' ? 'fullscreen' : 'windowed',
        resolutionId: getResolutionById(nextSettings.resolutionId).id,
      };

      setIsApplying(true);
      setLastError(null);

      try {
        if (isDesktop) {
          await applyTauriDisplaySettings(normalizedSettings);
        } else {
          await applyBrowserDisplaySettings(normalizedSettings);
        }

        setMode(normalizedSettings.mode);
        setResolutionId(normalizedSettings.resolutionId);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
        }

        return true;
      } catch {
        setLastError('显示设置应用失败，请重试。');
        return false;
      } finally {
        setIsApplying(false);
      }
    },
    [isDesktop]
  );

  const resolution = useMemo(() => getResolutionById(resolutionId), [resolutionId]);

  return {
    isDesktop,
    mode,
    resolutionId,
    resolution,
    resolutions: DISPLAY_RESOLUTIONS,
    isApplying,
    lastError,
    applySettings,
  };
}

export default useDisplaySettings;
