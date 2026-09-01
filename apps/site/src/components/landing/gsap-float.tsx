import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, registerGsapPlugins, ScrollTrigger } from './gsap-client';
import { cn } from '@/lib/cn';

/**
 * Antigravity-style "living element" float.
 *
 * A transform-only sine oscillation on the `y` axis, driven by `quickSetter`
 * so it costs one cheap set per frame on a single element (never touches the
 * layout or paints). It runs only under `prefers-reduced-motion:
 * no-preference` and pauses itself once the element scrolls out of the
 * viewport, so a passed section doesn't burn frames in the background.
 */
export function GsapFloat({
  children,
  className,
  amplitude = 9,
  step = 0.022,
}: {
  children: ReactNode;
  className?: string;
  /** Peak vertical travel in px. */
  amplitude?: number;
  /** Phase step per frame — smaller is slower. */
  step?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsapPlugins();

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const setY = gsap.quickSetter(el, 'y', 'px');
      const state = { phase: 0 };
      const wave = () => {
        setY(Math.sin(state.phase) * amplitude);
        state.phase += step;
      };
      const startWave = () => gsap.ticker.add(wave);
      const stopWave = () => gsap.ticker.remove(wave);
      startWave();

      // Halt the ticker once this element is comfortably off-screen.
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          if (self.isActive) startWave();
          else stopWave();
        },
      });

      return () => {
        stopWave();
        trigger.kill();
      };
    });

    return () => mm.revert();
  }, [amplitude, step]);

  return (
    <div ref={ref} className={cn('landing-gsap-float will-change-transform', className)}>
      {children}
    </div>
  );
}
