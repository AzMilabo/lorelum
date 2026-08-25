/**
 * Full-page background for the landing page.
 *
 * Pure static art: a layered gradient mesh, a faint beam texture, a vignette
 * and a film-grain overlay. No WebGL, no per-frame animation — the browser
 * rasterizes these once, so scrolling and interactions stay smooth even on
 * low-end machines.
 */
export function AuroraBackground() {
  return (
    <>
      <div aria-hidden className="landing-bg" />
      <div aria-hidden className="landing-beams" />
      <div aria-hidden className="landing-vignette" />
      <div aria-hidden className="landing-noise" />
    </>
  );
}
