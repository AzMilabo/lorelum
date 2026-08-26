import { Lenis as ReactLenis } from 'lenis/react';
import { useEffect, useState, type ReactNode } from 'react';
import { shouldInitLenis } from './lenis-gate';

/**
 * Lenis smooth scrolling, scoped to the landing page only.
 *
 * Rendered with `root` so it drives the native window scroll without adding
 * wrapper DOM (keeps the Fumadocs HomeLayout structure intact). It is fully
 * disabled for `prefers-reduced-motion` users, and it unmounts — destroying
 * the instance — when the user navigates to a docs page, so docs keep their
 * native, precise scrolling.
 *
 * Tuned for a silk feel: `wheelMultiplier` 0.85 stops a big swipe from
 * overshooting into a long sticky tail, and `lerp` 0.1 settles promptly
 * without the first-frame lunge that used to feel rough. All scroll-linked
 * reveals/parallax are native CSS scroll-driven animations, so nothing
 * fights Lenis on the main thread.
 */
export function LenisScroll({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(shouldInitLenis(reducedMotion));
  }, []);

  if (!enabled) return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        wheelMultiplier: 0.85,
        smoothWheel: true,
        autoRaf: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
