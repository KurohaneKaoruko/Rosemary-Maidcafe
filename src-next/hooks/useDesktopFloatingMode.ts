'use client';

import { useEffect, useState } from 'react';
import { isTauriDesktop } from '@/utils/platform';

export function useDesktopFloatingMode(minWidth: number = 1024): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateMode = () => {
      setEnabled(isTauriDesktop() && window.innerWidth >= minWidth);
    };

    updateMode();
    window.addEventListener('resize', updateMode);
    return () => window.removeEventListener('resize', updateMode);
  }, [minWidth]);

  return enabled;
}

export default useDesktopFloatingMode;
