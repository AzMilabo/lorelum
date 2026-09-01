import { useEffect, useRef, useState } from 'react';
import { gsap, registerGsapPlugins } from './gsap-client';
import { shouldEnableCursorEffects } from './motion-gate';

const INTERACTIVE = 'a, button, [data-cursor], input, textarea, [role="button"]';

/**
 * Antigravity-style cursor follower — a trailing ring around the pointer.
 *
 * The native cursor is deliberately kept: hiding it risks a moment with no
 * visible pointer (or a barely-seen dot), which reads as "broken". Instead the
 * ring trails the pointer on a springy `quickTo` (~0.35s) and swells over
 * interactive elements (`back.out(1.7)`), so the page still feels alive while
 * the user always has the real cursor. Enabled only for fine pointers with
 * motion allowed; touch and reduced-motion users get none of the overlay.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shouldEnableCursorEffects({ finePointer: fine, reducedMotion: reduced })) return;
    registerGsapPlugins();

    const ring = ringRef.current;
    if (!ring) return;
    setEnabled(true);

    const q: {
      rx: ((v: number) => void) | null;
      ry: ((v: number) => void) | null;
    } = { rx: null, ry: null };

    const ctx = gsap.context(() => {
      gsap.set(ring, { xPercent: -50, yPercent: -50, x: -100, y: -100, force3D: true });
      q.rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power2.out' });
      q.ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power2.out' });
    });

    const onMove = (e: PointerEvent) => {
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

    return () => {
      ctx.revert();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
    };
  }, []);

  return (
    <div ref={ringRef} aria-hidden className={`landing-cursor-ring${enabled ? ' on' : ''}`} />
  );
}
