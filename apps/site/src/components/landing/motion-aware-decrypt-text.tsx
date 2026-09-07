import { DecryptedText } from '@/components/react-bits';

/**
 * Motion-aware wrapper around the vendored `react-bits/decrypted-text` base.
 *
 * NOT the base component: `@/components/react-bits/decrypted-text` is the
 * upstream copy; this file is the landing's accessibility gate on top of it.
 * Keep this name distinct (`motion-aware-*`) so a reader never confuses the
 * plain vendored component with the safe-to-use landing one.
 *
 * The hero badge ticks into place as a stream of scramble characters that
 * resolve left-to-right once it enters the viewport, in the spirit of
 * Antigravity's technical UI. On the server the real text is always present —
 * no random chars, no interval, no flash.
 */
export function DecryptText({
  text,
  className,
  speed = 30,
  maxIterations = 8,
}: {
  text: string;
  className?: string;
  speed?: number;
  maxIterations?: number;
}) {
  return (
    <DecryptedText
      text={text}
      animateOn="inViewHover"
      revealDirection="start"
      sequential={false}
      speed={speed}
      maxIterations={maxIterations}
      className={className}
      encryptedClassName="landing-decrypt-scrambled"
      useOriginalCharsOnly
    />
  );
}
