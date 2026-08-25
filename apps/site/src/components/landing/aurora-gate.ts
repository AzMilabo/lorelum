export interface AuroraGateInput {
  /** Whether the Fumadocs theme is dark (`html.dark`). */
  isDark: boolean;
  /** Whether the viewport is desktop-sized (>= 768px). */
  isDesktop: boolean;
  /** Whether the user prefers reduced motion. */
  prefersReducedMotion: boolean;
}

/**
 * Decide whether to mount the WebGL Aurora on top of the CSS fallback.
 * WebGL only pays off on dark, desktop, motion-friendly sessions; everything
 * else keeps the cheap, SSR-safe CSS gradient.
 */
export function shouldUseWebglAurora({
  isDark,
  isDesktop,
  prefersReducedMotion,
}: AuroraGateInput): boolean {
  return isDark && isDesktop && !prefersReducedMotion;
}
