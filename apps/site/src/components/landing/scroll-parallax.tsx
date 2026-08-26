import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';

/**
 * Scroll-linked vertical parallax wrapper (transform-only).
 *
 * Translates children from `from` to `to` px as the element travels from the
 * bottom edge of the viewport to the top — a subtle depth cue in the
 * Antigravity style. No scroll listeners of its own; motion's `useScroll`
 * observes the element via IntersectionObserver and updates on rAF.
 */
export function ScrollParallax({
  children,
  className,
  from = 24,
  to = -24,
}: {
  children: ReactNode;
  className?: string;
  from?: number;
  to?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
