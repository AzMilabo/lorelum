import { Link } from '@tanstack/react-router';
import { ArrowRight, Star } from 'lucide-react';
import BlurText from '@/components/react-bits/blur-text';
import GradientText from '@/components/react-bits/gradient-text';
import Magnet from '@/components/react-bits/magnet';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { TerminalShowcase } from './terminal-showcase';

const CTA_STYLES = {
  primary:
    'group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:brightness-110',
  secondary:
    'inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card/60 px-5 py-2.5 text-sm font-medium text-fd-foreground backdrop-blur transition-colors hover:bg-fd-accent',
};

export function Hero({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <section className="relative isolate mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center overflow-x-clip px-4 pb-24 pt-16 text-center sm:pt-24">
      <div aria-hidden className="landing-hero-glow" />

      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-fd-border/70 bg-fd-card/60 px-3 py-1 text-xs font-medium text-fd-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
          {t.heroBadge}
        </span>
      </Reveal>

      <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
        {t.heroTitleBefore}
        <GradientText colors={['#818cf8', '#c084fc', '#22d3ee']} animationSpeed={5}>
          {t.heroTitleGradient}
        </GradientText>
        {t.heroTitleAfter}
      </h1>

      <BlurText
        text={t.heroSub}
        animateBy="words"
        delay={80}
        className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-fd-muted-foreground sm:text-lg"
      />

      <Reveal
        delay={0.15}
        className="mt-9 flex flex-wrap items-center justify-center gap-x-4 gap-y-3"
      >
        <Magnet magnetStrength={24} padding={80} wrapperClassName="block shrink-0">
          <Link
            to="/$lang/docs/$"
            params={{ lang, _splat: '' }}
            className={CTA_STYLES.primary}
          >
            {t.ctaDocs}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Magnet>
        <Magnet magnetStrength={24} padding={80} wrapperClassName="block shrink-0">
          <a href={githubUrl} target="_blank" rel="noreferrer" className={CTA_STYLES.secondary}>
            <Star className="size-4" />
            {t.ctaGithub}
          </a>
        </Magnet>
      </Reveal>

      <TerminalShowcase lang={lang} />
    </section>
  );
}

