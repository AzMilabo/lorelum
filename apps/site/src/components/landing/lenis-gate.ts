/**
 * Pure decision helper for enabling Lenis smooth scrolling on the landing
 * page. Kept as a tiny pure function so the reduced-motion policy is unit
 * tested and can't silently drift.
 */
export function shouldInitLenis(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
