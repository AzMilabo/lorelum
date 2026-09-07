import { useEffect, type RefObject } from 'react';
import { gsap, registerGsapPlugins, ScrollTrigger } from '../gsap-client';

type Target =
  | { ref: RefObject<HTMLElement | null> }
  | { ref: RefObject<HTMLElement | null>; selector: string };

/**
 * Pause CSS animations while the target is outside the viewport.
 *
 * The landing runs GSAP ScrollSmoother, whose transform-based scrolling breaks
 * IntersectionObserver (observers never fire — see `motion-aware-text-type`).
 * So this uses ScrollTrigger inside a `gsap.context` (same pattern as every
 * other ScrollTrigger on the page, so the smoother's scroller and refresh
 * timing are handled): when the tracked element leaves the viewport it
 * gets `.is-offscreen` (`animation-play-state: paused`) and the class is
 * removed on return.
 *
 * Two forms:
 *   usePauseOffscreen({ ref })                  // the element itself
 *   usePauseOffscreen({ ref, selector: '.x' })  // matches inside the element
 *
 * Wire CSS like:
 *   .foo { animation: ... infinite; }
 *   .foo.is-offscreen { animation-play-state: paused; }
 *
 * The trigger is created unconditionally.
 */
export function usePauseOffscreen(target: Target, className = 'is-offscreen') {
  const { ref } = target;
  const selector = 'selector' in target ? target.selector : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsapPlugins();

    const apply = (offscreen: boolean) => {
      const targets = selector ? Array.from(el.querySelectorAll<HTMLElement>(selector)) : [el];
      for (const t of targets) t.classList.toggle(className, offscreen);
    };

    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => apply(!self.isActive),
      });
      return () => trigger.kill();
    });

    return () => {
      apply(false);
      ctx.revert();
    };
  }, [ref, selector, className]);
}
