import { Reveal } from './reveal';
import { SplitReveal } from './split-reveal';

export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="inline-flex items-center rounded-full border border-fd-border/60 bg-fd-card/50 px-3.5 py-1 backdrop-blur">
          <span className="landing-shimmer-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-transparent">
            {eyebrow}
          </span>
        </p>
      ) : null}
      <h2 className="mt-4 text-balance font-display text-4xl font-medium tracking-tight sm:text-5xl">
        <SplitReveal text={title} />
      </h2>
      {sub ? (
        <p className="mt-5 text-balance text-base text-fd-muted-foreground sm:text-lg">
          {sub}
        </p>
      ) : null}
    </Reveal>
  );
}
