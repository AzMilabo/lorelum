import { Link } from '@tanstack/react-router';
import { ArrowRight, Star } from 'lucide-react';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { HeroAurora } from './hero-aurora';
import { HeroGlow } from './hero-glow';
import { TerminalShowcase } from './terminal-showcase';

/**
 * Hero — Antigravity-grade type over a lazy WebGL aurora.
 *
 * The outer section is full-bleed so the aurora/glow layers can reach the
 * viewport edges; the copy lives in a centered `max-w-6xl` column. The H1 is
 * revealed with a CSS masked rise (transform + clip-path only, no JS) and
 * the WebGL aurora is gated to dark/desktop/reduced-motion-off, pausing when
 * the hero scrolls away. Everything else sees the CSS mesh + particles.
 */
export function Hero({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <section className="relative isolate w-full overflow-x-clip">
      <HeroAurora />
      <HeroGlow />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center px-4 pb-24 pt-16 text-center sm:pt-20">
        <span className="landing-hero-item inline-flex items-center gap-2 rounded-full border border-fd-border/60 bg-fd-card/50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-fd-muted-foreground backdrop-blur">
          <span className="landing-badge-dot size-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
          {t.heroBadge}
        </span>

        <h1 className="landing-hero-title mt-8 max-w-5xl text-balance font-display text-[clamp(3rem,8.5vw,7.25rem)] font-medium leading-[1.0] tracking-[-0.035em]">
          <span className="landing-line block" style={{ animationDelay: '0.05s' }}>
            {t.heroTitleBefore}
            <span className="landing-gradient-text">{t.heroTitleGradient}</span>
          </span>
          <span className="landing-line block" style={{ animationDelay: '0.18s' }}>
            {t.heroTitleAfter}
          </span>
        </h1>

        <p className="landing-hero-sub mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-fd-muted-foreground sm:text-lg">
          {t.heroSub}
        </p>

        <div className="landing-hero-item mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3" style={{ animationDelay: '0.32s' }}>
          <Link
            to="/$lang/docs/$"
            params={{ lang, _splat: '' }}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(139,92,246,0.6)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-8px_rgba(139,92,246,0.75)]"
          >
            {t.ctaDocs}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
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

        <TerminalShowcase lang={lang} />
      </div>
    </section>
  );
}


