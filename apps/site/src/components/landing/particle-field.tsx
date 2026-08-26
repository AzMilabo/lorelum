import { useEffect, useRef } from 'react';
import { getCanvasScale, getParticleCount } from './particle-budget';

/**
 * Lightweight 2D particle field for the landing background.
 *
 * Deliberately cheap: no WebGL, no dependencies, ~40-90 slowly drifting
 * dots drawn with canvas 2D. The rAF loop only runs while the tab is
 * visible, the backing store is capped at 1.5x DPR, and everything is
 * disabled for `prefers-reduced-motion`. Colors follow the Fumadocs theme
 * (bright on dark, faint on light) and update live when the theme flips.
 */
interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  /** Base alpha (0..1) before the per-particle twinkle. */
  alpha: number;
  phase: number;
  /** Twinkle speed in radians/second. */
  speed: number;
  /** "r,g,b" triplet, alpha applied per frame. */
  rgb: string;
}

const DARK_RGBS = ['255,255,255', '129,140,248', '34,211,238', '232,121,249'];
const LIGHT_RGBS = ['79,70,229', '14,116,144', '147,51,234'];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticles(count: number, w: number, h: number, dark: boolean): Particle[] {
  const rgbs = dark ? DARK_RGBS : LIGHT_RGBS;
  const alphaRange = dark ? [0.18, 0.45] : [0.08, 0.18];
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: rand(0.8, 2.4),
    vx: rand(-0.08, 0.08),
    vy: rand(-0.18, -0.04),
    alpha: rand(alphaRange[0], alphaRange[1]),
    phase: Math.random() * Math.PI * 2,
    speed: rand(0.4, 1.1),
    rgb: rgbs[Math.floor(Math.random() * rgbs.length)],
  }));
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let particles: Particle[] = [];

    const isDark = () => document.documentElement.classList.contains('dark');

    const resize = () => {
      const dpr = getCanvasScale(window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = getParticleCount({
        width: w,
        height: h,
        dpr,
        reducedMotion: false,
      });
      particles = createParticles(count, w, h, isDark());
    };

    const tick = () => {
      if (!running) return;
      const t = performance.now() / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap around edges (with a margin so dots fade out cleanly).
        if (p.x < -12) p.x = w + 12;
        else if (p.x > w + 12) p.x = -12;
        if (p.y < -12) p.y = h + 12;
        else if (p.y > h + 12) p.y = -12;
        const twinkle = 0.55 + 0.45 * Math.sin(t * p.speed + p.phase);
        ctx.fillStyle = `rgba(${p.rgb},${(p.alpha * twinkle).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(raf);

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) start();
      else stop();
    };

    const onResize = () => {
      resize();
      if (running) start();
    };

    // Re-color when the theme flips (html gets/loses `.dark`).
    const observer = new MutationObserver(() => {
      const dark = isDark();
      const w = window.innerWidth;
      const h = window.innerHeight;
      particles = createParticles(particles.length, w, h, dark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    resize();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
