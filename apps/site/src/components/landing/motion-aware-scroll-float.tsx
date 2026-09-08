import { ScrollFloat } from '@/components/react-bits';

/**
 * Motion-aware wrapper around the vendored `react-bits/scroll-float` base.
 *
 * NOT the base component: `@/components/react-bits/scroll-float` is the
 * upstream copy; this file is the landing's accessibility gate on top of it.
 * Keep this name distinct (`motion-aware-*`) so a reader never confuses the
 * plain vendored component with the safe-to-use landing one.
 *
 * ScrollFloat scrubs each character up out of an `overflow-hidden` mask as the
 * heading scrolls through the viewport. On the server the heading renders as
 * a plain, fully-visible string inside an h2 (no per-char spans, no mask, no
 * scrubbed reveal), matching the rest of the landing's motion-aware pattern.
 */
export function ScrollFloatText({
  text,
  className,
  containerClassName = '',
  textClassName = '',
  ...scrollFloatProps
}: {
  text: string;
  className?: string;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
}) {
  return (
    <ScrollFloat
      containerClassName={containerClassName || className || ''}
      textClassName={textClassName || className || ''}
      {...scrollFloatProps}
    >
      {text}
    </ScrollFloat>
  );
}
