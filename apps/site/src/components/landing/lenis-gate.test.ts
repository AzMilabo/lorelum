import { describe, expect, test } from 'bun:test';
import { shouldInitLenis } from './lenis-gate';

describe('shouldInitLenis', () => {
  test('enables smooth scroll when motion is fine', () => {
    expect(shouldInitLenis(false)).toBe(true);
  });

  test('falls back to native scroll under reduced motion', () => {
    expect(shouldInitLenis(true)).toBe(false);
  });
});
