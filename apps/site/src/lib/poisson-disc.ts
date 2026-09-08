/**
 * Bridson (2007) poisson-disc sampling — a typed, dependency-free port of the
 * tiny `poisson-disk-sampling` package API that the Antigravity site's particle
 * component uses (`new PoissonDiskSampling({...}).fill()`).
 *
 * Produces a jitter-free even spread of points (no clumps, no grid artefacts),
 * which is what gives the site's dust field its uniform texture.
 */
export interface PoissonDiscOptions {
  /** `[width, height]` of the sampling region. */
  shape: [number, number];
  /** Minimum distance between any two samples. */
  minDistance: number;
  /** Upper bound of the candidate radius (defaults to `minDistance * 1.2`). */
  maxDistance?: number;
  /** Candidate attempts per active sample before retiring it. */
  tries?: number;
}

export function poissonDiscFill(options: PoissonDiscOptions): Array<[number, number]> {
  const { shape, minDistance } = options;
  const maxDistance = options.maxDistance ?? minDistance * 1.2;
  const tries = options.tries ?? 30;
  const [width, height] = shape;

  // Grid acceleration: one candidate check per cell radius (√2 cells).
  const cellSize = minDistance / Math.SQRT2;
  const gridW = Math.max(1, Math.ceil(width / cellSize));
  const gridH = Math.max(1, Math.ceil(height / cellSize));
  const grid = new Int32Array(gridW * gridH).fill(-1);
  const samples: Array<[number, number]> = [];
  const active: number[] = [];

  const cellOf = (x: number, y: number) =>
    Math.floor(y / cellSize) * gridW + Math.floor(x / cellSize);

  const add = (x: number, y: number) => {
    samples.push([x, y]);
    grid[cellOf(x, y)] = samples.length - 1;
    active.push(samples.length - 1);
  };

  add(Math.random() * width, Math.random() * height);

  while (active.length > 0) {
    const activeIndex = Math.floor(Math.random() * active.length);
    const [ax, ay] = samples[active[activeIndex]]!;
    let accepted = false;

    for (let attempt = 0; attempt < tries; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minDistance + Math.random() * (maxDistance - minDistance);
      const x = ax + Math.cos(angle) * radius;
      const y = ay + Math.sin(angle) * radius;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      let ok = true;
      for (let oy = -2; oy <= 2 && ok; oy++) {
        for (let ox = -2; ox <= 2 && ok; ox++) {
          const nx = gx + ox;
          const ny = gy + oy;
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
          const si = grid[ny * gridW + nx]!;
          if (si === -1) continue;
          const dx = samples[si]![0] - x;
          const dy = samples[si]![1] - y;
          if (dx * dx + dy * dy < minDistance * minDistance) ok = false;
        }
      }
      if (ok) {
        add(x, y);
        accepted = true;
        break;
      }
    }
    if (!accepted) active.splice(activeIndex, 1);
  }

  return samples;
}
