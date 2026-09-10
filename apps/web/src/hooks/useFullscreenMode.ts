'use client';

import { useCallback } from 'react';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';

export function useFullscreenMode() {
  const { mode, resolutionId, applySettings } = useDisplaySettings();
  const isFullscreen = mode === 'fullscreen';

  const toggleFullscreen = useCallback(async () => {
    await applySettings({
      mode: isFullscreen ? 'windowed' : 'fullscreen',
      resolutionId,
    });
  }, [applySettings, isFullscreen, resolutionId]);

  const exitFullscreen = useCallback(async () => {
    await applySettings({
      mode: 'windowed',
      resolutionId,
    });
  }, [applySettings, resolutionId]);

  return {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
  };
}

export default useFullscreenMode;
