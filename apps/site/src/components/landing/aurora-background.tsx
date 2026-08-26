import { ParticleField } from './particle-field';

/**
 * Full-page background for the landing page.
 *
 * Layered, zero-layout-cost art: a slowly drifting gradient mesh, a faint
 * beam texture, a light 2D particle field, a vignette and a film-grain
 * overlay. No WebGL; the only continuous cost is the tiny particle canvas,
 * which pauses when the tab is hidden and disables under reduced motion.
 */
export function AuroraBackground() {
  return (
    <>
      <div aria-hidden className="landing-bg" />
      <ParticleField />
      <div aria-hidden className="landing-beams" />
      <div aria-hidden className="landing-vignette" />
      <div aria-hidden className="landing-noise" />
    </>
  );
}
