import { useEffect, useState } from 'react';
import { shouldEnableCursorEffects } from './motion-gate';

/**
 * True when pointer-magnet micro-interactions should run: a fine pointer
 * (mouse/trackpad) and motion is allowed. Touch and reduced-motion users get
 * a plain, static button.
 */
export function useMagnetEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(
      shouldEnableCursorEffects({
        finePointer: window.matchMedia('(pointer: fine)').matches,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }),
    );
  }, []);
  return enabled;
}
