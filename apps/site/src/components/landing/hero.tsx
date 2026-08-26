import { Link } from '@tanstack/react-router';
import { ArrowRight, Star } from 'lucide-react';
import BlurText from '@/components/react-bits/blur-text';
import Magnet from '@/components/react-bits/magnet';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { HeroGlow } from './hero-glow';
import { Reveal } from './reveal';
import { TerminalShowcase } from './terminal-showcase';

export function Hero({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <section className="relative isolate mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center overflow-x-clip px-4 pb-28 pt-20 text-center sm:pt-28">
      <HeroGlow />

      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-fd-border/60 bg-fd-card/50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-fd-muted-foreground backdrop-blur">
          <span className="landing-badge-dot size-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
          {t.heroBadge}
        </span>
      </Reveal>

      <h1 className="mt-8 max-w-4xl text-balance font-display text-[clamp(2.75rem,8vw,6.25rem)] font-medium leading-[1.02] tracking-[-0.03em]">
        {t.heroTitleBefore}
        <span className="landing-gradient-text">{t.heroTitleGradient}</span>
        {t.heroTitleAfter}
      </h1>

      <BlurText
        text={t.heroSub}
        animateBy="words"
        delay={70}
        className="mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-fd-muted-foreground sm:text-lg"
      />

      <Reveal
        className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3"
      >
        <Magnet magnetStrength={24} padding={80} wrapperClassName="block shrink-0">
          <Link
            to="/$lang/docs/$"
            params={{ lang, _splat: '' }}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            {t.ctaDocs}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Magnet>
        <Magnet magnetStrength={24} padding={80} wrapperClassName="block shrink-0">
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/50 px-6 py-3 text-sm font-medium text-fd-foreground backdrop-blur transition-colors hover:bg-fd-accent"
          >
            <Star className="size-4" />
            {t.ctaGithub}
          </a>
        </Magnet>
      </Reveal>

      <Reveal>
        <p className="mt-5 text-xs tracking-wide text-fd-muted-foreground/70">{t.heroTrust}</p>
      </Reveal>

      <TerminalShowcase lang={lang} />
    </section>
  );
}
