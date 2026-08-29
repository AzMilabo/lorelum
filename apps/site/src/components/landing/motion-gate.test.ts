import { describe, expect, test } from 'bun:test';
import { shouldEnableCursorEffects } from './motion-gate';

describe('shouldEnableCursorEffects', () => {
  test('enables for fine pointer with motion allowed', () => {
    expect(shouldEnableCursorEffects({ finePointer: true, reducedMotion: false })).toBe(true);
  });

  test('disables on touch (coarse pointer)', () => {
    expect(shouldEnableCursorEffects({ finePointer: false, reducedMotion: false })).toBe(false);
  });

  test('disables under reduced motion', () => {
    expect(shouldEnableCursorEffects({ finePointer: true, reducedMotion: true })).toBe(false);
  });

  test('disables for touch + reduced motion', () => {
    expect(shouldEnableCursorEffects({ finePointer: false, reducedMotion: true })).toBe(false);
  });
});
