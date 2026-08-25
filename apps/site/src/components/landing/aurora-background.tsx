import { lazy, Suspense, useEffect, useState } from 'react';
import { shouldUseWebglAurora } from './aurora-gate';

const Aurora = lazy(() => import('@/components/react-bits/aurora'));

const AURORA_COLORS = ['#4f46e5', '#8b5cf6', '#22d3ee'];

/**
 * Full-page aurora backdrop for the landing page.
 *
 * Always renders the CSS gradient (SSR-safe, works in light mode and on
 * mobile). On dark desktop sessions without reduced-motion, a WebGL Aurora
 * chunk is lazy-loaded on top after first paint. `ogl` therefore stays out of
 * the main bundle and the prerendered HTML.
 *
 * Theme is tracked reactively (MutationObserver on `<html class>`), so the
 * WebGL layer appears/disappears when the user toggles the Fumadocs theme.
 */
export function AuroraBackground() {
  const [isDark, setIsDark] = useState(false);
  const [viewport, setViewport] = useState({ isDesktop: true, prefersReducedMotion: false });
  const [mountWebGL, setMountWebGL] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));

    const media = {
      isDesktop: window.matchMedia('(min-width: 768px)').matches,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
    setViewport(media);

    // Keep the theme in sync when Fumadocs toggles `.dark`.
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldUseWebglAurora({ isDark, ...viewport })) {
      setMountWebGL(false);
      return;
    }
    // Let the CSS aurora paint first, then upgrade to WebGL.
    const id = setTimeout(() => setMountWebGL(true), 400);
    return () => clearTimeout(id);
  }, [isDark, viewport.isDesktop, viewport.prefersReducedMotion]);

  return (
    <>
      <div aria-hidden className="landing-aurora">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
      </div>
      {mountWebGL && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[-9]">
          <Suspense fallback={null}>
            <Aurora colorStops={AURORA_COLORS} amplitude={1.1} blend={0.6} />
          </Suspense>
        </div>
      )}
      <div aria-hidden className="landing-vignette" />
      <div aria-hidden className="landing-noise" />
    </>
  );
}
