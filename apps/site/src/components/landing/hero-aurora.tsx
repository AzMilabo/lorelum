import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { shouldRenderWebglAurora } from './gates/aurora-gate';
import { gsap, registerGsapPlugins, ScrollTrigger } from './gsap-client';
import { detectWebglRenderer, type WebglCapability } from './webgl-renderer';

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
/**
 * Direct single-file import (NOT the `react-bits` barrel): `React.lazy` must
 * resolve to the component's own module so Aurora lands in a separate async
 * chunk. Importing through `@/components/react-bits` would pull the whole
 * barrel (every vendored component) into this chunk and defeat the lazy-load.
 *
 * The chunk is fetched through a shared promise that `HeroAurora` also kicks
 * off eagerly on mount: the download then overlaps the hero entrance instead
 * of starting only after the settle timer, which used to make the aurora
 * appear seconds after a refresh (timer + full chunk round-trip + idle wait,
 * all serial).
 */
type AuroraModule = typeof import('@/components/react-bits/aurora');
let auroraChunkPromise: Promise<AuroraModule> | null = null;
const loadAuroraChunk = () =>
  (auroraChunkPromise ??= import('@/components/react-bits/aurora'));

const Aurora = lazy(loadAuroraChunk);

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
  const [touch, setTouch] = useState(false);
  const [webgl] = useState(isWebGLAvailable); // stable after first client render
  // Software rasterizers (Microsoft Basic Render Driver / SwiftShader) choke on
  // a full-screen WebGL layer — the aurora drops to ~30fps while the CSS-only
  // fallback holds 60. Detected once on mount; `unknown` (SSR / unreadable)
  // maps to hardware so we never degrade an unclassified setup.
  const [hardwareWebgl, setHardwareWebgl] = useState<WebglCapability | null>(null);
  const [inView, setInView] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  // The WebGL chunk load + context/shader init lands as a main-thread spike, so
  // it is deferred until the one-shot text entrance (clip/fade, ~1.1s) has
  // painted — otherwise the init competes with the headline reveal and produces
  // visible hitches on the first screen. The aurora then fades in underneath.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHardwareWebgl(detectWebglRenderer());
    setDark(document.documentElement.classList.contains('dark'));
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    setViewportWidth(window.innerWidth);

    // Start fetching the WebGL chunk NOW, in parallel with the entrance —
    // without this the download only begins once the settle timer fires,
    // adding a full network round-trip after the timer before the aurora can
    // even mount. On a refresh the chunk is usually cached, but the fetch
    // still has to be issued; issuing it early costs nothing extra.
    void loadAuroraChunk();

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

    // Defer the WebGL *init* (context + shader compile) until the hero's
    // one-shot text entrance has painted. The chunk itself is already
    // downloading in parallel (see loadAuroraChunk), so this delay only gates
    // the compile spike, not the network. Longest entrance delay on the hero
    // copy is ~0.42s + ~0.7s duration — 1.2s covers it with a little headroom.
    const settleTimer = window.setTimeout(() => setSettled(true), 1200);

    // Viewport gate for the WebGL layer. This deliberately uses a GSAP
    // ScrollTrigger, NOT IntersectionObserver: the landing runs ScrollSmoother,
    // whose transform-based scrolling means IO callbacks never fire (the hero
    // would read as "in view" forever and the aurora would keep rasterizing a
    // full-screen WebGL canvas even after it scrolled away — the single biggest
    // idle GPU cost on this page). ScrollTrigger follows the smoother's
    // scroller, so the gate flips the moment the hero leaves.
    let cleanupGate: (() => void) | undefined;
    registerGsapPlugins();
    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => setInView(self.isActive),
      });
      return () => trigger.kill();
    });
    cleanupGate = () => ctx.revert();

    return () => {
      window.clearTimeout(settleTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      themeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      cleanupGate?.();
    };
  }, []);

  const enabled =
    settled &&
    shouldRenderWebglAurora({
      mounted,
      dark,
      touch,
      webgl,
      // `null` (unknown) is treated as true by the gate — only an explicit
      // software-renderer reading disables the aurora.
      hardwareWebgl: hardwareWebgl === 'software' ? false : null,
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

