import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';

/**
 * CTA — the closing moment. A rotating conic-gradient border ring (CSS
 * `@property`, ring-only repaint) around a glass panel with a slow inner
 * aurora glow. Pills match the hero.
 */
export function Cta({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <section className="relative mx-auto w-full max-w-6xl overflow-x-clip px-4 py-24 sm:py-32">
      <Reveal y={40} scale={0.96}>
        <div className="landing-conic-border">
          <div className="landing-conic-inner relative overflow-hidden px-6 py-20 text-center sm:px-12 sm:py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-1/2 -z-10 opacity-70"
            >
              <div className="landing-cta-glow" />
            </div>
            <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-medium tracking-tight sm:text-6xl">
              {t.ctaHeading}
            </h2>
            <p className="mx-auto mt-5 max-w-md text-balance text-base text-fd-muted-foreground sm:text-lg">
              {t.ctaSub}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
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
                {t.ctaGithub}
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
