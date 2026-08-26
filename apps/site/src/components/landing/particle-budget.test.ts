import { describe, expect, test } from 'bun:test';
import { getCanvasScale, getParticleCount } from './particle-budget';

describe('getParticleCount', () => {
  test('returns zero under reduced motion', () => {
    expect(getParticleCount({ width: 1440, height: 900, dpr: 1, reducedMotion: true })).toBe(0);
    expect(
      getParticleCount({ width: 3840, height: 2160, dpr: 2, reducedMotion: true }),
    ).toBe(0);
  });

  test('scales with viewport area', () => {
    expect(
      getParticleCount({ width: 1440, height: 900, dpr: 1, reducedMotion: false }),
    ).toBe(40); // 1_296_000 / 40_000 = 32.4 -> clamped to 40
    expect(
      getParticleCount({ width: 1920, height: 1080, dpr: 1, reducedMotion: false }),
    ).toBe(52); // 2_073_600 / 40_000 = 51.84
  });

  test('clamps to the upper bound on huge screens', () => {
    expect(
      getParticleCount({ width: 3840, height: 2160, dpr: 2, reducedMotion: false }),
    ).toBe(90); // 8_294_400 / 40_000 = 207 -> clamped to 90
  });

  test('dpr does not change the particle count', () => {
    expect(
      getParticleCount({ width: 1440, height: 900, dpr: 3, reducedMotion: false }),
    ).toBe(getParticleCount({ width: 1440, height: 900, dpr: 1, reducedMotion: false }));
  });
});

describe('getCanvasScale', () => {
  test('caps device pixel ratio at 1.5', () => {
    expect(getCanvasScale(1)).toBe(1);
    expect(getCanvasScale(1.5)).toBe(1.5);
    expect(getCanvasScale(2)).toBe(1.5);
    expect(getCanvasScale(3)).toBe(1.5);
  });

  test('falls back to 1 for a missing dpr', () => {
    expect(getCanvasScale(0)).toBe(1);
    expect(getCanvasScale(NaN)).toBe(1);
  });
});
