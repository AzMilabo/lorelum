import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Scroll-linked vertical parallax wrapper — pure CSS, zero JS.
 *
 * Translates children from `from` to `to` px as the element travels through
 * the viewport. Driven by a native CSS scroll-driven animation
 * (`animation-timeline: view()`), so the browser compositor owns the motion
 * and there is no per-frame JavaScript. Progressively enhanced: browsers
 * without `view()` timelines see the element unmoved.
 */
export function ScrollParallax({
  children,
  className,
  from = 24,
  to = -24,
}: {
  children: ReactNode;
  className?: string;
  from?: number;
  to?: number;
}) {
  const style = {
    '--landing-parallax-from': `${from}px`,
    '--landing-parallax-to': `${to}px`,
  } as CSSProperties;

  return (
    <div className={cn('landing-parallax', className)} style={style}>
      {children}
    </div>
  );
}
