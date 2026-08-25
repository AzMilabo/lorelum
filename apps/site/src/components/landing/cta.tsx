import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import Magnet from '@/components/react-bits/magnet';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';

export function Cta({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <section className="relative mx-auto w-full max-w-6xl overflow-x-clip px-4 py-24 sm:py-32">
      <Reveal>
        <div className="landing-ring glass relative rounded-3xl px-6 py-20 text-center sm:px-12 sm:py-24">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-400/20"
          />
          <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-medium tracking-tight sm:text-6xl">
            {t.ctaHeading}
          </h2>
          <p className="mx-auto mt-5 max-w-md text-balance text-base text-fd-muted-foreground sm:text-lg">
            {t.ctaSub}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <Magnet magnetStrength={24} padding={80} wrapperClassName="block shrink-0">
              <Link
                to="/$lang/docs/$"
                params={{ lang, _splat: '' }}
                className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:brightness-110"
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
                className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card/50 px-6 py-3 text-sm font-medium text-fd-foreground backdrop-blur transition-colors hover:bg-fd-accent"
              >
                {t.ctaGithub}
              </a>
            </Magnet>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
