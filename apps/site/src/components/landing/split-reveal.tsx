import { useReveal } from './use-reveal';
import { cn } from '@/lib/cn';

/**
 * Word-by-word masked reveal for headings.
 *
 * Each word sits inside an overflow-hidden line, rising from 110% below its
 * own baseline to 0 with a per-word stagger — the "premium type" signature
 * you see on the best product sites. One-shot (IO fires once), transform-only
 * (compositor-cheap), SSR-safe via `useReveal` (visible in the HTML, hides
 * only below the fold after hydration).
 */
export function SplitReveal({
  text,
  className,
  wordClassName,
  delay = 0,
  step = 70,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  /** ms before the first word starts. */
  delay?: number;
  /** ms between words. */
  step?: number;
}) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <span ref={ref} className={cn('landing-split', visible && 'is-visible', className)}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="landing-split-mask inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
          <span
            className={cn('landing-split-word inline-block will-change-transform', wordClassName)}
            style={{ transitionDelay: `${delay + i * step}ms` }}
          >
            {word}
          </span>
          {i < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}
