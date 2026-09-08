import Antigravity from './antigravity';
import { useCanvasEffectsEnabled } from './hooks/use-canvas-effects';

/**
 * Motion-aware gate for the Antigravity particle simulation on the CTA card,
 * a faithful port of the official Antigravity download section
 * (antigravity.google, `MainParticlesComponent`).
 *
 * Antigravity runs a GPU ping-pong sim on a WebGL `<Canvas>` (three +
 * @react-three/fiber), which is heavy, so it only runs on fine-pointer
 * devices. On the server or on touch we render nothing, so no WebGL context
 * is created and nothing animates.
 *
 * Props are the site's dark-section data attributes, verbatim:
 * data-density="220" data-particles-scale="0.65" data-ring-width="0.15"
 * data-ring-width2="0.05" data-ring-displacement="0.23"
 * (colors #7189ff / #3074f9 / #000000 live in the component itself).
 */
export function MotionAwareAntigravity() {
  const enabled = useCanvasEffectsEnabled();

  if (!enabled) {
    return null;
  }

  return (
    <Antigravity
      density={220}
      particlesScale={0.65}
      ringWidth={0.15}
      ringWidth2={0.05}
      ringDisplacement={0.23}
    />
  );
}
