/**
 * Pure decision helper for enabling ScrollSmoother on the landing page.
 *
 * Kept framework-free so the reduced-motion policy is unit tested and can't
 * silently drift. `gsap.matchMedia` does the runtime gating; this mirrors the
 * policy in one place for tests and for anyone tracing the smooth-scroll flag.
 */
export function shouldUseSmoothScroll(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
