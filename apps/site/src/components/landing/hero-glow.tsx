import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';

/**
 * Mouse-parallax glow behind the hero copy.
 *
 * Cheap on purpose: a pointer move only writes two motion values; the spring
 * runs a tiny compositor-friendly `transform` animation and settles when the
 * pointer stops. No scroll listeners, no per-frame work while idle, and it
 * is fully disabled for touch devices / reduced-motion users.
 */
export function HeroGlow() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 36, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 36, damping: 18, mass: 0.6 });
  const x = useTransform(sx, [-1, 1], [-28, 28]);
  const y = useTransform(sy, [-1, 1], [-18, 18]);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    const onPointerMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [mx, my]);

  return <motion.div aria-hidden className="landing-hero-glow" style={{ x, y }} />;
}
