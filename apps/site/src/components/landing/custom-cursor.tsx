import { useEffect, useRef, useState } from 'react';
import { gsap, registerGsapPlugins } from './gsap-client';
import { shouldEnableCursorEffects } from './motion-gate';

const INTERACTIVE = 'a, button, [data-cursor], input, textarea, [role="button"]';

/**
 * Antigravity-style custom cursor — a precise dot plus a trailing ring.
 *
 * The dot tracks the pointer almost instantly (`quickTo` ~0.1s) while the ring
 * trails on a springier `quickTo` (~0.35s), and the ring scales up over
 * interactive elements (`back.out(1.7)`). Hiding the native cursor is what
 * makes it feel bespoke, but it's only enabled for fine pointers with motion
 * allowed, and it adds no listeners/DOM when disabled. On reduced-motion or
 * touch the native cursor is untouched.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shouldEnableCursorEffects({ finePointer: fine, reducedMotion: reduced })) return;
    registerGsapPlugins();

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    setEnabled(true);

    const q: {
      dx: ((v: number) => void) | null;
      dy: ((v: number) => void) | null;
      rx: ((v: number) => void) | null;
      ry: ((v: number) => void) | null;
    } = { dx: null, dy: null, rx: null, ry: null };

    const ctx = gsap.context(() => {
      gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100, force3D: true });
      q.dx = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power2.out' });
      q.dy = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power2.out' });
      q.rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power2.out' });
      q.ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power2.out' });
    });

    const onMove = (e: PointerEvent) => {
      q.dx?.(e.clientX);
      q.dy?.(e.clientY);
      q.rx?.(e.clientX);
      q.ry?.(e.clientY);
    };
    const setHover = (active: boolean) => {
      gsap.to(ring, {
        scale: active ? 1.7 : 1,
        opacity: active ? 0.9 : 0.55,
        duration: active ? 0.3 : 0.35,
        ease: active ? 'back.out(1.7)' : 'power2.out',
      });
      gsap.to(dot, { scale: active ? 0.5 : 1, duration: 0.2, ease: 'power2.out' });
    };
    const onOver = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) setHover(true);
    };
    const onOut = (e: PointerEvent) => {
      const target = e.target;
      const related = e.relatedTarget;
      const stillInside =
        target instanceof Element &&
        related instanceof Element &&
        target.closest(INTERACTIVE) === related.closest(INTERACTIVE);
      if (!stillInside && target instanceof Element && target.closest(INTERACTIVE)) setHover(false);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.documentElement.classList.add('landing-custom-cursor');

    return () => {
      ctx.revert();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.documentElement.classList.remove('landing-custom-cursor');
    };
  }, []);

  return (
    <>
      <div ref={dotRef} aria-hidden className={`landing-cursor-dot${enabled ? ' on' : ''}`} />
      <div ref={ringRef} aria-hidden className={`landing-cursor-ring${enabled ? ' on' : ''}`} />
    </>
  );
}
