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
    <section className="relative mx-auto w-full max-w-5xl px-4 py-20">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/15 via-transparent to-cyan-400/15" />
          <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.ctaHeading}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance text-fd-muted-foreground">
            {t.ctaSub}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
                {t.ctaGithub}
              </a>
            </Magnet>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
