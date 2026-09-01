import { useLayoutEffect, type ReactNode } from 'react';
import { gsap, registerGsapPlugins, ScrollSmoother } from './gsap-client';
import { shouldUseSmoothScroll } from './smooth-gate';

export const SMOOTH_WRAPPER_ID = 'smooth-wrapper';
export const SMOOTH_CONTENT_ID = 'smooth-content';

/**
 * ScrollSmoother for the landing page, replacing Lenis.
 *
 * Mirrors Antigravity's setup — `smooth: 0.6`, `effects: true`,
 * `smoothTouch: 0.1`, and a `normalizeScroll` that tolerates the nested
 * terminal demo scroller — but keeps a real accessibility floor: it is only
 * created under `prefers-reduced-motion: no-preference`. Reduced-motion and
 * touch users keep native scrolling, and `gsap.matchMedia()` tears the whole
 * thing down if the OS motion setting changes at runtime.
 *
 * The `#smooth-wrapper`/`#smooth-content` ids are rendered by `LandingShell`
 * (content is a plain block when no smoother is created, so SSR and
 * reduced-motion pages are unaffected). Created in a layout effect so child
 * `useEffect`-driven ScrollTriggers always mount after it exists.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    registerGsapPlugins();

    // Initial gate so a reduced-motion user never even constructs the media
    // context; `gsap.matchMedia` below keeps the setting reactive afterwards.
    if (!shouldUseSmoothScroll(window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      return;
    }

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const wrapper = document.getElementById(SMOOTH_WRAPPER_ID);
      const content = document.getElementById(SMOOTH_CONTENT_ID);
      if (!wrapper || !content) return;

      const smoother = ScrollSmoother.create({
        wrapper: `#${SMOOTH_WRAPPER_ID}`,
        content: `#${SMOOTH_CONTENT_ID}`,
        smooth: 0.6,
        effects: true,
        smoothTouch: 0.1,
        normalizeScroll: { allowNestedScroll: true },
      });

      return () => smoother.kill();
    });

    return () => mm.revert();
  }, []);

  return <>{children}</>;
}
