import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { shouldEnableCursorEffects } from './motion-gate';

/**
 * Page-level ambient glow that follows the cursor.
 *
 * A single fixed radial-gradient layer whose position is driven by a spring
 * (transform-only, compositor-cheap). It makes the whole page feel alive —
 * light follows the pointer everywhere, on both themes. The CSS negative
 * margins center the 46rem circle on the cursor. Disabled for coarse
 * pointers (touch) and reduced motion.
 */
export function CursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 90, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 90, damping: 22, mass: 0.6 });

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shouldEnableCursorEffects({ finePointer: fine, reducedMotion: reduced })) return;
    setEnabled(true);

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [x, y]);

  if (!enabled) return null;

  return <motion.div aria-hidden className="landing-cursor-glow" style={{ x: sx, y: sy }} />;
}
