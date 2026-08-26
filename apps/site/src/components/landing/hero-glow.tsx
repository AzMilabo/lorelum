import { ScrollParallax } from './scroll-parallax';

/**
 * Hero glow — pure CSS.
 *
 * A soft radial bloom behind the hero copy. A slow transform drift keeps it
 * alive (compositor-only), and the wrapper parallaxes gently as the hero
 * scrolls out. No JS, no pointer listeners — calm and cheap on purpose.
 */
export function HeroGlow() {
  return (
    <ScrollParallax from={40} to={-40} className="pointer-events-none absolute inset-0">
      <div aria-hidden className="landing-hero-glow" />
    </ScrollParallax>
  );
}
