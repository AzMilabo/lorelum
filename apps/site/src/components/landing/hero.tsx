import { useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Star } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { HeroAurora } from './hero-aurora';
import { HeroGlow } from './hero-glow';
import { TerminalShowcase } from './terminal-showcase';
import { shouldEnableCursorEffects } from './motion-gate';
import { gsap, registerGsapPlugins } from './gsap-client';
import Magnet from '@/components/react-bits/magnet';
import { useMagnetEnabled } from './use-magnet';

/**
 * Hero — Antigravity-grade type, alive on three axes:
 *
 *  1. Load: CSS masked line rise (transform + clip-path, one-shot).
 *  2. Cursor: multi-layer pointer parallax — glow, title and terminal move at
 *     different depths on a spring, so the hero has real dimensional life.
 *  3. Scroll: the copy block exits (fade + rise) as the hero leaves while the
 *     terminal lingers slightly longer (CSS view() timeline, compositor).
 *
 * The WebGL aurora is gated to dark/desktop/reduced-motion-off and pauses
 * when the hero scrolls away; ambient orbs drift behind the copy.
 */
export function Hero({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const pointerOkRef = useRef(false);
  const magnetOn = useMagnetEnabled();

  useEffect(() => {
    pointerOkRef.current = shouldEnableCursorEffects({
      finePointer: window.matchMedia('(pointer: fine)').matches,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  }, []);

  // Hero scroll exit — fades + lifts the copy as the section leaves, while the
  // terminal lingers a touch longer. CSS `view()` timelines can't follow the
  // content a ScrollSmoother translates, so the scrub is GSAP-driven here.
  useEffect(() => {
    const section = sectionRef.current;
    const copy = copyRef.current;
    const terminal = termRef.current;
    if (!section || !copy || !terminal) return;
    registerGsapPlugins();

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const copyEnd = () => section.offsetHeight * 0.55;
      const termEnd = () => section.offsetHeight * 0.78;

      gsap.fromTo(
        copy,
        { opacity: 1, y: 0 },
        {
          opacity: 0,
          y: -46,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: copyEnd,
            scrub: true,
          },
        },
      );

      gsap.fromTo(
        terminal,
        { opacity: 1, y: 0 },
        {
          opacity: 0.15,
          y: -18,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: termEnd,
            scrub: true,
          },
        },
      );
    });

    return () => mm.revert();
  }, []);

  // Cursor parallax — normalized pointer (-1..1) eased by springs.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.8 });
  const smy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.8 });
  const titleX = useTransform(smx, (v) => v * -14);
  const titleY = useTransform(smy, (v) => v * -9);
  const glowX = useTransform(smx, (v) => v * 36);
  const glowY = useTransform(smy, (v) => v * 28);
  const termX = useTransform(smx, (v) => v * 8);
  const termY = useTransform(smy, (v) => v * 6);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerOkRef.current) return;
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
    my.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section
      ref={sectionRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative isolate w-full overflow-x-clip"
    >
      <HeroAurora />

      {/* Ambient orbs (pure CSS drift) */}
      <div aria-hidden className="landing-orb landing-orb-1" />
      <div aria-hidden className="landing-orb landing-orb-2" />
      <div aria-hidden className="landing-orb landing-orb-3" />

      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ x: glowX, y: glowY }}>
        <HeroGlow />
      </motion.div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center px-4 pb-24 pt-16 text-center sm:pt-20">
        <div ref={copyRef} className="landing-hero-scroll flex w-full flex-col items-center">
          <span className="landing-hero-item inline-flex items-center gap-2 rounded-full border border-fd-border/60 bg-fd-card/50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-fd-muted-foreground backdrop-blur">
            <span className="landing-badge-dot size-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            {t.heroBadge}
          </span>

          <motion.div className="w-full" style={{ x: titleX, y: titleY }}>
            <h1 className="landing-hero-title mt-8 max-w-5xl text-balance font-display text-[clamp(3rem,8.5vw,7.25rem)] font-medium leading-[1.0] tracking-[-0.035em]">
              <span className="landing-line block" style={{ animationDelay: '0.05s' }}>
                {t.heroTitleBefore}
                <span className="landing-gradient-text">{t.heroTitleGradient}</span>
              </span>
              <span className="landing-line block" style={{ animationDelay: '0.18s' }}>
                {t.heroTitleAfter}
              </span>
            </h1>
          </motion.div>

          <p className="landing-hero-sub mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-fd-muted-foreground sm:text-lg">
            {t.heroSub}
          </p>

          <div className="landing-hero-item mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3" style={{ animationDelay: '0.32s' }}>
            <Magnet disabled={!magnetOn} magnetStrength={8} padding={64} wrapperClassName="inline-block">
              <Link
                to="/$lang/docs/$"
                params={{ lang, _splat: '' }}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(139,92,246,0.6)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-8px_rgba(139,92,246,0.75)]"
              >
                <span aria-hidden className="landing-btn-shine" />
                {t.ctaDocs}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Magnet>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/50 px-6 py-3 text-sm font-medium text-fd-foreground backdrop-blur transition-colors hover:bg-fd-accent"
            >
              <Star className="size-4" />
              {t.ctaGithub}
            </a>
          </div>

          <p className="landing-hero-item mt-5 text-xs tracking-wide text-fd-muted-foreground/70" style={{ animationDelay: '0.42s' }}>
            {t.heroTrust}
          </p>
        </div>

        <motion.div className="landing-hero-scroll-slow w-full" style={{ x: termX, y: termY }}>
          <div ref={termRef}>
            <TerminalShowcase lang={lang} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
