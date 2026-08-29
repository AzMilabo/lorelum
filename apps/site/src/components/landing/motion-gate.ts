/**
 * Pure decision helpers for cursor-driven effects on the landing page.
 * Kept framework-free so the policy (fine pointer + motion allowed) is unit
 * tested and can't silently drift.
 */

export interface PointerGateInput {
  /** (pointer: fine) — mouse/trackpad, not touch. */
  finePointer: boolean;
  /** prefers-reduced-motion: reduce. */
  reducedMotion: boolean;
}

/**
 * Cursor effects (page glow, hero parallax) are enabled only for fine
 * pointers with motion allowed. Touch users and reduced-motion users get a
 * calm, static page — everything stays visible, just not pointer-reactive.
 */
export function shouldEnableCursorEffects({ finePointer, reducedMotion }: PointerGateInput): boolean {
  return finePointer && !reducedMotion;
}
