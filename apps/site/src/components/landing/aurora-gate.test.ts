import { describe, expect, test } from 'bun:test';
import { shouldUseWebglAurora } from './aurora-gate';

describe('shouldUseWebglAurora', () => {
  test('enables only on dark + desktop + no reduced motion', () => {
    expect(
      shouldUseWebglAurora({ isDark: true, isDesktop: true, prefersReducedMotion: false }),
    ).toBe(true);
  });

  test('stays on the CSS fallback for light theme', () => {
    expect(
      shouldUseWebglAurora({ isDark: false, isDesktop: true, prefersReducedMotion: false }),
    ).toBe(false);
  });

  test('stays on the CSS fallback on mobile', () => {
    expect(
      shouldUseWebglAurora({ isDark: true, isDesktop: false, prefersReducedMotion: false }),
    ).toBe(false);
  });

  test('stays on the CSS fallback for reduced motion', () => {
    expect(
      shouldUseWebglAurora({ isDark: true, isDesktop: true, prefersReducedMotion: true }),
    ).toBe(false);
  });
});
