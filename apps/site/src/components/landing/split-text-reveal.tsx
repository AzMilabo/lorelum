import { useEffect, useRef } from 'react';
import { gsap, registerGsapPlugins, SplitText } from './gsap-client';
import { cn } from '@/lib/cn';

const HAS_CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

/**
 * GSAP SplitText reveal for a line of copy, Antigravity-style.
 *
 * Splits into words (Latin) or characters (CJK) and staggers them in as they
 * scroll into view — the exact "premium type" mechanism Antigravity's
 * `FeatureExplorerNew` ships (`SplitText` + `gsap.set(chars, opacity 0)` + a
 * one-shot timeline at `top 85%`). It is SSR-safe: the text renders as plain
 * visible HTML so no-JS and above-the-fold content never flash. Under
 * `prefers-reduced-motion` it never splits, so the text stays as a single
 * readable element. Created inside `gsap.matchMedia` and split DOM is reverted
 * on unmount so SPA navigation can't leak.
 */
export function SplitTextReveal({
  text,
  mode = 'auto',
  className,
  delay = 0,
  y = 16,
}: {
  text: string;
  mode?: 'auto' | 'words' | 'chars';
  className?: string;
  /** Milliseconds before the first unit reacts. */
  delay?: number;
  /** Vertical travel in px. */
  y?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsapPlugins();

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const useChars = mode === 'chars' || (mode === 'auto' && HAS_CJK.test(text));
      const split = SplitText.create(el, {
        type: 'chars,words',
        tag: 'span',
        charsClass: 'split-char',
        wordsClass: 'split-word',
      });
      const units = useChars ? split.chars : split.words;
      if (!units || units.length === 0) return;

      // If the heading is already on screen when hydration lands, keep it fully
      // visible. Hiding it would cause a visible flash before the reveal, which
      // is worse than the small benefit of re-animating an above-the-fold title.
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
        return () => split.revert();
      }

      const count = units.length;
      const stagger = useChars ? Math.min(0.012, 0.5 / count) : Math.min(0.05, 0.7 / count);

      gsap.set(units, { opacity: 0, y });
      const tl = gsap.timeline({
        delay: delay / 1000,
        defaults: { ease: 'power2.out', duration: 0.5 },
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
      tl.to(units, { opacity: 1, y: 0, stagger });

      return () => {
        tl.scrollTrigger?.kill();
        split.revert();
      };
    });

    return () => mm.revert();
  }, [text, mode, delay, y]);

  return (
    <span ref={ref} className={cn('landing-splittext', className)}>
      {text}
    </span>
  );
}
