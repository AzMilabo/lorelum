import { Link } from '@tanstack/react-router';
import { ArrowRight, Star } from 'lucide-react';
import BlurText from '@/components/react-bits/blur-text';
import GradientText from '@/components/react-bits/gradient-text';
import Magnet from '@/components/react-bits/magnet';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { TerminalShowcase } from './terminal-showcase';

export function Hero({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-20 pt-16 text-center sm:pt-24">
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-fd-border/70 bg-fd-card/60 px-3 py-1 text-xs font-medium text-fd-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
          {t.heroBadge}
        </span>
      </Reveal>

      <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
        {t.heroTitleBefore}
        <GradientText colors={['#6366f1', '#a855f7', '#22d3ee']} animationSpeed={6}>
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

      <Reveal delay={0.15} className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Magnet magnetStrength={6} padding={60} wrapperClassName="block">
          <Link
            to="/$lang/docs/$"
            params={{ lang, _splat: '' }}
            className="group inline-flex items-center gap-2 rounded-xl bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-lg shadow-fd-primary/20 transition-shadow hover:shadow-fd-primary/40"
          >
            {t.ctaDocs}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Magnet>
        <Magnet magnetStrength={6} padding={60} wrapperClassName="block">
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card/60 px-5 py-2.5 text-sm font-medium text-fd-foreground backdrop-blur transition-colors hover:bg-fd-accent"
          >
            <Star className="size-4" />
            {t.ctaGithub}
          </a>
        </Magnet>
      </Reveal>

      <TerminalShowcase lang={lang} />
    </section>
  );
}
