/**
 * Pure budget helpers for the landing particle field. Kept framework-free so
 * the perf-critical decisions (how many particles, at what DPR) are unit
 * tested in isolation.
 */

export interface ParticleBudgetInput {
  /** Viewport width in CSS pixels. */
  width: number;
  /** Viewport height in CSS pixels. */
  height: number;
  /** Current device pixel ratio. */
  dpr: number;
  /** `prefers-reduced-motion` — particles are fully disabled. */
  reducedMotion: boolean;
}

const MIN_PARTICLES = 40;
const MAX_PARTICLES = 90;
const AREA_PER_PARTICLE = 40_000;
const MAX_DPR = 1.5;

/**
 * Particle count scales with viewport area, clamped to [40, 90]. Reduced
 * motion yields zero particles.
 */
export function getParticleCount({ width, height, reducedMotion }: ParticleBudgetInput): number {
  if (reducedMotion) return 0;
  const area = width * height;
  return Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, Math.round(area / AREA_PER_PARTICLE)));
}

/**
 * Cap the backing-store scale so we never rasterize the canvas above 1.5x,
 * keeping fill-rate bounded on high-DPI (retina/4K) displays.
 */
export function getCanvasScale(dpr: number): number {
  return Math.min(dpr || 1, MAX_DPR);
}
