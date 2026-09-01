import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { useReveal } from './use-reveal';

function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

const HAS_CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

/**
 * Word/character reveal for a line of copy, Antigravity-style.
 *
 * Each unit sits in an overflow-hidden box and rises from below its own
 * baseline with a per-unit stagger once it scrolls into view. `auto` picks
 * characters for CJK text (spaces are meaningless there) and words for
 * anything else, so both locales read naturally.
 *
 * Reuses `useReveal`, so it is SSR-safe (visible in the HTML, hides below
 * the fold only after hydration) and respects `prefers-reduced-motion`.
 */
export function CharReveal({
  text,
  mode = 'auto',
  className,
  delay = 0,
  step = 22,
}: {
  text: string;
  mode?: 'auto' | 'words' | 'chars';
  className?: string;
  /** Milliseconds before the first unit reacts. */
  delay?: number;
  /** Milliseconds between each unit. */
  step?: number;
}) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const useChars = mode === 'chars' || (mode === 'auto' && HAS_CJK.test(text));
  const units = useChars ? splitGraphemes(text) : text.split(/\s+/).filter(Boolean);

  return (
    <span ref={ref} className={cn('landing-char', visible && 'is-visible', className)}>
      {units.map((unit, i) => (
        <span
          key={`${unit}-${i}`}
          className="landing-char-box inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-bottom"
        >
          <span
            className="landing-char-unit inline-block will-change-transform"
            style={{ transitionDelay: `${delay + i * step}ms` } as CSSProperties}
          >
            {unit}
            {!useChars && i < units.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
          </span>
        </span>
      ))}
    </span>
  );
}
