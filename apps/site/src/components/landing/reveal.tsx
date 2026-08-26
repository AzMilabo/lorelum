import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Scroll-linked reveal wrapper — pure CSS, zero JS.
 *
 * Renders a plain div carrying `.landing-reveal`, which is driven by a
 * native CSS scroll-driven animation (`animation-timeline: view()`). The
 * browser compositor fades/slides the element in as it enters the viewport,
 * so scrolling costs no JS per frame and stays silky-smooth. Progressively
 * enhanced: browsers without `view()` timelines simply see the content.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('landing-reveal', className)}>{children}</div>;
}
