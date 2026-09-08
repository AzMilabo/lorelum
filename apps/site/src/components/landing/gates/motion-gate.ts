/**
 * Pure gate for cursor/canvas-driven effects on the landing page: they only
 * make sense with a fine pointer (mouse/trackpad). Touch devices keep the
 * plain fallbacks — same visuals, no WebGL canvas, no per-frame loops.
 *
 * Unit-tested so the policy can't silently drift; the reactive hook that
 * consumes it lives in `../hooks/use-canvas-effects`.
 */
export interface PointerGateInput {
  /** `matchMedia('(pointer: fine)').matches`. */
  finePointer: boolean;
}

export function shouldEnableCanvasEffects({ finePointer }: PointerGateInput): boolean {
  return finePointer;
}
