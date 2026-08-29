import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { shouldRenderWebglAurora } from './aurora-gate';

/**
 * Client-only WebGL aurora for the hero, gated to the cases where it can
 * shine: dark theme + desktop pointer + WebGL + hero in view + motion OK.
 *
 * `ogl` is loaded through `React.lazy` so it lands in a separate async chunk
 * (never in the pre-rendered HTML or the main bundle). The rAF loop is
 * stopped while the hero is offscreen or the tab is hidden, and the whole
 * layer unmounts when the gate flips false (e.g. theme switch to light).
 *
 * Everything else sees the CSS gradient mesh + particle field instead.
 */
const Aurora = lazy(() => import('@/components/react-bits/aurora'));

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

export function HeroAurora() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [touch, setTouch] = useState(false);
  const [webgl] = useState(isWebGLAvailable); // stable after first client render
  const [inView, setInView] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    setViewportWidth(window.innerWidth);

    const onVisibility = () => setPaused(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVisibility);

    const themeObserver = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);

    let io: IntersectionObserver | undefined;
    if (sectionRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) setInView(entry.isIntersecting);
        },
        { rootMargin: '0px 0px -10% 0px' },
      );
      io.observe(sectionRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      themeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      io?.disconnect();
    };
  }, []);

  const enabled = shouldRenderWebglAurora({
    mounted,
    reducedMotion,
    dark,
    touch,
    webgl,
    inView,
    viewportWidth,
  });

  return (
    <div ref={sectionRef} aria-hidden data-hero-aurora className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {enabled ? (
        <Suspense fallback={null}>
          <Aurora paused={paused} />
        </Suspense>
      ) : null}
    </div>
  );
}

