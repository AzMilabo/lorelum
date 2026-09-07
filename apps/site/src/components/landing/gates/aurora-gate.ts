/**
 * Pure decision helper for the WebGL aurora background on the landing page.
 *
 * The aurora is the single GPU-heavy layer, so it is only enabled when it
 * can actually shine: client-side, dark theme, desktop pointer, WebGL
 * available (and hardware-accelerated — see `hardwareWebgl`), hero in view
 * and motion allowed. Every other combination falls back to the CSS gradient
 * mesh + 2D particle field. Kept framework-free so the policy is unit tested
 * and can't silently drift.
 */

export interface AuroraGateInput {
  /** Client-only — always false during SSR so we never render on the server. */
  mounted: boolean;
  /** Fumadocs `.dark` class is present. */
  dark: boolean;
  /** Coarse pointer (touch) — disable on mobile/tablet. */
  touch: boolean;
  /** A WebGL context could be created. */
  webgl: boolean;
  /**
   * The WebGL implementation is hardware-accelerated (not a software
   * rasterizer such as Microsoft Basic Render Driver / SwiftShader). Under
   * software rendering a full-screen aurora costs ~2x the fps of the CSS
   * fallback, so we keep the WebGL layer off there. `null` (unknown — e.g.
   * SSR, or the renderer could not be read) is treated as true so we never
   * degrade a setup we simply couldn't classify.
   */
  hardwareWebgl: boolean | null;
  /** Hero section is currently intersecting the viewport. */
  inView: boolean;
  /** Viewport width in CSS pixels. */
  viewportWidth: number;
}

/** Minimum viewport width (CSS px) for the aurora to be worth rendering. */
export const AURORA_MIN_WIDTH = 768;

export function shouldRenderWebglAurora(input: AuroraGateInput): boolean {
  return (
    input.mounted &&
    input.dark &&
    !input.touch &&
    input.webgl &&
    input.hardwareWebgl !== false &&
    input.inView &&
    input.viewportWidth >= AURORA_MIN_WIDTH
  );
}
