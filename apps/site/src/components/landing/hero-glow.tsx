import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';

/**
 * Hero glow: mouse parallax (inner) layered with scroll-linked parallax
 * (outer), both transform-only and compositor-friendly.
 *
 * Cheap on purpose: a pointer move only writes two motion values; the spring
 * runs a tiny transform animation and settles when the pointer stops. No
 * scroll listeners, no per-frame work while idle, and everything is disabled
 * for touch devices / reduced-motion users (the glow itself is hidden under
 * reduced motion in CSS).
 */
export function HeroGlow() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 36, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 36, damping: 18, mass: 0.6 });
  const x = useTransform(sx, [-1, 1], [-28, 28]);
  const y = useTransform(sy, [-1, 1], [-18, 18]);

  // As the hero scrolls out, the glow drifts up slightly.
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const scrollY = useTransform(scrollYProgress, [0, 1], [40, -40]);

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

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ y: scrollY }}
    >
      <motion.div className="landing-hero-glow" style={{ x, y }} />
    </motion.div>
  );
}
