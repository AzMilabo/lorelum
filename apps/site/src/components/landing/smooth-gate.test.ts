import { describe, expect, test } from 'bun:test';
import { shouldUseSmoothScroll } from './smooth-gate';

describe('shouldUseSmoothScroll', () => {
  test('enables ScrollSmoother when motion is fine', () => {
    expect(shouldUseSmoothScroll(false)).toBe(true);
  });

  test('falls back to native scroll under reduced motion', () => {
    expect(shouldUseSmoothScroll(true)).toBe(false);
  });
});
