import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, registerGsapPlugins } from './gsap-client';
import { cn } from '@/lib/cn';

/**
 * Scroll-scrub scale + fade entrance, in the spirit of Antigravity's
 * `DownloadSection` panel (`gsap.from(panel, { scale: .85, scrollTrigger:
 * { start: 'top 75%', scrub: true } })`).
 *
 * Unlike a one-shot IO reveal, the panel's size and opacity are tied to scroll
 * progress, so it "materializes" as it enters instead of popping in. It stays
 * at its natural size/opacity under reduced motion, and the scrub is cleaned
 * up on unmount so SPA navigation can't leak.
 */
export function GsapScaleReveal({
  children,
  className,
  fromScale = 0.9,
  fromY = 30,
}: {
  children: ReactNode;
  className?: string;
  fromScale?: number;
  fromY?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsapPlugins();

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        el,
        { scale: fromScale, opacity: 0, y: fromY },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            end: 'top 55%',
            scrub: true,
          },
        },
      );
    });

    return () => mm.revert();
  }, [fromScale, fromY]);

  return (
    <div ref={ref} className={cn('landing-scale-reveal', className)}>
      {children}
    </div>
  );
}
