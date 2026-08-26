import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';

/**
 * Scroll-linked reveal wrapper.
 *
 * Unlike a one-shot `whileInView`, opacity/translate are driven by the
 * scroll progress through the element, so the entrance feels continuous and
 * reverses smoothly when scrolling back up — the "Antigravity" hand feel.
 * Animates transform + opacity only (compositor-friendly).
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.95', 'start 0.35'],
  });
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [24, 0]);

  return (
    <motion.div ref={ref} className={className} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}
