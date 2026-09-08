import type { RefObject } from 'react';
import { VariableProximity } from '@/components/react-bits';
import { useCanvasEffectsEnabled } from './hooks/use-canvas-effects';

/**
 * Motion-aware wrapper around the vendored `react-bits/variable-proximity`
 * base.
 *
 * NOT the base component: `@/components/react-bits/variable-proximity` is the
 * upstream copy; this file is the landing's accessibility gate on top of it.
 * Keep this name distinct (`motion-aware-*`) so a reader never confuses the
 * plain vendored component with the safe-to-use landing one.
 *
 * Renders the label as a plain span until hydration proves the pointer is
 * fine (the `VariableProximity` effect drives per-letter
 * weight/optical-size axes off cursor distance — Bricolage Grotesque's
 * `opsz`/`wght` range). On touch, the text stays
 * static but fully styled; no rAF mouse loop is ever mounted.
 */
export function VariableProximityText({
  label,
  className,
  fromFontVariationSettings,
  toFontVariationSettings,
  containerRef,
  radius = 120,
}: {
  label: string;
  className?: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  containerRef: RefObject<HTMLElement | null>;
  radius?: number;
}) {
  const enabled = useCanvasEffectsEnabled();

  if (!enabled) {
    return <span className={className}>{label}</span>;
  }

  return (
    <VariableProximity
      label={label}
      className={className}
      fromFontVariationSettings={fromFontVariationSettings}
      toFontVariationSettings={toFontVariationSettings}
      containerRef={containerRef}
      radius={radius}
    />
  );
}
