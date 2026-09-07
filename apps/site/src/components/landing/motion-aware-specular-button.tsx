import { useEffect, useState, type ReactNode } from 'react';
import { SpecularButton, type SpecularButtonProps } from '@/components/react-bits';
import { shouldEnableCanvasEffects } from './gates/motion-gate';

export type MotionAwareSpecularButtonProps = Omit<SpecularButtonProps, 'enableFx'>;

/**
 * Motion-gated SpecularButton.
 *
 * The WebGL specular edge is a pointer-driven effect, so it only makes sense
 * with a fine pointer: touch users get the identical pill (glass tint,
 * shadow, press feedback) minus the light canvas, and no per-frame render
 * loop is ever started for them.
 */
export function MotionAwareSpecularButton({ children, ...props }: MotionAwareSpecularButtonProps & { children?: ReactNode }) {
  const [fxEnabled, setFxEnabled] = useState(false);

  useEffect(() => {
    setFxEnabled(shouldEnableCanvasEffects({ finePointer: window.matchMedia('(pointer: fine)').matches }));
  }, []);

  return (
    <SpecularButton enableFx={fxEnabled} {...props}>
      {children}
    </SpecularButton>
  );
}
